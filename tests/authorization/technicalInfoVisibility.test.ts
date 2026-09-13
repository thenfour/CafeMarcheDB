import { afterEach, describe, expect, it } from "vitest"
import { shouldShowAdminControls } from "shared/adminControls"
import { getClientServerState } from "shared/serverStateBase"

describe("BA-C003 technical information visibility", () => {
  const originalBaseUrl = process.env.CMDB_BASE_URL
  const originalVersionTag = process.env.CMDB_VERSION_TAG
  const originalGitRevision = process.env.CMDB_GIT_REVISION

  afterEach(() => {
    process.env.CMDB_BASE_URL = originalBaseUrl
    process.env.CMDB_VERSION_TAG = originalVersionTag
    process.env.CMDB_GIT_REVISION = originalGitRevision
  })

  it("requires both the Sysadmin permission and the explicit admin-control preference", () => {
    expect(shouldShowAdminControls(null)).toBe(false)
    expect(shouldShowAdminControls({ permissionNames: [], showAdminControls: true })).toBe(false)
    expect(shouldShowAdminControls({ permissionNames: ["sysadmin"], showAdminControls: false })).toBe(false)
    expect(shouldShowAdminControls({ permissionNames: ["sysadmin"], showAdminControls: true })).toBe(true)
  })

  it("does not send server version diagnostics to non-Sysadmins", () => {
    process.env.CMDB_BASE_URL = "https://example.test"
    process.env.CMDB_VERSION_TAG = "sensitive-version"
    process.env.CMDB_GIT_REVISION = "sensitive-revision"

    expect(getClientServerState(false)).toEqual({
      baseUri: "https://example.test",
      diagnostics: null,
    })
    expect(getClientServerState(true).diagnostics).toEqual(expect.objectContaining({
      versionTag: "sensitive-version",
      gitRevision: "sensitive-revision",
    }))
  })
})
