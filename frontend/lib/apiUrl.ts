/**
 * Base API URL. In the browser, when the page is opened via a local/LAN host
 * (localhost, 127.0.0.1, 192.168.x.x, 10.x.x.x), returns the same host with the API port
 * so that e.g. http://192.168.1.224:3000 calls http://192.168.1.224:4000.
 */
const envUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

function isLocalHostname(host: string): boolean {
  const h = host.toLowerCase();
  if (h === "localhost" || h === "127.0.0.1") return true;
  if (h.startsWith("192.168.") || h.startsWith("10.")) return true;
  if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(h)) return true;
  return false;
}

export function getApiUrl(): string {
  if (typeof window === "undefined") return envUrl;
  try {
    const u = new URL(envUrl);
    if (isLocalHostname(window.location.hostname))
      return `${window.location.protocol}//${window.location.hostname}:${u.port || "4000"}`;
  } catch {}
  return envUrl;
}
