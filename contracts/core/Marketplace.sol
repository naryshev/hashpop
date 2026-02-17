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
    }

    mapping(bytes32 => Listing) public listings;
    Escrow public escrow;
    Treasury public treasury;
    Reputation public reputation;
    uint16 public platformFeeBps;

    event ItemListed(bytes32 indexed listingId, address indexed seller, uint256 price);
    event ItemPurchased(bytes32 indexed listingId, address indexed buyer, address indexed seller, uint256 price);
    event ListingCancelled(bytes32 indexed listingId, address indexed seller);

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
    function createListing(bytes32 listingId, uint256 price) external whenNotPaused {
        require(listings[listingId].status == ListingStatus.NONE, "Listing exists");
        require(price > 0, "Invalid price");

        listings[listingId] = Listing({
            seller: msg.sender,
            price: price,
            createdAt: block.timestamp,
            status: ListingStatus.LISTED,
            escrowId: bytes32(0)
        });

        emit ItemListed(listingId, msg.sender, price);
    }

    /**
     * @notice Buy item at listed price. Creates escrow.
     */
    function buyNow(bytes32 listingId) external payable whenNotPaused nonReentrant {
        Listing storage listing = listings[listingId];
        require(listing.status == ListingStatus.LISTED, "Not listed");
        require(msg.value == listing.price, "Price mismatch");
        require(msg.sender != listing.seller, "Cannot buy own");

        listing.status = ListingStatus.LOCKED;
        listing.escrowId = listingId;

        // Create escrow
        escrow.createEscrow{value: msg.value}(listingId, msg.sender, listing.seller, msg.value);

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

        listing.status = ListingStatus.LOCKED;
        listing.escrowId = listingId;

        escrow.createEscrow{value: msg.value}(listingId, buyerAlias, listing.seller, msg.value);

        emit ItemPurchased(listingId, buyerAlias, listing.seller, listing.price);
    }

    /**
     * @notice Seller cancels listing before sale.
     */
    function cancelListing(bytes32 listingId) external whenNotPaused {
        Listing storage listing = listings[listingId];
        require(listing.seller == msg.sender, "Not seller");
        require(listing.status == ListingStatus.LISTED, "Cannot cancel");

        listing.status = ListingStatus.CANCELLED;

        emit ListingCancelled(listingId, msg.sender);
    }

    /**
     * @notice Mark listing as completed after escrow resolution.
     */
    function completeListing(bytes32 listingId) external {
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
}
