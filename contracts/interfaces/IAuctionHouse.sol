// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IAuctionHouse {
    function createAuction(
        bytes32 auctionId,
        uint256 reservePrice,
        uint256 startTime,
        uint256 duration
    ) external;
    function placeBid(bytes32 auctionId) external payable;
    function settleAuction(bytes32 auctionId) external;
}
