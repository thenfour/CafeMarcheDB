import type { Resolver } from "@blitzjs/rpc"
import type { AuthenticatedCtx, Ctx } from "blitz"

export function invokeResolver<TInput, TResult>(
  resolver: Resolver<TInput, TResult>,
  input: TInput,
  ctx: Ctx | AuthenticatedCtx,
): Promise<TResult> {
  return resolver(input, ctx)
}
