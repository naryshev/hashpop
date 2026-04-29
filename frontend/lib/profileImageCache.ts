// Simple client-side cache-bust for profile images so updated avatars show immediately.
const busted = new Set<string>();

export function invalidateProfileImage(address: string) {
  busted.add(address.toLowerCase());
}

export function isProfileImageBusted(address: string) {
  return busted.has(address.toLowerCase());
}
