import { afterEach } from "vitest"
import { authorizationTestDb } from "./authorization/support/inMemoryPrisma"

// Tests use platform URLs unless a hosting-specific test overrides this configuration.
process.env.CMDB_HOSTING_MODE = "Platform"

afterEach(() => {
  authorizationTestDb.reset()
})
