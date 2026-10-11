import type { MutatorInput, QueryRequestInput } from "@db3/shared/db3core"
import type { BandPublicId } from "shared/publicId"
import { userPublicId } from "tests/support/userFixtures"

// The retired request body is exercised under an explicit test authorization context.
type ScopedMutationInput = MutatorInput & { bandPublicId?: BandPublicId };

export function forgeDb3Query(
  tableID: string,
  bandPublicId: BandPublicId | null,
  overrides: Partial<QueryRequestInput> = {},
): QueryRequestInput {
  return {
    table: { tableID, tableName: tableID },
    bandPublicId,
    orderBy: undefined,
    filter: { items: [] },
    cmdbQueryContext: "authorization-test-forged-query",
    ...overrides,
  }
}

export function forgeDb3Update(
  tableID: string,
  bandPublicId: BandPublicId | null,
  updateId: number,
  updateModel: Record<string, unknown>,
  overrides: Partial<MutatorInput> = {},
): ScopedMutationInput {
  if (tableID === "User") return {
    ...(bandPublicId ? { bandPublicId } : {}),
    tableID,
    tableName: tableID,
    mutationType: "update",
    updatePublicId: userPublicId(updateId),
    updateModel,
    ...overrides,
  } as ScopedMutationInput // The forged body is validated by the resolver harness.
  return {
    ...(bandPublicId ? { bandPublicId } : {}),
    tableID,
    tableName: tableID,
    mutationType: "update",
    updateId,
    updateModel,
    ...overrides,
  } as ScopedMutationInput // The forged body is validated by the resolver harness.
}

export function forgeDb3PublicUpdate(
  tableID: string,
  bandPublicId: BandPublicId | null,
  updatePublicId: string,
  updateModel: Record<string, unknown>,
  overrides: Partial<MutatorInput> = {},
): ScopedMutationInput {
  return {
    ...(bandPublicId ? { bandPublicId } : {}),
    tableID,
    tableName: tableID,
    mutationType: "update",
    updatePublicId,
    updateModel,
    ...overrides,
  } as ScopedMutationInput // The forged body is validated by the resolver harness.
}

export function forgeDb3Insert(
  tableID: string,
  bandPublicId: BandPublicId | null,
  insertModel: Record<string, unknown>,
  overrides: Partial<MutatorInput> = {},
): ScopedMutationInput {
  return {
    ...(bandPublicId ? { bandPublicId } : {}),
    tableID,
    tableName: tableID,
    mutationType: "insert",
    insertModel,
    ...overrides,
  } as ScopedMutationInput // The forged body is validated by the resolver harness.
}

export function forgeDb3Delete(
  tableID: string,
  bandPublicId: BandPublicId | null,
  deleteId: number,
  deleteType: "softWhenPossible" | "hard" = "hard",
  overrides: Partial<MutatorInput> = {},
): ScopedMutationInput {
  if (tableID === "User") return {
    ...(bandPublicId ? { bandPublicId } : {}),
    tableID,
    tableName: tableID,
    mutationType: "delete",
    deletePublicId: userPublicId(deleteId),
    deleteType,
    ...overrides,
  } as ScopedMutationInput // The forged body is validated by the resolver harness.
  return {
    ...(bandPublicId ? { bandPublicId } : {}),
    tableID,
    tableName: tableID,
    mutationType: "delete",
    deleteId,
    deleteType,
    ...overrides,
  } as ScopedMutationInput // The forged body is validated by the resolver harness.
}

export function forgeDb3PublicDelete(
  tableID: string,
  bandPublicId: BandPublicId | null,
  deletePublicId: string,
  deleteType: "softWhenPossible" | "hard" = "hard",
  overrides: Partial<MutatorInput> = {},
): ScopedMutationInput {
  return {
    ...(bandPublicId ? { bandPublicId } : {}),
    tableID,
    tableName: tableID,
    mutationType: "delete",
    deletePublicId,
    deleteType,
    ...overrides,
  } as ScopedMutationInput // The forged body is validated by the resolver harness.
}
