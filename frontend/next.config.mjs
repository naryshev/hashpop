/** @type {import('next').NextConfig} */
const nextConfig = {
  // Transpile Hashgraph packages through the Next.js compiler rather than
  // treating them as pre-compiled. Prevents the SWC minifier from producing
  // duplicate variable names (e.g. "Identifier 'n' has already been declared")
  // which causes ChunkLoadError at runtime.
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
