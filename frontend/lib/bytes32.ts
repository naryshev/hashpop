/**
 * Encode a string as bytes32 hex (same as Solidity / EVM).
 * Browser-safe (no Node Buffer).
 */
export function stringToBytes32Hex(id: string): `0x${string}` {
  const hex = Array.from(new TextEncoder().encode(id))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `0x${hex.padEnd(64, "0").slice(0, 64)}` as `0x${string}`;
}
