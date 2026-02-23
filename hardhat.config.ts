import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config();

function normalizePrivateKey(raw?: string): string | null {
  const key = (raw || "").trim();
  if (!key) return null;
  return key.startsWith("0x") ? key : `0x${key}`;
}

const deployerKey =
  normalizePrivateKey(process.env.HEDERA_TESTNET_OPERATOR) ||
  normalizePrivateKey(process.env.PRIVATE_KEY);

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hederaTestnet: {
      url: process.env.HEDERA_TESTNET_RPC || "https://testnet.hashio.io/api",
      accounts: deployerKey ? [deployerKey] : [],
      chainId: 296,
    },
    hederaMainnet: {
      url: process.env.HEDERA_MAINNET_RPC || "https://mainnet.hashio.io/api",
      accounts: deployerKey ? [deployerKey] : [],
      chainId: 295,
    },
  },
  paths: {
    sources: "./contracts/core",
    tests: "./contracts/test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
};

export default config;
