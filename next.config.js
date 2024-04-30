// @ts-check
const { withBlitz } = require("@blitzjs/next")
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');

/**
 * @type {import('@blitzjs/next').BlitzConfig}
 **/
const config = {
  webpack(config, { isServer }) {
    if (!isServer) {
      config.plugins.push(
        new BundleAnalyzerPlugin({
          analyzerMode: 'static',
          reportFilename: 'bundle-report.html',
          openAnalyzer: false
        })
      );
    }
    return config;
  },
  reactStrictMode: true,
  swcMinify: true,
  experimental: { instrumentationHook: true },
  modularizeImports: {
    "@mui/material": {
      transform: "@mui/material/{{member}}",
    },
    "@mui/icons-material": {
      transform: "@mui/icons-material/{{member}}",
    },
    "@mui/styles": {
      transform: "@mui/styles/{{member}}",
    },
    "@mui/lab": {
      transform: "@mui/lab/{{member}}",
    },
  },

}

module.exports = withBlitz(config)
