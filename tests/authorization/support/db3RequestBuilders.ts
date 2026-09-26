import type { MutatorInput, QueryRequestInput } from "@db3/shared/db3core"
import { userPublicId } from "tests/support/userFixtures"

export function forgeDb3Query(
  tableID: string,
  overrides: Partial<QueryRequestInput> = {},
): QueryRequestInput {
  return {
    table: { tableID, tableName: tableID },
    orderBy: undefined,
    filter: { items: [] },
    cmdbQueryContext: "authorization-test-forged-query",
    ...overrides,
  }
}

export function forgeDb3Update(
  tableID: string,
  updateId: number,
  updateModel: Record<string, unknown>,
  overrides: Partial<MutatorInput> = {},
): MutatorInput {
  if (tableID === "User") return {
    tableID,
    tableName: tableID,
    mutationType: "update",
    updatePublicId: userPublicId(updateId),
    updateModel,
    ...overrides,
  } as MutatorInput // Test builder converts trusted fixture IDs to client identity.
  return {
    tableID,
    tableName: tableID,
    mutationType: "update",
    updateId,
    updateModel,
    ...overrides,
  } as MutatorInput
}

export function forgeDb3PublicUpdate(
  tableID: string,
  updatePublicId: string,
  updateModel: Record<string, unknown>,
  overrides: Partial<MutatorInput> = {},
): MutatorInput {
  return {
    tableID,
    tableName: tableID,
    mutationType: "update",
    updatePublicId,
    updateModel,
    ...overrides,
  } as MutatorInput // Test builders intentionally construct requests before runtime table validation.
}

export function forgeDb3Insert(
  tableID: string,
  insertModel: Record<string, unknown>,
  overrides: Partial<MutatorInput> = {},
): MutatorInput {
  return {
    tableID,
    tableName: tableID,
    mutationType: "insert",
    insertModel,
    ...overrides,
  } as MutatorInput
}

export function forgeDb3Delete(
  tableID: string,
  deleteId: number,
  deleteType: "softWhenPossible" | "hard" = "hard",
  overrides: Partial<MutatorInput> = {},
): MutatorInput {
  if (tableID === "User") return {
    tableID,
    tableName: tableID,
    mutationType: "delete",
    deletePublicId: userPublicId(deleteId),
    deleteType,
    ...overrides,
  } as MutatorInput // Test builder converts trusted fixture IDs to client identity.
  return {
    tableID,
    tableName: tableID,
    mutationType: "delete",
    deleteId,
    deleteType,
    ...overrides,
  } as MutatorInput
}

export function forgeDb3PublicDelete(
  tableID: string,
  deletePublicId: string,
  deleteType: "softWhenPossible" | "hard" = "hard",
  overrides: Partial<MutatorInput> = {},
): MutatorInput {
  return {
    tableID,
    tableName: tableID,
    mutationType: "delete",
    deletePublicId,
    deleteType,
    ...overrides,
  } as MutatorInput // Test builders intentionally construct requests before runtime table validation.
}
