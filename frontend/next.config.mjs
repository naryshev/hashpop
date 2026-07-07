/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow HashPack and other wallet in-app browsers to embed the site (their
  // dapp browsers render pages in an iframe). Framing permission is granted
  // via CSP frame-ancestors ONLY: "ALLOWALL" is not a valid X-Frame-Options
  // value, and engines that refuse to parse it can treat it as deny — a
  // silent blank page in the wallet's browser. Absence of X-Frame-Options +
  // frame-ancestors * is the standards-correct "frameable by anyone".
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors *;",
          },
        ],
      },
    ];
  },
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
