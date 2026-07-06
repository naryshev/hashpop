// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "./Roles.sol";
import "./HederaAccountService.sol";

interface IMarketplaceCompletionV2 {
    function completeListing(bytes32 listingId) external;
}

/**
 * @title EscrowV2
 * @notice Arbiter-assisted escrow: buyers sign once (purchase), sellers never
 *         sign after listing. A platform settlement engine (ARBITER_ROLE)
 *         marks shipments, releases on verified delivery, refunds no-ships,
 *         and freezes disputes. Permissionless timeout paths keep funds
 *         recoverable even if the platform disappears:
 *
 *           AWAITING_SHIPMENT --(no ship by shipDeadline)------> REFUNDED
 *           SHIPPED ----------(autoReleaseWindow after ship)---> COMPLETE
 *           disputed ---------(disputedHardTimeout after create)-> REFUNDED
 *
 * @dev State machine: AWAITING_SHIPMENT → SHIPPED → COMPLETE | REFUNDED.
 *      Buyer `confirmReceipt` releases early from any live state (covers
 *      local pickup where no tracking exists). All transfers follow
 *      checks-effects-interactions; the marketplace completion callback is
 *      best-effort so a callback revert can never trap funds.
 */
contract EscrowV2 is ReentrancyGuard, Pausable, AccessControl, Roles {
    bytes32 public constant MARKETPLACE_ROLE = keccak256("MARKETPLACE_ROLE");
    bytes32 public constant ARBITER_ROLE = keccak256("ARBITER_ROLE");

    enum EscrowState {
        AWAITING_SHIPMENT,
        SHIPPED,
        COMPLETE,
        REFUNDED
    }

    struct EscrowData {
        address buyer;
        address seller;
        uint256 amount;
        uint256 createdAt;
        uint256 shipDeadline;
        uint256 shippedAt;
        EscrowState state;
        bool disputed;
    }

    mapping(bytes32 => EscrowData) public escrows;

    /// @notice Seller must mark shipped within this window or the buyer is refunded.
    uint256 public shipWindow = 7 days;
    /// @notice Permissionless fallback release this long after shipment (arbiter normally releases sooner on verified delivery).
    uint256 public autoReleaseWindow = 14 days;
    /// @notice If a dispute is never resolved, the buyer can reclaim after this long — the platform-death backstop.
    uint256 public disputedHardTimeout = 90 days;

    address public marketplaceCallback;

    event EscrowCreated(bytes32 indexed listingId, address indexed buyer, address indexed seller, uint256 amount);
    event EscrowShipped(bytes32 indexed listingId, address indexed by);
    event EscrowConfirmed(bytes32 indexed listingId, address indexed buyer);
    event EscrowCompleted(bytes32 indexed listingId, address indexed seller, uint256 amount);
    event EscrowRefunded(bytes32 indexed listingId, address indexed buyer, uint256 amount);
    event EscrowDisputed(bytes32 indexed listingId, bool disputed);
    event WindowsUpdated(uint256 shipWindow, uint256 autoReleaseWindow, uint256 disputedHardTimeout);

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(PAUSER_ROLE, msg.sender);
    }

    // ---------------------------------------------------------------------
    // Admin wiring
    // ---------------------------------------------------------------------

    /// @notice Authorize the marketplace and record it as the completion callback.
    function setMarketplace(address marketplace) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(MARKETPLACE_ROLE, marketplace);
        if (marketplaceCallback == address(0)) {
            marketplaceCallback = marketplace;
        }
    }

    /// @notice Grant / revoke the settlement engine key.
    function setArbiter(address arbiter, bool enabled) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (enabled) {
            _grantRole(ARBITER_ROLE, arbiter);
        } else {
            _revokeRole(ARBITER_ROLE, arbiter);
        }
    }

    /// @notice Tune timeout windows within safe bounds. Applies to escrows created afterwards
    ///         (per-escrow deadlines are stamped at creation; auto-release and dispute
    ///         backstops read the live values so they can only be tuned, not disabled).
    function setWindows(
        uint256 _shipWindow,
        uint256 _autoReleaseWindow,
        uint256 _disputedHardTimeout
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_shipWindow >= 1 days && _shipWindow <= 30 days, "shipWindow out of bounds");
        require(_autoReleaseWindow >= 3 days && _autoReleaseWindow <= 60 days, "autoRelease out of bounds");
        require(_disputedHardTimeout >= 30 days && _disputedHardTimeout <= 365 days, "hardTimeout out of bounds");
        shipWindow = _shipWindow;
        autoReleaseWindow = _autoReleaseWindow;
        disputedHardTimeout = _disputedHardTimeout;
        emit WindowsUpdated(_shipWindow, _autoReleaseWindow, _disputedHardTimeout);
    }

    // ---------------------------------------------------------------------
    // Lifecycle
    // ---------------------------------------------------------------------

    /// @notice Create escrow on purchase. Only callable by the Marketplace.
    /// @dev Signature-compatible with Escrow v1 so Marketplace.sol needs no changes.
    function createEscrow(
        bytes32 listingId,
        address buyer,
        address seller,
        uint256 amount
    ) external payable whenNotPaused nonReentrant onlyRole(MARKETPLACE_ROLE) {
        require(escrows[listingId].buyer == address(0), "Escrow exists");
        require(msg.value == amount && amount > 0, "Value mismatch");
        require(buyer != address(0) && seller != address(0), "Invalid addresses");
        require(buyer != seller, "Buyer is seller");

        escrows[listingId] = EscrowData({
            buyer: buyer,
            seller: seller,
            amount: amount,
            createdAt: block.timestamp,
            shipDeadline: block.timestamp + shipWindow,
            shippedAt: 0,
            state: EscrowState.AWAITING_SHIPMENT,
            disputed: false
        });

        emit EscrowCreated(listingId, buyer, seller, amount);
    }

    /// @notice Record shipment. Callable by the seller or the settlement engine
    ///         (which verifies the tracking number against the carrier first).
    function markShipped(bytes32 listingId) external whenNotPaused {
        EscrowData storage escrow = escrows[listingId];
        require(escrow.buyer != address(0), "No escrow");
        require(escrow.state == EscrowState.AWAITING_SHIPMENT, "Invalid state");
        require(msg.sender == escrow.seller || hasRole(ARBITER_ROLE, msg.sender), "Not seller or arbiter");

        escrow.state = EscrowState.SHIPPED;
        escrow.shippedAt = block.timestamp;
        emit EscrowShipped(listingId, msg.sender);
    }

    /// @notice Buyer releases funds early ("Got it"). Valid from any live state —
    ///         covers local pickup where no tracking is ever entered.
    function confirmReceipt(bytes32 listingId) external nonReentrant {
        EscrowData storage escrow = escrows[listingId];
        require(escrow.buyer == msg.sender, "Not buyer");
        require(_isLive(escrow.state), "Invalid state");

        emit EscrowConfirmed(listingId, msg.sender);
        _release(listingId, escrow);
    }

    /// @notice Buyer (ED25519 alias) releases early via HIP-632 signature.
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
        require(_isLive(escrow.state), "Invalid state");
        require(
            HederaAccountService.isAuthorizedRaw(buyerAlias, messageHash, signature),
            "Invalid ED25519 signature"
        );

        emit EscrowConfirmed(listingId, buyerAlias);
        _release(listingId, escrow);
    }

    /// @notice Settlement engine releases to the seller (verified delivery +
    ///         inspection window elapsed, or dispute resolved in seller's favor).
    function release(bytes32 listingId) external nonReentrant onlyRole(ARBITER_ROLE) {
        EscrowData storage escrow = escrows[listingId];
        require(escrow.buyer != address(0), "No escrow");
        require(_isLive(escrow.state), "Invalid state");
        _release(listingId, escrow);
    }

    /// @notice Settlement engine refunds the buyer (no-ship or dispute resolved
    ///         in buyer's favor).
    function refund(bytes32 listingId) external nonReentrant onlyRole(ARBITER_ROLE) {
        EscrowData storage escrow = escrows[listingId];
        require(escrow.buyer != address(0), "No escrow");
        require(_isLive(escrow.state), "Invalid state");
        _refund(listingId, escrow);
    }

    /// @notice Freeze / unfreeze an escrow while a dispute is reviewed. Frozen
    ///         escrows skip the permissionless timeout paths (except the hard
    ///         backstop) until resolved by release/refund.
    function setDisputed(bytes32 listingId, bool disputed) external onlyRole(ARBITER_ROLE) {
        EscrowData storage escrow = escrows[listingId];
        require(escrow.buyer != address(0), "No escrow");
        require(_isLive(escrow.state), "Invalid state");
        escrow.disputed = disputed;
        emit EscrowDisputed(listingId, disputed);
    }

    /// @notice Permissionless timeout resolution — anyone (keeper, buyer, seller)
    ///         can settle an expired escrow, so funds never depend on the platform:
    ///         - never shipped by the deadline → refund buyer
    ///         - shipped, buyer silent through the auto-release window → pay seller
    ///         - disputed and unresolved past the hard timeout → refund buyer
    function resolveTimeout(bytes32 listingId) external nonReentrant {
        EscrowData storage escrow = escrows[listingId];
        require(escrow.buyer != address(0), "No escrow");
        require(_isLive(escrow.state), "Invalid state");

        if (escrow.disputed) {
            require(block.timestamp >= escrow.createdAt + disputedHardTimeout, "Dispute pending");
            _refund(listingId, escrow);
            return;
        }

        if (escrow.state == EscrowState.AWAITING_SHIPMENT) {
            require(block.timestamp >= escrow.shipDeadline, "Not timed out");
            _refund(listingId, escrow);
        } else {
            // SHIPPED
            require(block.timestamp >= escrow.shippedAt + autoReleaseWindow, "Not timed out");
            _release(listingId, escrow);
        }
    }

    // ---------------------------------------------------------------------
    // Internals
    // ---------------------------------------------------------------------

    function _isLive(EscrowState state) private pure returns (bool) {
        return state == EscrowState.AWAITING_SHIPMENT || state == EscrowState.SHIPPED;
    }

    function _release(bytes32 listingId, EscrowData storage escrow) private {
        escrow.state = EscrowState.COMPLETE;
        escrow.disputed = false;
        uint256 amount = escrow.amount;
        address seller = escrow.seller;

        (bool success, ) = seller.call{value: amount}("");
        require(success, "Transfer failed");
        _notifyMarketplace(listingId);

        emit EscrowCompleted(listingId, seller, amount);
    }

    function _refund(bytes32 listingId, EscrowData storage escrow) private {
        escrow.state = EscrowState.REFUNDED;
        escrow.disputed = false;
        uint256 amount = escrow.amount;
        address buyer = escrow.buyer;

        (bool success, ) = buyer.call{value: amount}("");
        require(success, "Refund failed");
        _notifyMarketplace(listingId);

        emit EscrowRefunded(listingId, buyer, amount);
    }

    /// @dev Best-effort: a reverting (or code-less) marketplace callback must
    ///      never trap funds. Uses a low-level call rather than try/catch: the
    ///      compiler-inserted extcodesize check on a high-level call reverts
    ///      outside the try/catch when the target has no code.
    function _notifyMarketplace(bytes32 listingId) private {
        if (marketplaceCallback != address(0)) {
            // solhint-disable-next-line avoid-low-level-calls
            (bool ok, ) = marketplaceCallback.call(
                abi.encodeCall(IMarketplaceCompletionV2.completeListing, (listingId))
            );
            ok; // result intentionally ignored
        }
    }

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }
}
