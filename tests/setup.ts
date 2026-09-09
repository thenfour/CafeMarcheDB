import { afterEach } from "vitest"
import { authorizationTestDb } from "./authorization/support/inMemoryPrisma"

afterEach(() => {
  authorizationTestDb.reset()
})
