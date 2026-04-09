import { hederaPublicClient } from "./hederaPublicClient";
import { marketplaceAddress } from "./contracts";

const listingsAbiV2 = [
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
] as const;

const listingsAbiV1 = [
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
    ],
  },
] as const;

type ChainListing = {
  seller: string;
  price: bigint;
  createdAt: bigint;
  status: number;
  escrowId: `0x${string}`;
  requireEscrow: boolean | null;
};

export async function readListingCompat(listingId: `0x${string}`): Promise<ChainListing> {
  try {
    const v2 = (await hederaPublicClient.readContract({
      address: marketplaceAddress,
      abi: listingsAbiV2,
      functionName: "listings",
      args: [listingId],
    })) as readonly [string, bigint, bigint, number, `0x${string}`, boolean];
    return {
      seller: v2[0],
      price: v2[1],
      createdAt: v2[2],
      status: Number(v2[3]),
      escrowId: v2[4],
      requireEscrow: !!v2[5],
    };
  } catch {
    const v1 = (await hederaPublicClient.readContract({
      address: marketplaceAddress,
      abi: listingsAbiV1,
      functionName: "listings",
      args: [listingId],
    })) as readonly [string, bigint, bigint, number, `0x${string}`];
    return {
      seller: v1[0],
      price: v1[1],
      createdAt: v1[2],
      status: Number(v1[3]),
      escrowId: v1[4],
      requireEscrow: null,
    };
  }
}
