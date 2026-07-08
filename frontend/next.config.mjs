/** @type {import('next').NextConfig} */
const nextConfig = {
  // Wallet dapp browsers (HashPack) frame the site from chrome-extension://
  // and custom-scheme origins. Per the CSP spec, `frame-ancestors *` matches
  // ONLY network schemes (http/https/ws/wss) — so that directive BLOCKS
  // extension-scheme wrappers (verbatim browser error: "The request has been
  // blocked... '*' matches only URLs with network schemes"). The only way to
  // allow framing from any scheme is to send no framing headers at all:
  // no X-Frame-Options, no frame-ancestors. This is what working Hedera
  // dapps (e.g. SaucerSwap) serve. Clickjacking protection is intentionally
  // traded away — being embeddable by wallets is the product requirement.
  // SWC minifier produces duplicate variable declarations when processing
  // @hashgraph/sdk and @hashgraph/proto (protobuf Long.js patterns).
  // Terser handles these edge cases correctly.
  swcMinify: false,
  transpilePackages: [
    "@hashgraph/sdk",
    "@hashgraph/proto",
    "@hashgraph/hedera-wallet-connect",
    "hashconnect",
  ],
  webpack: (config, { isServer }) => {
    // Stub so @metamask/sdk (pulled in by wagmi/connectors) doesn't break the build
    config.resolve.fallback = {
      ...config.resolve.fallback,
      "@react-native-async-storage/async-storage": false,
    };
    // HashConnect depends on @hashgraph/hedera-wallet-connect which uses require() in a way
    // webpack can't statically analyze. Safe to ignore; the package works at runtime.
    config.ignoreWarnings = [
      ...(config.ignoreWarnings || []),
      { module: /[\\/]node_modules[\\/]@hashgraph[\\/]hedera-wallet-connect[\\/]/ },
      { module: /[\\/]node_modules[\\/]hashconnect[\\/]/ },
    ];
    return config;
  },
};

export default nextConfig;
