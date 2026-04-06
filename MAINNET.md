# Using real HBAR (Hedera Mainnet)

Testnet HBAR and mainnet HBAR are **separate**. You cannot transfer testnet HBAR to mainnet. To use real HBAR you need to:

1. **Get real HBAR** and send it to your wallet on **Hedera Mainnet**.
2. **Deploy your contracts on Mainnet** (new addresses).
3. **Point the app to Mainnet** (env + HashPack network).

---

## 1. Get real HBAR

- **Exchanges:** Buy HBAR on [Binance](https://www.binance.com), [KuCoin](https://www.kucoin.com), [Kraken](https://www.kraken.com), [Gate.io](https://www.gate.io), and others. Withdraw to your **Hedera mainnet account** (account ID, e.g. `0.0.12345`, or EVM address if the exchange supports it).
- **HashPack:** In [HashPack](https://hashpack.app), switch network to **Mainnet**, then use “Receive” to get your mainnet account ID. Send HBAR from the exchange to that account.
- **Hedera docs:** [Where to buy HBAR](https://hedera.com/hbar)

Keep some HBAR for gas; the rest can be used for listings and purchases.

---

## 2. Deploy contracts on Mainnet

You need a **funded ECDSA (EVM) account on mainnet** to pay deployment gas.

**2a. Fund the deployer**

- Create or use an ECDSA account in HashPack (Mainnet).
- Send real HBAR to that account (enough for deployment + a buffer).

**2b. Set env for mainnet deploy**

In the project root (or where your `.env` is for Hardhat), create or edit `.env`:

```env
# Private key of the mainnet account that will pay for deployment (no 0x prefix)
PRIVATE_KEY=your_ecdsa_private_key_hex

# Optional: mainnet RPC (defaults below if omitted)
HEDERA_MAINNET_RPC=https://mainnet.hashio.io/api
```

**2c. Deploy**

From the repo root:

```bash
npm run deploy:mainnet
```

Save the printed addresses (Escrow, Treasury, Reputation, Marketplace, AuctionHouse).

**2d. Authorize escrow (if needed)**

If the deploy script didn’t complete the authorization step:

```bash
npm run authorize:escrow:mainnet
```

---

## 3. Point the app to Mainnet

**3a. Backend**

In `backend/.env` (or your hosted backend env):

```env
# Mainnet RPC and mirror
HEDERA_RPC_URL=https://mainnet.hashio.io/api
MIRROR_URL=https://mainnet.mirrornode.hedera.com

# Addresses from step 2 (mainnet deployment)
MARKETPLACE_ADDRESS=0x...
ESCROW_ADDRESS=0x...
AUCTION_HOUSE_ADDRESS=0x...
```

**3b. Frontend**

In `frontend/.env.local` (or Vercel/hosted env):

```env
# Use mainnet
NEXT_PUBLIC_HEDERA_NETWORK=mainnet
NEXT_PUBLIC_HEDERA_RPC=https://mainnet.hashio.io/api

# Same mainnet contract addresses as backend
NEXT_PUBLIC_MARKETPLACE_ADDRESS=0x...
NEXT_PUBLIC_ESCROW_ADDRESS=0x...
NEXT_PUBLIC_AUCTION_HOUSE_ADDRESS=0x...

# Rest unchanged (API URL, WalletConnect, etc.)
NEXT_PUBLIC_API_URL=https://your-backend.example.com
NEXT_PUBLIC_WC_PROJECT_ID=...
```

**3c. Rebuild and deploy**

- Rebuild the frontend so it picks up `NEXT_PUBLIC_HEDERA_NETWORK=mainnet` and the new addresses.
- Redeploy backend if you changed its env.

---

## 4. Use the app with real HBAR

- In **HashPack**, switch the network to **Mainnet** (not Testnet).
- Connect the app to your wallet; it will use Hedera Mainnet (chain ID 295) when `NEXT_PUBLIC_HEDERA_NETWORK=mainnet`.
- Listings and purchases will use **real HBAR**.

---

## Summary

| Step     | What to do                                                                                                                              |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Get HBAR | Buy on an exchange, withdraw to your mainnet account (e.g. via HashPack Mainnet).                                                       |
| Deploy   | Fund an ECDSA mainnet account → set `PRIVATE_KEY` + optional `HEDERA_MAINNET_RPC` → `npm run deploy:mainnet` → save contract addresses. |
| Backend  | Set `HEDERA_RPC_URL`, `MIRROR_URL`, and mainnet contract addresses in backend env.                                                      |
| Frontend | Set `NEXT_PUBLIC_HEDERA_NETWORK=mainnet`, `NEXT_PUBLIC_HEDERA_RPC`, and mainnet contract addresses; rebuild and deploy.                 |
| Wallet   | In HashPack, select **Mainnet** and connect; all app actions use real HBAR.                                                             |

Leaving `NEXT_PUBLIC_HEDERA_NETWORK` unset (or not `mainnet`) keeps the app on **Testnet** (default).
