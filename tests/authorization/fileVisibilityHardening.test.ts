import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("db", async () => {
  const prisma = await vi.importActual<typeof import("@prisma/client")>("@prisma/client")
  const { authorizationTestDb } = await import("./support/inMemoryPrisma")
  return {
    ...prisma,
    default: authorizationTestDb,
  }
})

vi.mock("send", () => ({ default: vi.fn() }))

import send from "send"
import { Permission } from "shared/permissions"
import forkImage from "src/core/db3/mutations/forkImage"
import updateGalleryItemImage from "src/core/db3/mutations/updateGalleryItemImage"
import {
  ForkImageImpl,
  GetFileServerStoragePath,
} from "src/core/db3/server/db3mutationCore"
import {
  GetAuthorizedDirectDownloadFile,
  SendFileDownload,
} from "src/core/db3/server/fileDownload"
import type { ForkImageParams } from "src/core/db3/shared/fileTypes"
import {
  createAuthorizationPersona,
  createAuthorizationTestUser,
} from "./support/authorizationFixtures"
import { authorizationTestDb } from "./support/inMemoryPrisma"
import { invokeResolver } from "./support/resolverHarness"

const publicPermissionId = 700
const hiddenPermissionId = 799 // distinct from every grant in seedPublicRole()

const makeFile = (overrides: Record<string, unknown> = {}) => ({
  id: 10,
  fileLeafName: "photo.jpg",
  storedLeafName: "stored-photo.jpg",
  description: "",
  isDeleted: false,
  uploadedAt: new Date("2026-01-01T00:00:00.000Z"),
  uploadedByUserId: null,
  visiblePermissionId: publicPermissionId,
  visiblePermission: {
    id: publicPermissionId,
    name: Permission.visibility_public,
    roles: [],
  },
  ...overrides,
})

const makeGalleryItem = (overrides: Record<string, unknown> = {}) => ({
  id: 20,
  isDeleted: false,
  caption: "Gallery image",
  caption_nl: "",
  caption_fr: "",
  sortOrder: 0,
  fileId: 10,
  file: makeFile(),
  displayParams: "{}",
  createdByUserId: null,
  visiblePermissionId: publicPermissionId,
  visiblePermission: {
    id: publicPermissionId,
    name: Permission.visibility_public,
    roles: [],
  },
  ...overrides,
})

const imageParams: ForkImageParams = {
  parentFileId: 10,
  outputType: "jpg",
  quality: 80,
  editParams: {
    cropBegin: { x: 0, y: 0 },
    cropSize: null,
    rotate: 0,
  },
}

const seedPublicRole = () => ({
  id: 900,
  isPublicRole: true,
  permissions: [
    Permission.always_grant,
    Permission.public,
    Permission.visibility_public,
    Permission.view_events,
    Permission.view_files,
    Permission.practice_tools_use,
  ].map((name, index) => ({
    permissionId: name === Permission.visibility_public ? publicPermissionId : publicPermissionId + index + 1,
    permission: {
      id: name === Permission.visibility_public ? publicPermissionId : publicPermissionId + index + 1,
      name,
    },
  })),
})

describe("BA-S002 direct and parent-authorized file delivery", () => {
  beforeEach(() => {
    authorizationTestDb.reset({
      user: [],
      role: [seedPublicRole()],
      file: [],
      frontpageGalleryItem: [],
    })
  })

  it("allows only active, visible files through the direct download lookup", async () => {
    authorizationTestDb.reset({
      user: [],
      role: [seedPublicRole()],
      file: [
        makeFile(),
        makeFile({
          id: 11,
          storedLeafName: "hidden.jpg",
          visiblePermissionId: hiddenPermissionId,
          visiblePermission: {
            id: hiddenPermissionId,
            name: Permission.visibility_members,
            roles: [],
          },
        }),
        makeFile({ id: 12, storedLeafName: "deleted.jpg", isDeleted: true }),
      ],
    })
    const { ctx } = createAuthorizationPersona("public")

    await expect(GetAuthorizedDirectDownloadFile("stored-photo.jpg", ctx)).resolves.toEqual(
      expect.objectContaining({ id: 10 }),
    )
    await expect(GetAuthorizedDirectDownloadFile("hidden.jpg", ctx)).resolves.toBeNull()
    await expect(GetAuthorizedDirectDownloadFile("deleted.jpg", ctx)).resolves.toBeNull()
  })

  it("allows a private file only to its uploader", async () => {
    const owner = createAuthorizationTestUser("normal", {
      id: 30,
      permissions: [Permission.login, Permission.view_files, Permission.upload_files],
    })
    authorizationTestDb.reset({
      user: [owner],
      role: [seedPublicRole()],
      file: [makeFile({
        uploadedByUserId: owner.id,
        visiblePermissionId: null,
        visiblePermission: null,
      })],
    })

    const { ctx: ownerCtx } = createAuthorizationPersona("normal", {
      id: owner.id,
      permissions: [Permission.login, Permission.view_files, Permission.upload_files],
    })
    const { ctx: publicCtx } = createAuthorizationPersona("public")

    await expect(GetAuthorizedDirectDownloadFile("stored-photo.jpg", ownerCtx)).resolves.toEqual(
      expect.objectContaining({ id: 10 }),
    )
    await expect(GetAuthorizedDirectDownloadFile("stored-photo.jpg", publicCtx)).resolves.toBeNull()
  })

  it("retains the original request when delegating range-capable streaming", async () => {
    const previousUploadPath = process.env.FILE_UPLOAD_PATH
    process.env.FILE_UPLOAD_PATH = "C:\\file-storage"
    const handlers = new Map<string, () => void>()
    const stream = {
      on: vi.fn((event: string, handler: () => void) => {
        handlers.set(event, handler)
        return stream
      }),
      pipe: vi.fn(() => handlers.get("end")?.()),
    }
    vi.mocked(send).mockReturnValue(stream as any)
    const req = { headers: { range: "bytes=10-19" } } as any
    const res = {
      headersSent: false,
      setHeader: vi.fn(),
      status: vi.fn().mockReturnThis(),
      end: vi.fn(),
    } as any

    try {
      await SendFileDownload(req, res, makeFile())
    } finally {
      if (previousUploadPath === undefined) delete process.env.FILE_UPLOAD_PATH
      else process.env.FILE_UPLOAD_PATH = previousUploadPath
    }

    expect(send).toHaveBeenCalledWith(
      req,
      "stored-photo.jpg",
      expect.objectContaining({ dotfiles: "deny" }),
    )
    expect(req.headers.range).toBe("bytes=10-19")
  })

  it("rejects path-shaped storage names", () => {
    const previousUploadPath = process.env.FILE_UPLOAD_PATH
    process.env.FILE_UPLOAD_PATH = "C:\\file-storage"
    try {
      expect(() => GetFileServerStoragePath("../private.txt")).toThrow("Invalid stored file name")
      expect(() => GetFileServerStoragePath("folder/private.txt")).toThrow("Invalid stored file name")
      expect(() => GetFileServerStoragePath("folder\\private.txt")).toThrow("Invalid stored file name")
    } finally {
      if (previousUploadPath === undefined) delete process.env.FILE_UPLOAD_PATH
      else process.env.FILE_UPLOAD_PATH = previousUploadPath
    }
  })
})

describe("BA-S002 image mutation authorization", () => {
  beforeEach(() => {
    authorizationTestDb.reset({
      user: [],
      role: [seedPublicRole()],
      file: [],
      frontpageGalleryItem: [],
    })
  })

  it("requires upload authority at the generic fork resolver boundary", async () => {
    const actor = createAuthorizationTestUser("normal", { id: 40 })
    authorizationTestDb.reset({ user: [actor], role: [seedPublicRole()] })
    const { ctx } = createAuthorizationPersona("normal", { id: actor.id })
    const fileLookup = vi.spyOn(authorizationTestDb.getDelegate("file"), "findFirst")

    await expect(invokeResolver(forkImage, imageParams, ctx)).rejects.toThrow()
    expect(fileLookup).not.toHaveBeenCalled()
  })

  it("checks source visibility before image processing", async () => {
    const permissions = [Permission.login, Permission.view_files, Permission.upload_files]
    const actor = createAuthorizationTestUser("normal", { id: 41, permissions })
    authorizationTestDb.reset({
      user: [actor],
      role: [seedPublicRole()],
      file: [makeFile({
        visiblePermissionId: hiddenPermissionId,
        visiblePermission: {
          id: hiddenPermissionId,
          name: Permission.visibility_members,
          roles: [],
        },
      })],
    })
    const { ctx } = createAuthorizationPersona("normal", { id: actor.id, permissions })

    await expect(ForkImageImpl(imageParams, ctx as any)).rejects.toThrow("parent file not found")
    expect(authorizationTestDb.snapshot("file")).toHaveLength(1)
  })

  it("uses fresh database grants before looking up a fork source", async () => {
    const sessionPermissions = [
      Permission.login,
      Permission.view_files,
      Permission.upload_files,
    ]
    const databaseActor = createAuthorizationTestUser("normal", {
      id: 44,
      permissions: [Permission.login, Permission.view_files],
    })
    authorizationTestDb.reset({
      user: [databaseActor],
      role: [seedPublicRole()],
      file: [makeFile()],
    })
    const { ctx } = createAuthorizationPersona("normal", {
      id: databaseActor.id,
      permissions: sessionPermissions,
    })
    const fileLookup = vi.spyOn(authorizationTestDb.getDelegate("file"), "findFirst")

    await expect(ForkImageImpl(imageParams, ctx as any)).rejects.toThrow(
      "Not authorized to mutate File fields: insert",
    )
    expect(fileLookup).not.toHaveBeenCalled()
  })

  it("allows an authorized visible source through the pre-filesystem checks", async () => {
    const permissions = [
      Permission.login,
      Permission.view_files,
      Permission.upload_files,
      Permission.visibility_public,
    ]
    const actor = createAuthorizationTestUser("normal", { id: 46, permissions })
    const actorVisibilityId = actor.role!.permissions.find(
      entry => entry.permission.name === Permission.visibility_public,
    )!.permissionId
    authorizationTestDb.reset({
      user: [actor],
      role: [seedPublicRole()],
      file: [makeFile({
        visiblePermissionId: actorVisibilityId,
        visiblePermission: {
          id: actorVisibilityId,
          name: Permission.visibility_public,
          roles: [],
        },
      })],
    })
    const { ctx } = createAuthorizationPersona("normal", { id: actor.id, permissions })
    const previousUploadPath = process.env.FILE_UPLOAD_PATH
    delete process.env.FILE_UPLOAD_PATH

    try {
      await expect(ForkImageImpl(imageParams, ctx as any)).rejects.toThrow(
        "FILE_UPLOAD_PATH is not configured",
      )
    } finally {
      if (previousUploadPath !== undefined) process.env.FILE_UPLOAD_PATH = previousUploadPath
    }
  })

  it("requires gallery edit authority before target or source lookup", async () => {
    const actor = createAuthorizationTestUser("bandAdmin", { id: 42 })
    authorizationTestDb.reset({ user: [actor], role: [seedPublicRole()] })
    const { ctx } = createAuthorizationPersona("bandAdmin", { id: actor.id })
    const galleryLookup = vi.spyOn(
      authorizationTestDb.getDelegate("frontpageGalleryItem"),
      "findFirst",
    )
    const fileLookup = vi.spyOn(authorizationTestDb.getDelegate("file"), "findFirst")

    await expect(invokeResolver(
      updateGalleryItemImage,
      { galleryItemId: 20, imageParams },
      ctx,
    )).rejects.toThrow()
    expect(galleryLookup).not.toHaveBeenCalled()
    expect(fileLookup).not.toHaveBeenCalled()
  })

  it("verifies the gallery target before starting a fork", async () => {
    const permissions = [
      Permission.login,
      Permission.edit_public_homepage,
      Permission.view_files,
      Permission.upload_files,
    ]
    const actor = createAuthorizationTestUser("normal", { id: 43, permissions })
    authorizationTestDb.reset({ user: [actor], role: [seedPublicRole()] })
    const { ctx } = createAuthorizationPersona("normal", { id: actor.id, permissions })
    const fileLookup = vi.spyOn(authorizationTestDb.getDelegate("file"), "findFirst")

    await expect(invokeResolver(
      updateGalleryItemImage,
      { galleryItemId: 999, imageParams },
      ctx,
    )).rejects.toThrow("Gallery item was not found")
    expect(fileLookup).not.toHaveBeenCalled()
  })

  it("uses fresh database grants before starting a gallery image fork", async () => {
    const sessionPermissions = [
      Permission.login,
      Permission.edit_public_homepage,
      Permission.view_files,
      Permission.upload_files,
    ]
    const databaseActor = createAuthorizationTestUser("normal", {
      id: 45,
      permissions: [Permission.login, Permission.view_files, Permission.upload_files],
    })
    authorizationTestDb.reset({
      user: [databaseActor],
      role: [seedPublicRole()],
      frontpageGalleryItem: [makeGalleryItem()],
      file: [makeFile()],
    })
    const { ctx } = createAuthorizationPersona("normal", {
      id: databaseActor.id,
      permissions: sessionPermissions,
    })
    const fileLookup = vi.spyOn(authorizationTestDb.getDelegate("file"), "findFirst")

    await expect(invokeResolver(
      updateGalleryItemImage,
      { galleryItemId: 20, imageParams },
      ctx,
    )).rejects.toThrow("Not authorized to mutate FrontpageGalleryItem")
    expect(fileLookup).not.toHaveBeenCalled()
  })
})
