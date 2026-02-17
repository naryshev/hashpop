// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "./Roles.sol";
import "./Escrow.sol";
import "./Treasury.sol";
import "./HederaAccountService.sol";

/**
 * @title AuctionHouse
 * @notice English auction implementation with anti-sniping.
 * @dev State machine: CREATED → ACTIVE → ENDED → SETTLED → ESCROW
 */
contract AuctionHouse is ReentrancyGuard, Pausable, AccessControl, Roles {
    enum AuctionStatus {
        CREATED,
        ACTIVE,
        ENDED,
        SETTLED,
        ESCROW
    }

    struct Auction {
        address seller;
        uint256 reservePrice;
        uint256 startTime;
        uint256 endTime;
        uint256 extensionWindow;
        AuctionStatus status;
    }

    struct Bid {
        address bidder;
        uint256 amount;
        uint256 timestamp;
    }

    mapping(bytes32 => Auction) public auctions;
    mapping(bytes32 => Bid) public highestBids;
    mapping(bytes32 => mapping(address => uint256)) public bidderRefunds;

    Escrow public escrow;
    Treasury public treasury;
    uint16 public platformFeeBps;
    uint256 public constant MIN_BID_INCREMENT_BPS = 500; // 5%
    uint256 public constant EXTENSION_WINDOW = 5 minutes;

    event AuctionCreated(
        bytes32 indexed auctionId,
        address indexed seller,
        uint256 reservePrice,
        uint256 startTime,
        uint256 endTime
    );
    event BidPlaced(bytes32 indexed auctionId, address indexed bidder, uint256 amount);
    event AuctionExtended(bytes32 indexed auctionId, uint256 newEndTime);
    event AuctionSettled(bytes32 indexed auctionId, address indexed winner, uint256 amount);

    constructor(address _escrow, address _treasury, uint16 _platformFeeBps) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(PAUSER_ROLE, msg.sender);

        escrow = Escrow(_escrow);
        treasury = Treasury(payable(_treasury));
        platformFeeBps = _platformFeeBps;
    }

    /**
     * @notice Grant marketplace role to escrow after deployment.
     */
    function authorizeEscrow() external onlyRole(DEFAULT_ADMIN_ROLE) {
        escrow.setMarketplace(address(this));
    }

    /**
     * @notice Create an English auction.
     */
    function createAuction(
        bytes32 auctionId,
        uint256 reservePrice,
        uint256 startTime,
        uint256 duration
    ) external whenNotPaused {
        require(auctions[auctionId].status == AuctionStatus.CREATED, "Auction exists");
        require(reservePrice > 0, "Invalid reserve");
        require(startTime >= block.timestamp, "Invalid start");
        require(duration >= 1 hours && duration <= 30 days, "Invalid duration");

        uint256 endTime = startTime + duration;

        auctions[auctionId] = Auction({
            seller: msg.sender,
            reservePrice: reservePrice,
            startTime: startTime,
            endTime: endTime,
            extensionWindow: EXTENSION_WINDOW,
            status: AuctionStatus.ACTIVE
        });

        emit AuctionCreated(auctionId, msg.sender, reservePrice, startTime, endTime);
    }

    /**
     * @notice Place a bid. Refunds previous highest bidder.
     */
    function placeBid(bytes32 auctionId) external payable whenNotPaused nonReentrant {
        Auction storage auction = auctions[auctionId];
        require(auction.status == AuctionStatus.ACTIVE, "Not active");
        require(block.timestamp >= auction.startTime, "Not started");
        require(block.timestamp < auction.endTime, "Ended");

        Bid memory currentBid = highestBids[auctionId];
        uint256 minBid = currentBid.amount == 0
            ? auction.reservePrice
            : currentBid.amount + ((currentBid.amount * MIN_BID_INCREMENT_BPS) / 10000);

        require(msg.value >= minBid, "Bid too low");

        // Refund previous highest bidder
        if (currentBid.bidder != address(0)) {
            bidderRefunds[auctionId][currentBid.bidder] += currentBid.amount;
        }

        // Update highest bid
        highestBids[auctionId] = Bid({
            bidder: msg.sender,
            amount: msg.value,
            timestamp: block.timestamp
        });

        // Anti-sniping: extend auction if bid in last 5 minutes
        if (block.timestamp + auction.extensionWindow >= auction.endTime) {
            auction.endTime = block.timestamp + auction.extensionWindow;
            emit AuctionExtended(auctionId, auction.endTime);
        }

        emit BidPlaced(auctionId, msg.sender, msg.value);
    }

    /**
     * @notice Place a bid using ED25519-signed authorization (HIP-632). Relayer sends value.
     */
    function placeBidWithED25519(
        bytes32 auctionId,
        address bidderAlias,
        uint256 bidAmount,
        uint256 deadline,
        bytes32 messageHash,
        bytes calldata signature
    ) external payable whenNotPaused nonReentrant {
        require(block.timestamp <= deadline, "Signature expired");
        require(
            messageHash == keccak256(abi.encodePacked(auctionId, bidAmount, deadline, "auctionHouse.placeBid")),
            "Invalid message hash"
        );
        require(bidderAlias != address(0), "Invalid bidder");

        require(
            HederaAccountService.isAuthorizedRaw(bidderAlias, messageHash, signature),
            "Invalid ED25519 signature"
        );

        Auction storage auction = auctions[auctionId];
        require(auction.status == AuctionStatus.ACTIVE, "Not active");
        require(block.timestamp >= auction.startTime, "Not started");
        require(block.timestamp < auction.endTime, "Ended");

        Bid memory currentBid = highestBids[auctionId];
        uint256 minBid = currentBid.amount == 0
            ? auction.reservePrice
            : currentBid.amount + ((currentBid.amount * MIN_BID_INCREMENT_BPS) / 10000);

        require(msg.value >= minBid && bidAmount == msg.value, "Bid too low or mismatch");

        if (currentBid.bidder != address(0)) {
            bidderRefunds[auctionId][currentBid.bidder] += currentBid.amount;
        }

        highestBids[auctionId] = Bid({
            bidder: bidderAlias,
            amount: msg.value,
            timestamp: block.timestamp
        });

        if (block.timestamp + auction.extensionWindow >= auction.endTime) {
            auction.endTime = block.timestamp + auction.extensionWindow;
            emit AuctionExtended(auctionId, auction.endTime);
        }

        emit BidPlaced(auctionId, bidderAlias, msg.value);
    }

    /**
     * @notice Withdraw refunded bid amount.
     */
    function withdrawRefund(bytes32 auctionId) external nonReentrant {
        uint256 amount = bidderRefunds[auctionId][msg.sender];
        require(amount > 0, "No refund");

        bidderRefunds[auctionId][msg.sender] = 0;

        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Transfer failed");
    }

    /**
     * @notice Settle auction after end time. Winner funds go to escrow.
     */
    function settleAuction(bytes32 auctionId) external whenNotPaused nonReentrant {
        Auction storage auction = auctions[auctionId];
        require(auction.status == AuctionStatus.ACTIVE, "Not active");
        require(block.timestamp >= auction.endTime, "Not ended");

        Bid memory winningBid = highestBids[auctionId];
        require(winningBid.bidder != address(0), "No bids");

        auction.status = AuctionStatus.SETTLED;

        // Calculate fees
        uint256 fee = (winningBid.amount * platformFeeBps) / 10000;
        uint256 sellerAmount = winningBid.amount - fee;

        // Send fee to treasury
        treasury.collectFee{value: fee}();

        // Create escrow for seller amount
        escrow.createEscrow{value: sellerAmount}(auctionId, winningBid.bidder, auction.seller, sellerAmount);

        auction.status = AuctionStatus.ESCROW;

        emit AuctionSettled(auctionId, winningBid.bidder, winningBid.amount);
    }

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }
}
