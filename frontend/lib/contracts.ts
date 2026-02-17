import { Abi } from "viem";

export const marketplaceAbi: Abi = [
  {
    name: "createListing",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "listingId", type: "bytes32" },
      { name: "price", type: "uint256" }
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

export const marketplaceAddress = (process.env.NEXT_PUBLIC_MARKETPLACE_ADDRESS || "0x0000000000000000000000000000000000000000") as `0x${string}`;
export const auctionHouseAddress = (process.env.NEXT_PUBLIC_AUCTION_HOUSE_ADDRESS || "0x0000000000000000000000000000000000000000") as `0x${string}`;
