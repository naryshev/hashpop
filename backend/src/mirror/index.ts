import axios from "axios";

const MIRROR_BASE = process.env.MIRROR_URL || "https://testnet.mirrornode.hedera.com";

export async function fetchMirrorEvents(
  marketplaceAddr: string,
  auctionHouseAddr: string,
  sinceTimestamp: number
): Promise<any[]> {
  try {
    // Fetch contract logs from Mirror Node
    const [marketplaceLogs, auctionLogs] = await Promise.all([
      fetchContractLogs(marketplaceAddr, sinceTimestamp),
      fetchContractLogs(auctionHouseAddr, sinceTimestamp),
    ]);

    const combined = [...marketplaceLogs, ...auctionLogs];
    const toTs = (t: any) => (typeof t === "string" ? parseFloat(t) : Number(t)) || 0;
    return combined.sort((a, b) => toTs(a.timestamp) - toTs(b.timestamp));
  } catch (err) {
    console.error("Mirror fetch error:", err);
    return [];
  }
}

function normalizeAddressForUrl(addr: string): string {
  const hex = addr.startsWith("0x") ? addr.slice(2) : addr;
  return hex.toLowerCase();
}

async function fetchContractLogs(contractAddress: string, since: number): Promise<any[]> {
  const params: Record<string, string | number> = { limit: 100 };
  if (since > 0) {
    params.timestamp = `gt:${since}`;
    params.order = "asc";
  } else {
    params.order = "desc";
  }

  const addrForUrl = normalizeAddressForUrl(contractAddress);
  const tryUrl = (addr: string) => {
    const url = `${MIRROR_BASE}/api/v1/contracts/${addr}/results/logs`;
    return axios.get(url, { params }).then((res) => res.data.logs || []);
  };

  try {
    let logs = await tryUrl(addrForUrl);
    if (logs.length === 0 && addrForUrl.length === 40) {
      logs = await tryUrl("0x" + addrForUrl);
    }
    return logs;
  } catch (err: any) {
    const status = err.response?.status;
    const data = err.response?.data;
    console.error(
      `Failed to fetch logs for ${contractAddress}:`,
      status,
      data ?? err.message
    );
    return [];
  }
}
