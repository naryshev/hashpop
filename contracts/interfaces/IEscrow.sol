// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IEscrow {
    function createEscrow(
        bytes32 listingId,
        address buyer,
        address seller,
        uint256 amount
    ) external payable;
    function confirmReceipt(bytes32 listingId) external;
    function confirmShipment(bytes32 listingId) external;
    function resolveTimeout(bytes32 listingId) external;
}
