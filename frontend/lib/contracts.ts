import { Abi } from "viem";

export const marketplaceAbi: Abi = [
  {
    name: "listings",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "listingId", type: "bytes32" }],
    outputs: [
      { name: "seller", type: "address" },
      { name: "price", type: "uint256" },
      { name: "createdAt", type: "uint256" },
      { name: "status", type: "uint8" },
      { name: "escrowId", type: "bytes32" },
      { name: "requireEscrow", type: "bool" },
    ],
  },
  {
    name: "createListing",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "listingId", type: "bytes32" },
      { name: "price", type: "uint256" },
      { name: "requireEscrow", type: "bool" },
    ],
    outputs: [],
  },
  {
    name: "buyNow",
    type: "function",
    stateMutability: "payable",
    inputs: [{ name: "listingId", type: "bytes32" }],
    outputs: [],
  },
  {
    name: "cancelListing",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "listingId", type: "bytes32" }],
    outputs: [],
  },
  {
    name: "updateListingPrice",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "listingId", type: "bytes32" },
      { name: "newPrice", type: "uint256" },
    ],
    outputs: [],
  },
  {
    name: "makeOffer",
    type: "function",
    stateMutability: "payable",
    inputs: [{ name: "listingId", type: "bytes32" }],
    outputs: [],
  },
  {
    name: "acceptOffer",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "listingId", type: "bytes32" },
      { name: "buyer", type: "address" },
    ],
    outputs: [],
  },
  {
    name: "rejectOffer",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "listingId", type: "bytes32" },
      { name: "buyer", type: "address" },
    ],
    outputs: [],
  },
  {
    name: "cancelOffer",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "listingId", type: "bytes32" }],
    outputs: [],
  },
];

export const auctionHouseAbi: Abi = [
  {
    name: "createAuction",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "auctionId", type: "bytes32" },
      { name: "reservePrice", type: "uint256" },
      { name: "startTime", type: "uint256" },
      { name: "duration", type: "uint256" }
    ],
    outputs: [],
  },
  {
    name: "placeBid",
    type: "function",
    stateMutability: "payable",
    inputs: [{ name: "auctionId", type: "bytes32" }],
    outputs: [],
  },
  {
    name: "settleAuction",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "auctionId", type: "bytes32" }],
    outputs: [],
  },
];

export const escrowAbi: Abi = [
  {
    name: "confirmShipment",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "listingId", type: "bytes32" }],
    outputs: [],
  },
  {
    name: "confirmReceipt",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "listingId", type: "bytes32" }],
    outputs: [],
  },
];

export const marketplaceAdminAbi: Abi = [
  {
    name: "paused",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "unpause",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
];

export const marketplaceAddress = (process.env.NEXT_PUBLIC_MARKETPLACE_ADDRESS || "0x0000000000000000000000000000000000000000") as `0x${string}`;
export const auctionHouseAddress = (process.env.NEXT_PUBLIC_AUCTION_HOUSE_ADDRESS || "0x0000000000000000000000000000000000000000") as `0x${string}`;
export const escrowAddress = (process.env.NEXT_PUBLIC_ESCROW_ADDRESS || "0x0000000000000000000000000000000000000000") as `0x${string}`;
