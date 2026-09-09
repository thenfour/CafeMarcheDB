import type { MutatorInput, QueryInput, xTableClientUsageContext } from "@db3/shared/db3core"

const forgedIntention = (): xTableClientUsageContext => ({
  intention: "admin",
  mode: "primary",
})

export function forgeDb3Query(
  tableID: string,
  overrides: Partial<QueryInput> = {},
): QueryInput {
  return {
    tableID,
    tableName: tableID,
    orderBy: undefined,
    filter: { items: [] },
    clientIntention: forgedIntention(),
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
    clientIntention: forgedIntention(),
    ...overrides,
  } as MutatorInput
}
