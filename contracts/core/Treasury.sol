// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./Roles.sol";

/**
 * @title Treasury
 * @notice Collects platform fees. DAO-ready but admin-controlled in v1.
 */
contract Treasury is AccessControl, ReentrancyGuard, Roles {
    event FeeCollected(uint256 amount);
    event Withdrawal(address indexed to, uint256 amount);

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(TREASURER_ROLE, msg.sender);
    }

    /**
     * @notice Collect platform fee. Only callable by Marketplace/AuctionHouse.
     */
    function collectFee() external payable {
        require(msg.value > 0, "No fee");
        emit FeeCollected(msg.value);
    }

    /**
     * @notice Withdraw collected fees.
     */
    function withdraw(address to, uint256 amount) external onlyRole(TREASURER_ROLE) nonReentrant {
        require(to != address(0), "Invalid address");
        require(address(this).balance >= amount, "Insufficient balance");

        (bool success, ) = to.call{value: amount}("");
        require(success, "Transfer failed");

        emit Withdrawal(to, amount);
    }

    receive() external payable {
        emit FeeCollected(msg.value);
    }
}
