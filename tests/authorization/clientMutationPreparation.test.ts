import { describe, expect, it } from "vitest"

import { omitUnauthorizedMutationFields } from "src/core/db3/components/DB3ClientCore"
import { xUser } from "src/core/db3/shared/schema/user"
import {
  createAuthorizationPersona,
  createAuthorizationTestUser,
} from "./support/authorizationFixtures"

describe("DB3 client mutation preparation", () => {
  const target = createAuthorizationTestUser("normal", { id: 10 })
  const clientIntention = { intention: "user", mode: "primary" } as const

  it("omits viewable login fields while retaining an authorized user-tag edit", () => {
    const { publicData } = createAuthorizationPersona("bandAdmin", { id: 2 })
    const tags = [{ id: 1, userId: target.id, userTagId: 7 }]

    const result = omitUnauthorizedMutationFields({
      schema: xUser,
      model: {
        id: target.id,
        email: target.email,
        tags,
      },
      existingModel: target,
      mode: "update",
      clientIntention,
      publicData,
    })

    expect(result).toEqual({
      tags,
    })
  })

  it("covers profile edits by omitting email while retaining owner-editable fields", () => {
    const { publicData } = createAuthorizationPersona("normal", { id: target.id })

    const result = omitUnauthorizedMutationFields({
      schema: xUser,
      model: {
        id: target.id,
        name: "Updated name",
        email: target.email,
        phone: "+32 123",
      },
      existingModel: target,
      mode: "update",
      clientIntention,
      publicData,
    })

    expect(result).toEqual({
      name: "Updated name",
      phone: "+32 123",
    })
  })

  it("preserves unknown fields so the server can reject schema drift", () => {
    const { publicData } = createAuthorizationPersona("bandAdmin", { id: 2 })

    const result = omitUnauthorizedMutationFields({
      schema: xUser,
      model: {
        id: target.id,
        unexpectedField: "must not disappear",
      },
      existingModel: target,
      mode: "update",
      clientIntention,
      publicData,
    })

    expect(result).toEqual({
      unexpectedField: "must not disappear",
    })
  })
})
