// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IMarketplace {
    function createListing(bytes32 listingId, uint256 price) external;
    function buyNow(bytes32 listingId) external payable;
    function cancelListing(bytes32 listingId) external;
    function updateListingPrice(bytes32 listingId, uint256 newPrice) external;
    function makeOffer(bytes32 listingId) external payable;
    function acceptOffer(bytes32 listingId, address buyer) external;
    function rejectOffer(bytes32 listingId, address buyer) external;
    function cancelOffer(bytes32 listingId) external;
}
