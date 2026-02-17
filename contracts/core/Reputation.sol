// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./Roles.sol";

/**
 * @title Reputation
 * @notice Immutable reputation derived from on-chain activity.
 * @dev No editable scores. All metrics computed from events.
 */
contract Reputation is AccessControl, Roles {
    struct UserStats {
        uint256 totalSales;
        uint256 successfulCompletions;
        uint256 refunds;
        uint256 timeouts;
    }

    mapping(address => UserStats) public userStats;

    event ReputationUpdated(
        address indexed user,
        uint256 totalSales,
        uint256 successfulCompletions,
        uint256 refunds,
        uint256 timeouts
    );

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    /**
     * @notice Record a successful sale completion.
     */
    function recordSale(address user) external onlyRole(DEFAULT_ADMIN_ROLE) {
        UserStats storage stats = userStats[user];
        stats.totalSales++;
        stats.successfulCompletions++;

        emit ReputationUpdated(
            user,
            stats.totalSales,
            stats.successfulCompletions,
            stats.refunds,
            stats.timeouts
        );
    }

    /**
     * @notice Record a refund (buyer protection triggered).
     */
    function recordRefund(address user) external onlyRole(DEFAULT_ADMIN_ROLE) {
        UserStats storage stats = userStats[user];
        stats.totalSales++;
        stats.refunds++;

        emit ReputationUpdated(
            user,
            stats.totalSales,
            stats.successfulCompletions,
            stats.refunds,
            stats.timeouts
        );
    }

    /**
     * @notice Record a timeout (seller or buyer silent).
     */
    function recordTimeout(address user) external onlyRole(DEFAULT_ADMIN_ROLE) {
        UserStats storage stats = userStats[user];
        stats.totalSales++;
        stats.timeouts++;

        emit ReputationUpdated(
            user,
            stats.totalSales,
            stats.successfulCompletions,
            stats.refunds,
            stats.timeouts
        );
    }

    /**
     * @notice Get reputation score (0-100). Higher is better.
     */
    function getReputationScore(address user) external view returns (uint256) {
        UserStats memory stats = userStats[user];
        if (stats.totalSales == 0) return 50; // Neutral for new users

        uint256 successRate = (stats.successfulCompletions * 100) / stats.totalSales;
        uint256 penalty = stats.timeouts * 10; // 10 points per timeout

        if (successRate > penalty) {
            return successRate - penalty;
        }
        return 0;
    }
}
