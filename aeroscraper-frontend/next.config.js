/** @type {import('next').NextConfig} */
//const million = require("million/compiler");
const { env } = require("process");
const withBundleAnalyzer = require("@next/bundle-analyzer")({
  enabled: process.env.ANALYZE === "true",
});
const nextConfig = withBundleAnalyzer({
  compiler: {
    removeConsole: env.NODE_ENV === "production" ? true : false,
  },
  compress: true,
  trailingSlash: true,
  experimental: {
    forceSwcTransforms: true,
    turbo: false, // Turbopack breaks WalletConnect CJS
  },
  swcMinify: true,

  // ✅ Transpile all WalletConnect & Pino modules (deep)
  transpilePackages: [
    "@reown/appkit",
    "@reown/appkit-adapter-solana",
    "@walletconnect",
    "pino",
  ],

  webpack: (config, { isServer }) => {
    // 🧩 Fix Node core polyfills
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
      path: false,
    };

    // 🧩 Force .mjs files inside node_modules to be parsed as ESM
    config.module.rules.push({
      test: /\.m?js$/,
      resolve: { fullySpecified: false },
    });

    // 🧩 Transpile nested Pino (in @walletconnect/core/node_modules)
    config.module.rules.push({
      test: /pino\/browser\.js$/,
      type: "javascript/auto",
    });

    return config;
  },
});

module.exports = nextConfig;

//module.exports = million.next(nextConfig,{ auto: true });
