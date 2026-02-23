// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "./Roles.sol";
import "./Escrow.sol";
import "./Treasury.sol";
import "./Reputation.sol";
import "./HederaAccountService.sol";

/**
 * @title Marketplace
 * @notice Fixed-price listings with escrow protection.
 * @dev State machine: NONE → LISTED → LOCKED → COMPLETED | CANCELLED
 */
contract Marketplace is ReentrancyGuard, Pausable, AccessControl, Roles {
    enum ListingStatus {
        NONE,
        LISTED,
        LOCKED,
        COMPLETED,
        CANCELLED
    }

    struct Listing {
        address seller;
        uint256 price;
        uint256 createdAt;
        ListingStatus status;
        bytes32 escrowId;
        bool requireEscrow;
    }

    struct Offer {
        address buyer;
        uint256 amount;
        bool active;
    }

    mapping(bytes32 => Listing) public listings;
    mapping(bytes32 => mapping(address => Offer)) public offers;
    mapping(bytes32 => address) public activeOfferBuyer;
    Escrow public escrow;
    Treasury public treasury;
    Reputation public reputation;
    uint16 public platformFeeBps;
    uint16 public constant DIRECT_SALE_FEE_BPS = 200; // 2%

    event ItemListed(bytes32 indexed listingId, address indexed seller, uint256 price);
    event ItemPurchased(bytes32 indexed listingId, address indexed buyer, address indexed seller, uint256 price);
    event ListingCancelled(bytes32 indexed listingId, address indexed seller);
    event PriceUpdated(bytes32 indexed listingId, uint256 newPrice);
    event OfferMade(bytes32 indexed listingId, address indexed buyer, uint256 amount);
    event OfferAccepted(bytes32 indexed listingId, address indexed buyer, uint256 amount);
    event OfferRejected(bytes32 indexed listingId, address indexed buyer, uint256 amount);
    event OfferCancelled(bytes32 indexed listingId, address indexed buyer, uint256 amount);

    constructor(
        address _escrow,
        address _treasury,
        address _reputation,
        uint16 _platformFeeBps
    ) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(PAUSER_ROLE, msg.sender);

        escrow = Escrow(_escrow);
        treasury = Treasury(payable(_treasury));
        reputation = Reputation(_reputation);
        platformFeeBps = _platformFeeBps;
    }

    /**
     * @notice Grant marketplace role to escrow after deployment.
     */
    function authorizeEscrow() external onlyRole(DEFAULT_ADMIN_ROLE) {
        escrow.setMarketplace(address(this));
    }

    /**
     * @notice Create a fixed-price listing.
     */
    function createListing(bytes32 listingId, uint256 price, bool requireEscrow) external whenNotPaused {
        require(listings[listingId].status == ListingStatus.NONE, "Listing exists");
        require(price > 0, "Invalid price");

        listings[listingId] = Listing({
            seller: msg.sender,
            price: price,
            createdAt: block.timestamp,
            status: ListingStatus.LISTED,
            escrowId: bytes32(0),
            requireEscrow: requireEscrow
        });

        emit ItemListed(listingId, msg.sender, price);
    }

    /**
     * @notice Buy item at listed price.
     * @dev If listing.requireEscrow is true, funds go into escrow.
     *      Otherwise, payment settles immediately: 2% fee to treasury, remainder to seller.
     */
    function buyNow(bytes32 listingId) external payable whenNotPaused nonReentrant {
        Listing storage listing = listings[listingId];
        require(listing.status == ListingStatus.LISTED, "Not listed");
        require(msg.value == listing.price, "Price mismatch");
        require(msg.sender != listing.seller, "Cannot buy own");

        _refundActiveOfferIfAny(listingId);
        if (listing.requireEscrow) {
            listing.status = ListingStatus.LOCKED;
            listing.escrowId = listingId;
            escrow.createEscrow{value: msg.value}(listingId, msg.sender, listing.seller, msg.value);
        } else {
            _settleDirectSale(listing, msg.value);
        }

        emit ItemPurchased(listingId, msg.sender, listing.seller, listing.price);
    }

    /**
     * @notice Buy item using ED25519-signed authorization (HIP-632). Relayer sends value.
     * @param listingId Listing id.
     * @param buyerAlias Hedera account alias (virtual address) of the ED25519 buyer.
     * @param price Listed price (must match listing).
     * @param deadline Unix timestamp after which the signature is invalid.
     * @param messageHash keccak256(abi.encodePacked(listingId, price, deadline, "marketplace.buyNow")).
     * @param signature ED25519 signature of the message hash from buyerAlias.
     */
    function buyNowWithED25519(
        bytes32 listingId,
        address buyerAlias,
        uint256 price,
        uint256 deadline,
        bytes32 messageHash,
        bytes calldata signature
    ) external payable whenNotPaused nonReentrant {
        require(block.timestamp <= deadline, "Signature expired");
        require(
            messageHash == keccak256(abi.encodePacked(listingId, price, deadline, "marketplace.buyNow")),
            "Invalid message hash"
        );

        Listing storage listing = listings[listingId];
        require(listing.status == ListingStatus.LISTED, "Not listed");
        require(msg.value == price && price == listing.price, "Price mismatch");
        require(buyerAlias != listing.seller, "Cannot buy own");
        require(buyerAlias != address(0), "Invalid buyer");

        require(
            HederaAccountService.isAuthorizedRaw(buyerAlias, messageHash, signature),
            "Invalid ED25519 signature"
        );

        if (listing.requireEscrow) {
            listing.status = ListingStatus.LOCKED;
            listing.escrowId = listingId;
            escrow.createEscrow{value: msg.value}(listingId, buyerAlias, listing.seller, msg.value);
        } else {
            _settleDirectSale(listing, msg.value);
        }

        emit ItemPurchased(listingId, buyerAlias, listing.seller, listing.price);
    }

    /**
     * @notice Seller cancels listing before sale.
     */
    function cancelListing(bytes32 listingId) external whenNotPaused {
        Listing storage listing = listings[listingId];
        require(listing.seller == msg.sender, "Not seller");
        require(listing.status == ListingStatus.LISTED, "Cannot cancel");

        _refundActiveOfferIfAny(listingId);
        listing.status = ListingStatus.CANCELLED;

        emit ListingCancelled(listingId, msg.sender);
    }

    /**
     * @notice Seller updates the price of an active listing.
     */
    function updateListingPrice(bytes32 listingId, uint256 newPrice) external whenNotPaused {
        Listing storage listing = listings[listingId];
        require(listing.seller == msg.sender, "Not seller");
        require(listing.status == ListingStatus.LISTED, "Not listed");
        require(newPrice > 0, "Invalid price");

        listing.price = newPrice;
        emit PriceUpdated(listingId, newPrice);
    }

    /**
     * @notice Buyer makes an offer by locking HBAR in the contract.
     * @dev Exactly one active offer is allowed per listing to ensure clean refund semantics.
     */
    function makeOffer(bytes32 listingId) external payable whenNotPaused nonReentrant {
        Listing storage listing = listings[listingId];
        require(listing.status == ListingStatus.LISTED, "Not listed");
        require(msg.sender != listing.seller, "Cannot offer own");
        require(msg.value > 0, "Invalid offer");
        require(activeOfferBuyer[listingId] == address(0), "Active offer exists");

        offers[listingId][msg.sender] = Offer({
            buyer: msg.sender,
            amount: msg.value,
            active: true
        });
        activeOfferBuyer[listingId] = msg.sender;

        emit OfferMade(listingId, msg.sender, msg.value);
    }

    /**
     * @notice Seller accepts an active offer.
     * @dev If requireEscrow is false, settles immediately with 2% fee.
     */
    function acceptOffer(bytes32 listingId, address buyer) external whenNotPaused nonReentrant {
        Listing storage listing = listings[listingId];
        require(listing.seller == msg.sender, "Not seller");
        require(listing.status == ListingStatus.LISTED, "Not listed");
        require(activeOfferBuyer[listingId] == buyer, "Offer not active");

        Offer storage offer = offers[listingId][buyer];
        require(offer.active, "Offer not active");
        require(offer.amount > 0, "Invalid offer");

        uint256 amount = offer.amount;
        offer.active = false;
        offer.amount = 0;
        activeOfferBuyer[listingId] = address(0);

        if (listing.requireEscrow) {
            listing.status = ListingStatus.LOCKED;
            listing.escrowId = listingId;
            escrow.createEscrow{value: amount}(listingId, buyer, listing.seller, amount);
        } else {
            _settleDirectSale(listing, amount);
        }

        emit OfferAccepted(listingId, buyer, amount);
        emit ItemPurchased(listingId, buyer, listing.seller, amount);
    }

    /**
     * @notice Seller rejects an active offer and refunds buyer.
     */
    function rejectOffer(bytes32 listingId, address buyer) external whenNotPaused nonReentrant {
        Listing storage listing = listings[listingId];
        require(listing.seller == msg.sender, "Not seller");
        require(listing.status == ListingStatus.LISTED, "Not listed");
        require(activeOfferBuyer[listingId] == buyer, "Offer not active");

        Offer storage offer = offers[listingId][buyer];
        require(offer.active, "Offer not active");
        uint256 amount = offer.amount;

        offer.active = false;
        offer.amount = 0;
        activeOfferBuyer[listingId] = address(0);

        (bool success, ) = buyer.call{value: amount}("");
        require(success, "Offer refund failed");

        emit OfferRejected(listingId, buyer, amount);
    }

    /**
     * @notice Buyer cancels their own active offer and gets refunded.
     */
    function cancelOffer(bytes32 listingId) external whenNotPaused nonReentrant {
        require(activeOfferBuyer[listingId] == msg.sender, "Offer not active");
        Offer storage offer = offers[listingId][msg.sender];
        require(offer.active, "Offer not active");

        uint256 amount = offer.amount;
        offer.active = false;
        offer.amount = 0;
        activeOfferBuyer[listingId] = address(0);

        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Offer refund failed");

        emit OfferCancelled(listingId, msg.sender, amount);
    }

    /**
     * @notice Mark listing as completed after escrow resolution.
     */
    function completeListing(bytes32 listingId) external {
        require(msg.sender == address(escrow), "Not escrow");
        Listing storage listing = listings[listingId];
        require(listing.status == ListingStatus.LOCKED, "Not locked");
        // Only escrow can call this via completion callback
        listing.status = ListingStatus.COMPLETED;
    }

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    function _refundActiveOfferIfAny(bytes32 listingId) internal {
        address buyer = activeOfferBuyer[listingId];
        if (buyer == address(0)) return;

        Offer storage offer = offers[listingId][buyer];
        if (!offer.active || offer.amount == 0) {
            activeOfferBuyer[listingId] = address(0);
            return;
        }

        uint256 amount = offer.amount;
        offer.active = false;
        offer.amount = 0;
        activeOfferBuyer[listingId] = address(0);

        (bool success, ) = buyer.call{value: amount}("");
        require(success, "Offer refund failed");
        emit OfferCancelled(listingId, buyer, amount);
    }

    function _settleDirectSale(Listing storage listing, uint256 amount) internal {
        uint256 fee = (amount * DIRECT_SALE_FEE_BPS) / 10000;
        uint256 sellerAmount = amount - fee;
        listing.status = ListingStatus.COMPLETED;
        listing.escrowId = bytes32(0);
        if (fee > 0) {
            treasury.collectFee{value: fee}();
        }
        (bool sellerPaid, ) = listing.seller.call{value: sellerAmount}("");
        require(sellerPaid, "Seller payout failed");
    }
}
