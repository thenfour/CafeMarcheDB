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
import { loadAuthorization } from "src/auth/server/serverAuthorization"
import {
  GetFileServerStoragePath,
} from "src/core/db3/server/db3mutationCore"
import {
  GetAuthorizedDirectDownloadFile,
  SendFileDownload,
  ServeAuthorizedFileDownload,
} from "src/core/db3/server/fileDownload"
import { filePublicId } from "../support/fileFixtures"
import {
  createAuthorizationPersona,
  createAuthorizationTestUser,
} from "./support/authorizationFixtures"
import { authorizationTestDb } from "./support/inMemoryPrisma"

const publicPermissionId = 700
const hiddenPermissionId = 799 // distinct from every grant in seedPublicRole()

const makeFile = (overrides: Record<string, unknown> = {}) => ({
  id: 10,
  publicId: filePublicId(10),
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

    await expect(GetAuthorizedDirectDownloadFile("stored-photo.jpg", await loadAuthorization(ctx.session))).resolves.toEqual(
      expect.objectContaining({ publicId: filePublicId(10) }),
    )
    await expect(GetAuthorizedDirectDownloadFile("hidden.jpg", await loadAuthorization(ctx.session))).resolves.toBeNull()
    await expect(GetAuthorizedDirectDownloadFile("deleted.jpg", await loadAuthorization(ctx.session))).resolves.toBeNull()
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

    await expect(GetAuthorizedDirectDownloadFile("stored-photo.jpg", await loadAuthorization(ownerCtx.session))).resolves.toEqual(
      expect.objectContaining({ publicId: filePublicId(10) }),
    )
    await expect(GetAuthorizedDirectDownloadFile("stored-photo.jpg", await loadAuthorization(publicCtx.session))).resolves.toBeNull()
  })

  it("streams HTML at an alias only for the same viewers as the file URL", async () => {
    const owner = createAuthorizationTestUser("normal", {
      id: 30,
      permissions: [Permission.login, Permission.view_files, Permission.upload_files],
    })
    authorizationTestDb.reset({
      user: [owner],
      role: [seedPublicRole()],
      file: [makeFile({
        fileLeafName: "mypage.html",
        storedLeafName: "stored-page.html",
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
    // The send mock only needs the event and pipe methods used by the streamer.
    vi.mocked(send).mockReturnValue(stream as ReturnType<typeof send>)
    const req = { headers: { range: "bytes=10-19" }, url: "/MyPage" }
    const response = () => ({ statusCode: 200, headersSent: false, setHeader: vi.fn(), end: vi.fn() })
    const publicRes = response()
    const ownerRes = response()

    try {
      // These request and response objects expose the Node members used here.
      await ServeAuthorizedFileDownload(req as Parameters<typeof ServeAuthorizedFileDownload>[0], publicRes as unknown as Parameters<typeof ServeAuthorizedFileDownload>[1], await loadAuthorization(publicCtx.session), "stored-page.html")
      expect(publicRes.statusCode).toBe(404)
      expect(publicRes.end).toHaveBeenCalledOnce()
      expect(send).not.toHaveBeenCalled()

      await ServeAuthorizedFileDownload(req as Parameters<typeof ServeAuthorizedFileDownload>[0], ownerRes as unknown as Parameters<typeof ServeAuthorizedFileDownload>[1], await loadAuthorization(ownerCtx.session), "stored-page.html")
    } finally {
      if (previousUploadPath === undefined) delete process.env.FILE_UPLOAD_PATH
      else process.env.FILE_UPLOAD_PATH = previousUploadPath
    }

    expect(send).toHaveBeenCalledWith(req, "stored-page.html", expect.any(Object))
    expect(ownerRes.setHeader).toHaveBeenCalledWith("Content-Type", "text/html")
    expect(ownerRes.setHeader).toHaveBeenCalledWith("Content-Disposition", expect.stringContaining("inline;"))
    expect(req.headers.range).toBe("bytes=10-19")
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

// MIGRATION_RESTORE: file-creation
// Source: 1bea5a730d2f3a8c20b490681360e1c698403523:tests/authorization/fileVisibilityHardening.test.ts:17-18
// Reason: Upload and image-creation paths omit band ownership, use removed global tag/instrument models and person associations, and depend on unfinished File row contracts.
// Restore: Restore multipart/external-URL uploads, public-ID band-owned associations, automatic Partition/Recording and instrument matching, image crop/rotate/resize, metadata processing, gallery bake and generic File creation with fresh transactional authorization, filesystem cleanup and localized controls; retain download behavior.
// Verification: Reactivate image authorization specifications; verify two bands, independent grants and revocation, hidden/foreign parents and associations, inactive memberships/catalogs, multipart failures and limits, file/URL/paste/drop uploads, image transforms/metadata, rollback and storage cleanup, public DTOs and built-browser workflows.
// SHA256: c0888281802b7a755c2807fd6b32544eb28208e22b3ce5dc5b784cdc36ae93cb
// MIGRATION_REFERENCE_BEGIN
// import forkImage from "src/core/db3/mutations/forkImage"
// import updateGalleryItemImage from "src/core/db3/mutations/updateGalleryItemImage"
// MIGRATION_REFERENCE_END

// MIGRATION_RESTORE: file-creation
// Source: 1bea5a730d2f3a8c20b490681360e1c698403523:tests/authorization/fileVisibilityHardening.test.ts:20-20
// Reason: Upload and image-creation paths omit band ownership, use removed global tag/instrument models and person associations, and depend on unfinished File row contracts.
// Restore: Restore multipart/external-URL uploads, public-ID band-owned associations, automatic Partition/Recording and instrument matching, image crop/rotate/resize, metadata processing, gallery bake and generic File creation with fresh transactional authorization, filesystem cleanup and localized controls; retain download behavior.
// Verification: Reactivate image authorization specifications; verify two bands, independent grants and revocation, hidden/foreign parents and associations, inactive memberships/catalogs, multipart failures and limits, file/URL/paste/drop uploads, image transforms/metadata, rollback and storage cleanup, public DTOs and built-browser workflows.
// SHA256: e20ff017eec5f94f042f117f6aa4d038168a80e24ce27bb36940f7c3a495d03c
// MIGRATION_REFERENCE_BEGIN
//   ForkImageImpl,
// MIGRATION_REFERENCE_END

// MIGRATION_RESTORE: file-creation
// Source: 1bea5a730d2f3a8c20b490681360e1c698403523:tests/authorization/fileVisibilityHardening.test.ts:28-28
// Reason: Upload and image-creation paths omit band ownership, use removed global tag/instrument models and person associations, and depend on unfinished File row contracts.
// Restore: Restore multipart/external-URL uploads, public-ID band-owned associations, automatic Partition/Recording and instrument matching, image crop/rotate/resize, metadata processing, gallery bake and generic File creation with fresh transactional authorization, filesystem cleanup and localized controls; retain download behavior.
// Verification: Reactivate image authorization specifications; verify two bands, independent grants and revocation, hidden/foreign parents and associations, inactive memberships/catalogs, multipart failures and limits, file/URL/paste/drop uploads, image transforms/metadata, rollback and storage cleanup, public DTOs and built-browser workflows.
// SHA256: d8a13be9208927d57afdac117527b39a5817d8d01d6c741732e3f643ec1796c7
// MIGRATION_REFERENCE_BEGIN
// import type { ForkImageParams } from "src/core/db3/shared/fileTypes"
// MIGRATION_REFERENCE_END

// MIGRATION_RESTORE: file-creation
// Source: 1bea5a730d2f3a8c20b490681360e1c698403523:tests/authorization/fileVisibilityHardening.test.ts:30-30
// Reason: Upload and image-creation paths omit band ownership, use removed global tag/instrument models and person associations, and depend on unfinished File row contracts.
// Restore: Restore multipart/external-URL uploads, public-ID band-owned associations, automatic Partition/Recording and instrument matching, image crop/rotate/resize, metadata processing, gallery bake and generic File creation with fresh transactional authorization, filesystem cleanup and localized controls; retain download behavior.
// Verification: Reactivate image authorization specifications; verify two bands, independent grants and revocation, hidden/foreign parents and associations, inactive memberships/catalogs, multipart failures and limits, file/URL/paste/drop uploads, image transforms/metadata, rollback and storage cleanup, public DTOs and built-browser workflows.
// SHA256: c3adbf7785388a6a6db3f8bfddcc45cd07b0f86eb58d8b103051ed4a8cd842e6
// MIGRATION_REFERENCE_BEGIN
// import { galleryPublicId } from "../support/galleryFixtures"
// MIGRATION_REFERENCE_END

// MIGRATION_RESTORE: file-creation
// Source: 1bea5a730d2f3a8c20b490681360e1c698403523:tests/authorization/fileVisibilityHardening.test.ts:36-36
// Reason: Upload and image-creation paths omit band ownership, use removed global tag/instrument models and person associations, and depend on unfinished File row contracts.
// Restore: Restore multipart/external-URL uploads, public-ID band-owned associations, automatic Partition/Recording and instrument matching, image crop/rotate/resize, metadata processing, gallery bake and generic File creation with fresh transactional authorization, filesystem cleanup and localized controls; retain download behavior.
// Verification: Reactivate image authorization specifications; verify two bands, independent grants and revocation, hidden/foreign parents and associations, inactive memberships/catalogs, multipart failures and limits, file/URL/paste/drop uploads, image transforms/metadata, rollback and storage cleanup, public DTOs and built-browser workflows.
// SHA256: a7813770a983bacec4b13972b22a922e15ce5c421ffcfcfebc3a07f70849d3ef
// MIGRATION_REFERENCE_BEGIN
// import { invokeResolver } from "./support/resolverHarness"
// MIGRATION_REFERENCE_END

// MIGRATION_RESTORE: file-creation
// Source: 1bea5a730d2f3a8c20b490681360e1c698403523:tests/authorization/fileVisibilityHardening.test.ts:59-90
// Reason: Upload and image-creation paths omit band ownership, use removed global tag/instrument models and person associations, and depend on unfinished File row contracts.
// Restore: Restore multipart/external-URL uploads, public-ID band-owned associations, automatic Partition/Recording and instrument matching, image crop/rotate/resize, metadata processing, gallery bake and generic File creation with fresh transactional authorization, filesystem cleanup and localized controls; retain download behavior.
// Verification: Reactivate image authorization specifications; verify two bands, independent grants and revocation, hidden/foreign parents and associations, inactive memberships/catalogs, multipart failures and limits, file/URL/paste/drop uploads, image transforms/metadata, rollback and storage cleanup, public DTOs and built-browser workflows.
// SHA256: d829f48bf5b30ad0c86fafc1de0f7d5a452dac09cf5530ce3db97974645d9cc3
// MIGRATION_REFERENCE_BEGIN
// const makeGalleryItem = (overrides: Record<string, unknown> = {}) => ({
//   id: 20,
//   publicId: galleryPublicId(20),
//   isDeleted: false,
//   caption: "Gallery image",
//   caption_nl: "",
//   caption_fr: "",
//   sortOrder: 0,
//   fileId: 10,
//   file: makeFile(),
//   displayParams: "{}",
//   createdByUserId: null,
//   visiblePermissionId: publicPermissionId,
//   visiblePermission: {
//     id: publicPermissionId,
//     name: Permission.visibility_public,
//     roles: [],
//   },
//   ...overrides,
// })
//
// const imageParams: ForkImageParams = {
//   parentFileId: filePublicId(10),
//   outputType: "jpg",
//   quality: 80,
//   editParams: {
//     cropBegin: { x: 0, y: 0 },
//     cropSize: null,
//     rotate: 0,
//   },
// }
//
// MIGRATION_REFERENCE_END

// MIGRATION_RESTORE: file-creation
// Source: 1bea5a730d2f3a8c20b490681360e1c698403523:tests/authorization/fileVisibilityHardening.test.ts:281-454
// Reason: Upload and image-creation paths omit band ownership, use removed global tag/instrument models and person associations, and depend on unfinished File row contracts.
// Restore: Restore multipart/external-URL uploads, public-ID band-owned associations, automatic Partition/Recording and instrument matching, image crop/rotate/resize, metadata processing, gallery bake and generic File creation with fresh transactional authorization, filesystem cleanup and localized controls; retain download behavior.
// Verification: Reactivate image authorization specifications; verify two bands, independent grants and revocation, hidden/foreign parents and associations, inactive memberships/catalogs, multipart failures and limits, file/URL/paste/drop uploads, image transforms/metadata, rollback and storage cleanup, public DTOs and built-browser workflows.
// SHA256: ef82ffd39cd8cf76c424581997124314da0961b30939c3cf66f8aa071fda2622
// MIGRATION_REFERENCE_BEGIN
// describe("BA-S002 image mutation authorization", () => {
//   beforeEach(() => {
//     authorizationTestDb.reset({
//       user: [],
//       role: [seedPublicRole()],
//       file: [],
//       frontpageGalleryItem: [],
//     })
//   })
//
//   it("requires upload authority at the generic fork resolver boundary", async () => {
//     const actor = createAuthorizationTestUser("normal", { id: 40 })
//     authorizationTestDb.reset({ user: [actor], role: [seedPublicRole()] })
//     const { ctx } = createAuthorizationPersona("normal", { id: actor.id })
//     const fileLookup = vi.spyOn(authorizationTestDb.getDelegate("file"), "findFirst")
//
//     await expect(invokeResolver(forkImage, imageParams, ctx)).rejects.toThrow()
//     expect(fileLookup).not.toHaveBeenCalled()
//   })
//
//   it("checks source visibility before image processing", async () => {
//     const permissions = [Permission.login, Permission.view_files, Permission.upload_files]
//     const actor = createAuthorizationTestUser("normal", { id: 41, permissions })
//     authorizationTestDb.reset({
//       user: [actor],
//       role: [seedPublicRole()],
//       file: [makeFile({
//         visiblePermissionId: hiddenPermissionId,
//         visiblePermission: {
//           id: hiddenPermissionId,
//           name: Permission.visibility_members,
//           roles: [],
//         },
//       })],
//     })
//     const { ctx } = createAuthorizationPersona("normal", { id: actor.id, permissions })
//
//     await expect(ForkImageImpl(imageParams, (await loadAuthorization(ctx.session)).requireUser())).rejects.toThrow("parent file not found")
//     expect(authorizationTestDb.snapshot("file")).toHaveLength(1)
//   })
//
//   it("uses fresh database grants before looking up a fork source", async () => {
//     const sessionPermissions = [
//       Permission.login,
//       Permission.view_files,
//       Permission.upload_files,
//     ]
//     const databaseActor = createAuthorizationTestUser("normal", {
//       id: 44,
//       permissions: [Permission.login, Permission.view_files],
//     })
//     authorizationTestDb.reset({
//       user: [databaseActor],
//       role: [seedPublicRole()],
//       file: [makeFile()],
//     })
//     const { ctx } = createAuthorizationPersona("normal", {
//       id: databaseActor.id,
//       permissions: sessionPermissions,
//     })
//     const fileLookup = vi.spyOn(authorizationTestDb.getDelegate("file"), "findFirst")
//
//     await expect(ForkImageImpl(imageParams, (await loadAuthorization(ctx.session)).requireUser())).rejects.toThrow(
//       "Not authorized to mutate File fields: insert",
//     )
//     expect(fileLookup).not.toHaveBeenCalled()
//   })
//
//   it("allows an authorized visible source through the pre-filesystem checks", async () => {
//     const permissions = [
//       Permission.login,
//       Permission.view_files,
//       Permission.upload_files,
//       Permission.visibility_public,
//     ]
//     const actor = createAuthorizationTestUser("normal", { id: 46, permissions })
//     const actorVisibilityId = actor.role!.permissions.find(
//       entry => entry.permission.name === Permission.visibility_public,
//     )!.permissionId
//     authorizationTestDb.reset({
//       user: [actor],
//       role: [seedPublicRole()],
//       file: [makeFile({
//         visiblePermissionId: actorVisibilityId,
//         visiblePermission: {
//           id: actorVisibilityId,
//           name: Permission.visibility_public,
//           roles: [],
//         },
//       })],
//     })
//     const { ctx } = createAuthorizationPersona("normal", { id: actor.id, permissions })
//     const previousUploadPath = process.env.FILE_UPLOAD_PATH
//     delete process.env.FILE_UPLOAD_PATH
//
//     try {
//       await expect(ForkImageImpl(imageParams, (await loadAuthorization(ctx.session)).requireUser())).rejects.toThrow(
//         "FILE_UPLOAD_PATH is not configured",
//       )
//     } finally {
//       if (previousUploadPath !== undefined) process.env.FILE_UPLOAD_PATH = previousUploadPath
//     }
//   })
//
//   it("requires gallery edit authority before target or source lookup", async () => {
//     const actor = createAuthorizationTestUser("bandAdmin", { id: 42 })
//     authorizationTestDb.reset({ user: [actor], role: [seedPublicRole()] })
//     const { ctx } = createAuthorizationPersona("bandAdmin", { id: actor.id })
//     const galleryLookup = vi.spyOn(
//       authorizationTestDb.getDelegate("frontpageGalleryItem"),
//       "findFirst",
//     )
//     const fileLookup = vi.spyOn(authorizationTestDb.getDelegate("file"), "findFirst")
//
//     await expect(invokeResolver(
//       updateGalleryItemImage,
//       { galleryItemId: galleryPublicId(20), imageParams },
//       ctx,
//     )).rejects.toThrow()
//     expect(galleryLookup).not.toHaveBeenCalled()
//     expect(fileLookup).not.toHaveBeenCalled()
//   })
//
//   it("verifies the gallery target before starting a fork", async () => {
//     const permissions = [
//       Permission.login,
//       Permission.edit_public_homepage,
//       Permission.view_files,
//       Permission.upload_files,
//     ]
//     const actor = createAuthorizationTestUser("normal", { id: 43, permissions })
//     authorizationTestDb.reset({ user: [actor], role: [seedPublicRole()] })
//     const { ctx } = createAuthorizationPersona("normal", { id: actor.id, permissions })
//     const fileLookup = vi.spyOn(authorizationTestDb.getDelegate("file"), "findFirst")
//
//     await expect(invokeResolver(
//       updateGalleryItemImage,
//       { galleryItemId: galleryPublicId(999), imageParams },
//       ctx,
//     )).rejects.toThrow("Gallery item was not found")
//     expect(fileLookup).not.toHaveBeenCalled()
//   })
//
//   it("uses fresh database grants before starting a gallery image fork", async () => {
//     const sessionPermissions = [
//       Permission.login,
//       Permission.edit_public_homepage,
//       Permission.view_files,
//       Permission.upload_files,
//     ]
//     const databaseActor = createAuthorizationTestUser("normal", {
//       id: 45,
//       permissions: [Permission.login, Permission.view_files, Permission.upload_files],
//     })
//     authorizationTestDb.reset({
//       user: [databaseActor],
//       role: [seedPublicRole()],
//       frontpageGalleryItem: [makeGalleryItem()],
//       file: [makeFile()],
//     })
//     const { ctx } = createAuthorizationPersona("normal", {
//       id: databaseActor.id,
//       permissions: sessionPermissions,
//     })
//     const fileLookup = vi.spyOn(authorizationTestDb.getDelegate("file"), "findFirst")
//
//     await expect(invokeResolver(
//       updateGalleryItemImage,
//       { galleryItemId: galleryPublicId(20), imageParams },
//       ctx,
//     )).rejects.toThrow("Not authorized to mutate FrontpageGalleryItem")
//     expect(fileLookup).not.toHaveBeenCalled()
//   })
// })
// MIGRATION_REFERENCE_END
