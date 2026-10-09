const { loadEnvConfig } = require("@next/env")

// Normal reset and F5 consume the same development configuration and upload path.
loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production")
require("ts-node").register({ compilerOptions: { module: "CommonJS" } })
require("tsconfig-paths/register")
require("../db/seeds")
