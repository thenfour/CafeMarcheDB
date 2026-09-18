import { describe, expect, it } from "vitest"
import { Permission } from "shared/permissions"
import { PermissionSet } from "src/auth/shared/PermissionSet"

describe("PermissionSet", () => {
  const catalog = [{ id: 10, name: "view" }, { id: 20, name: "edit" }]

  it("accepts explicit empty grants and rejects missing or malformed grants", () => {
    expect(new PermissionSet([]).names).toEqual([])
    // @ts-expect-error Omitted grants are a programming error.
    expect(() => new PermissionSet()).toThrow("Effective permissions are required")
    // @ts-expect-error Records must carry both identity fields.
    expect(() => new PermissionSet([{ name: "view" }])).toThrow("IDs and names")
  })

  it("resolves serialized names to the corresponding database IDs", () => {
    const payload = JSON.parse(JSON.stringify({ names: ["edit", "unknown"], catalog }))
    const permissions = new PermissionSet(payload.names, payload.catalog)
    expect(permissions.names).toEqual(["edit"])
    expect(permissions.includesId(20)).toBe(true)
    expect(permissions.includesId(10)).toBe(false)
    expect(permissions.includesName("20")).toBe(false)
  })

  it("detects revoked grants as well as added grants without depending on order", () => {
    const permissions = new PermissionSet(catalog)
    expect(permissions.hasSameNames(["edit", "view", "view"])).toBe(true)
    expect(permissions.hasSameNames(["view"])).toBe(false)
    expect(permissions.hasSameNames(["edit", "view", "extra"])).toBe(false)
    expect(new PermissionSet([catalog[0]!]).hasSameNames(["view", "edit"])).toBe(false)
  })

  it("derives delegability from the canonical registry", () => {
    const actor = new PermissionSet([
      { id: 1, name: Permission.basic_trust },
      { id: 2, name: Permission.sysadmin },
    ])

    expect(actor.hasAllDelegable(new PermissionSet([
      { id: 1, name: Permission.basic_trust },
    ]))).toBe(true)
    expect(actor.hasAllDelegable(new PermissionSet([
      { id: 2, name: Permission.sysadmin },
    ]))).toBe(false)
    expect(actor.hasAllDelegable(new PermissionSet([
      { id: 3, name: "unknown_permission" },
    ]))).toBe(false)
  })
})
