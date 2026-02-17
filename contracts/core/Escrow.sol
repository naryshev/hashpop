// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "./Roles.sol";
import "./HederaAccountService.sol";

/**
 * @title Escrow
 * @notice Trustless escrow for buyer protection. Funds locked until completion or timeout.
 * @dev State machine: AWAITING_SHIPMENT → AWAITING_CONFIRMATION → COMPLETE
 */
contract Escrow is ReentrancyGuard, Pausable, AccessControl, Roles {
    bytes32 public constant MARKETPLACE_ROLE = keccak256("MARKETPLACE_ROLE");

    enum EscrowState {
        AWAITING_SHIPMENT,
        AWAITING_CONFIRMATION,
        COMPLETE
    }

    struct EscrowData {
        address buyer;
        address seller;
        uint256 amount;
        uint256 createdAt;
        uint256 timeoutAt;
        EscrowState state;
    }

    mapping(bytes32 => EscrowData) public escrows;
    uint256 public constant ESCROW_TIMEOUT = 7 days;

    event EscrowCreated(bytes32 indexed listingId, address indexed buyer, address indexed seller, uint256 amount);
    event EscrowConfirmed(bytes32 indexed listingId, address indexed buyer);
    event EscrowCompleted(bytes32 indexed listingId, address indexed seller, uint256 amount);
    event EscrowRefunded(bytes32 indexed listingId, address indexed buyer, uint256 amount);

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(PAUSER_ROLE, msg.sender);
    }

    /**
     * @notice Set marketplace address. Only callable by admin.
     */
    function setMarketplace(address marketplace) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(MARKETPLACE_ROLE, marketplace);
    }

    /**
     * @notice Create escrow on purchase. Only callable by Marketplace.
     */
    function createEscrow(
        bytes32 listingId,
        address buyer,
        address seller,
        uint256 amount
    ) external payable whenNotPaused nonReentrant onlyRole(MARKETPLACE_ROLE) {
        require(escrows[listingId].buyer == address(0), "Escrow exists");
        require(msg.value == amount, "Value mismatch");
        require(buyer != address(0) && seller != address(0), "Invalid addresses");

        escrows[listingId] = EscrowData({
            buyer: buyer,
            seller: seller,
            amount: amount,
            createdAt: block.timestamp,
            timeoutAt: block.timestamp + ESCROW_TIMEOUT,
            state: EscrowState.AWAITING_SHIPMENT
        });

        emit EscrowCreated(listingId, buyer, seller, amount);
    }

    /**
     * @notice Buyer confirms receipt. Releases funds to seller.
     */
    function confirmReceipt(bytes32 listingId) external nonReentrant {
        EscrowData storage escrow = escrows[listingId];
        require(escrow.buyer == msg.sender, "Not buyer");
        require(escrow.state == EscrowState.AWAITING_CONFIRMATION, "Invalid state");

        escrow.state = EscrowState.COMPLETE;
        uint256 amount = escrow.amount;

        (bool success, ) = escrow.seller.call{value: amount}("");
        require(success, "Transfer failed");

        emit EscrowConfirmed(listingId, msg.sender);
        emit EscrowCompleted(listingId, escrow.seller, amount);
    }

    /**
     * @notice Buyer (ED25519) confirms receipt via HIP-632 signature. Releases funds to seller.
     */
    function confirmReceiptWithED25519(
        bytes32 listingId,
        address buyerAlias,
        uint256 deadline,
        bytes32 messageHash,
        bytes calldata signature
    ) external nonReentrant {
        require(block.timestamp <= deadline, "Signature expired");
        require(
            messageHash == keccak256(abi.encodePacked(listingId, deadline, "escrow.confirmReceipt")),
            "Invalid message hash"
        );

        EscrowData storage escrow = escrows[listingId];
        require(escrow.buyer == buyerAlias, "Not buyer");
        require(escrow.state == EscrowState.AWAITING_CONFIRMATION, "Invalid state");

        require(
            HederaAccountService.isAuthorizedRaw(buyerAlias, messageHash, signature),
            "Invalid ED25519 signature"
        );

        escrow.state = EscrowState.COMPLETE;
        uint256 amount = escrow.amount;

        (bool success, ) = escrow.seller.call{value: amount}("");
        require(success, "Transfer failed");

        emit EscrowConfirmed(listingId, buyerAlias);
        emit EscrowCompleted(listingId, escrow.seller, amount);
    }

    /**
     * @notice Seller confirms shipment. Moves to AWAITING_CONFIRMATION.
     */
    function confirmShipment(bytes32 listingId) external {
        EscrowData storage escrow = escrows[listingId];
        require(escrow.seller == msg.sender, "Not seller");
        require(escrow.state == EscrowState.AWAITING_SHIPMENT, "Invalid state");

        escrow.state = EscrowState.AWAITING_CONFIRMATION;
    }

    /**
     * @notice Timeout resolution: refund buyer if seller silent, pay seller if buyer silent.
     */
    function resolveTimeout(bytes32 listingId) external nonReentrant {
        EscrowData storage escrow = escrows[listingId];
        require(block.timestamp >= escrow.timeoutAt, "Not timed out");
        require(escrow.state != EscrowState.COMPLETE, "Already complete");

        uint256 amount = escrow.amount;

        if (escrow.state == EscrowState.AWAITING_SHIPMENT) {
            // Seller silent: refund buyer
            escrow.state = EscrowState.COMPLETE;
            (bool success, ) = escrow.buyer.call{value: amount}("");
            require(success, "Refund failed");
            emit EscrowRefunded(listingId, escrow.buyer, amount);
        } else if (escrow.state == EscrowState.AWAITING_CONFIRMATION) {
            // Buyer silent: pay seller
            escrow.state = EscrowState.COMPLETE;
            (bool success, ) = escrow.seller.call{value: amount}("");
            require(success, "Transfer failed");
            emit EscrowCompleted(listingId, escrow.seller, amount);
        }
    }

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }
}
