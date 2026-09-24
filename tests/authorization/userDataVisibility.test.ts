import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("db", async () => {
  const prisma = await vi.importActual<typeof import("@prisma/client")>("@prisma/client")
  const { authorizationTestDb } = await import("./support/inMemoryPrisma")
  return { ...prisma, default: authorizationTestDb }
})

import { DefaultRolePermissionAssignments } from "shared/defaultRolePermissionAssignments"
import { Permission } from "shared/permissions"
import getUser from "src/core/db3/queries/getUser"
import getUserExtraInfo from "src/core/db3/queries/getUserExtraInfo"
import db3queries from "src/core/db3/queries/db3queries"
import { authorizationTestDb } from "./support/inMemoryPrisma"
import {
  createAuthorizationTestContext,
  createAuthorizationTestUser,
} from "./support/authorizationFixtures"
import { forgeDb3Query } from "./support/db3RequestBuilders"
import { invokeResolver } from "./support/resolverHarness"

const instrumentPublicId = "AbCdEfGhIjKlMn21"
const userTagPublicId = "UserTagPublic022"
const userTagAssignmentPublicId = "UserTagAsgn00012"
const targetInstrument = {
  id: 21,
  publicId: instrumentPublicId,
  name: "Trumpet",
  description: "",
  sortOrder: 1,
  functionalGroupId: 1,
  autoAssignFileLeafRegex: null,
}

const targetUserTag = {
  id: 22,
  publicId: userTagPublicId,
  text: "Singer",
  description: "Singing members",
  color: null,
  significance: null,
  sortOrder: 1,
  cssClass: null,
}

const owner = {
  ...createAuthorizationTestUser("normal", {
    id: 1_201,
    name: "Profile owner",
    email: "owner@test.invalid",
    phone: "+32 100",
    permissions: [Permission.login],
  }),
  instruments: [],
  tags: [],
  signInMethods: [{ id: 1, type: "google", identifier: "owner-google" }],
}

const target = {
  ...createAuthorizationTestUser("normal", {
    id: 1_202,
    name: "Directory target",
    email: "target@test.invalid",
    phone: "+32 200",
    cssClass: "target-user",
  }),
  instruments: [{
    id: 11,
    userId: 1_202,
    instrumentId: targetInstrument.id,
    instrument: targetInstrument,
    isPrimary: true,
  }],
  tags: [{
    id: 12,
    publicId: userTagAssignmentPublicId,
    userId: 1_202,
    userTagId: targetUserTag.id,
    userTag: targetUserTag,
  }],
  signInMethods: [{ id: 2, type: "google", identifier: "target-google" }],
  hashedPassword: "secret-password-hash",
}

const basicViewer = createAuthorizationTestUser("normal", {
  id: 1_203,
  permissions: [Permission.login, Permission.view_users_basic_info],
})

const contactViewer = createAuthorizationTestUser("normal", {
  id: 1_204,
  permissions: [
    Permission.login,
    Permission.view_users_basic_info,
    Permission.view_user_contact_info,
  ],
})

const userManager = createAuthorizationTestUser("bandAdmin", {
  id: 1_205,
  permissions: [
    Permission.login,
    Permission.view_users_basic_info,
    Permission.view_user_contact_info,
    Permission.manage_users,
  ],
})

async function queryTargetAs(actor: typeof basicViewer) {
  const result = await invokeResolver(
    db3queries,
    forgeDb3Query("User", {
      filter: { items: [], tableParams: { userId: target.id } },
    }),
    createAuthorizationTestContext(actor),
  )
  return result.items[0]
}

describe("focused user data visibility", () => {
  beforeEach(() => {
    authorizationTestDb.reset({
      user: [owner, target, basicViewer, contactViewer, userManager],
    })
  })

  it("lets an authenticated user read their own profile but not operational metadata", async () => {
    const result = await invokeResolver(
      db3queries,
      forgeDb3Query("User", {
        filter: { items: [], tableParams: { userId: owner.id } },
      }),
      createAuthorizationTestContext(owner),
    )

    expect(result.items).toHaveLength(1)
    expect(result.items[0]).toMatchObject({
      id: owner.id,
      name: owner.name,
      email: owner.email,
      phone: owner.phone,
      instruments: [],
      tags: [],
    })
    expect(result.items[0]).not.toHaveProperty("createdAt")
    expect(result.items[0]).not.toHaveProperty("isDeleted")
    expect(result.items[0]).not.toHaveProperty("isSysAdmin")
    expect(result.items[0]).not.toHaveProperty("role")
    expect(result.items[0]).not.toHaveProperty("roleId")
    expect(result.items[0]).not.toHaveProperty("signInMethods")
  })

  it("does not let login or search_users alone reveal another user", async () => {
    const searchOnly = createAuthorizationTestUser("normal", {
      id: owner.id,
      permissions: [Permission.login, Permission.search_users],
    })
    authorizationTestDb.reset({ user: [searchOnly, target] })

    await expect(
      invokeResolver(getUser, { userId: target.id }, createAuthorizationTestContext(searchOnly)),
    ).resolves.toBeNull()
  })

  it("returns only basic profile data for view_users_basic_info", async () => {
    const result = await invokeResolver(
      getUser,
      { userId: target.id },
      createAuthorizationTestContext(basicViewer),
    )

    expect(result).toMatchObject({
      id: target.id,
      name: target.name,
      cssClass: target.cssClass,
      instruments: [{
        id: 11,
        userId: target.id,
        instrumentId: instrumentPublicId,
        instrument: { publicId: instrumentPublicId },
        isPrimary: true,
      }],
      tags: [{
        publicId: userTagAssignmentPublicId,
        userId: target.id,
        userTagId: userTagPublicId,
        userTag: {
          publicId: userTagPublicId,
          text: targetUserTag.text,
        },
      }],
    })
    expect(result).not.toHaveProperty("email")
    expect(result).not.toHaveProperty("phone")
    expect(result).not.toHaveProperty("createdAt")
    expect(result).not.toHaveProperty("isDeleted")
    expect(result).not.toHaveProperty("isSysAdmin")
    expect(result).not.toHaveProperty("role")
    expect(result).not.toHaveProperty("roleId")
    expect(result).not.toHaveProperty("signInMethods")
    expect(result).not.toHaveProperty("hashedPassword")
  })

  it("adds contact fields only with view_user_contact_info", async () => {
    const result = await queryTargetAs(contactViewer)

    expect(result).toMatchObject({
      id: target.id,
      name: target.name,
      email: target.email,
      phone: target.phone,
    })
    expect(result).not.toHaveProperty("createdAt")
    expect(result).not.toHaveProperty("isDeleted")
    expect(result).not.toHaveProperty("isSysAdmin")
    expect(result).not.toHaveProperty("role")
    expect(result).not.toHaveProperty("roleId")
  })

  it("adds operational account metadata only with manage_users", async () => {
    const result = await queryTargetAs(userManager)

    expect(result).toMatchObject({
      id: target.id,
      name: target.name,
      email: target.email,
      phone: target.phone,
      createdAt: target.createdAt,
      isDeleted: target.isDeleted,
      isSysAdmin: target.isSysAdmin,
      roleId: target.roleId,
      role: target.role,
    })
    expect(result).not.toHaveProperty("signInMethods")
    expect(result).not.toHaveProperty("hashedPassword")
  })

  it("uses login for one's own coarse sign-in type and manage_users for another user", async () => {
    await expect(
      invokeResolver(getUserExtraInfo, { userId: owner.id }, createAuthorizationTestContext(owner)),
    ).resolves.toEqual({ signinMethods: ["google"] })

    await expect(
      invokeResolver(getUserExtraInfo, { userId: target.id }, createAuthorizationTestContext(basicViewer)),
    ).rejects.toThrow()

    await expect(
      invokeResolver(getUserExtraInfo, { userId: target.id }, createAuthorizationTestContext(userManager)),
    ).resolves.toEqual({ signinMethods: ["google"] })
  })

  it("keeps search and basic-view distinct while assigning them to the same default roles", () => {
    const rolesWith = (permission: Permission) => DefaultRolePermissionAssignments
      .filter(([, assignedPermission]) => assignedPermission === permission)
      .map(([roleName]) => roleName)
      .sort()

    expect(rolesWith(Permission.search_users)).toEqual(
      rolesWith(Permission.view_users_basic_info),
    )
    expect(rolesWith(Permission.view_users_basic_info)).toEqual([
      "Admin",
      "Band Admin",
      "Editors",
      "Moderators",
      "Normal Users",
    ])
  })
})
