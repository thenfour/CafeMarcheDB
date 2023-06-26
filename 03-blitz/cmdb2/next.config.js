// @ts-check
const { withBlitz } = require("@blitzjs/next")

/**
 * @type {import('@blitzjs/next').BlitzConfig}
 **/
const config = {
    reactStrictMode: true,
    swcMinify: true,
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
