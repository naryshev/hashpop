/** @type {import('next').NextConfig} */
const nextConfig = {
  swcMinify: true,
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
