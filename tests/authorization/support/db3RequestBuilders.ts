import type { MutatorInput, QueryRequestInput } from "@db3/shared/db3core"

export function forgeDb3Query(
  tableID: string,
  overrides: Partial<QueryRequestInput> = {},
): QueryRequestInput {
  return {
    tableID,
    tableName: tableID,
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
  return {
    tableID,
    tableName: tableID,
    mutationType: "update",
    updateId,
    updateModel,
    ...overrides,
  } as MutatorInput
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
