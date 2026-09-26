import { resolver as blitzResolver } from "@blitzjs/rpc";
import type { AuthenticatedCtx, Ctx } from "blitz";
import { Permission } from "shared/permissions";
import type { UserWithRolesPayload } from "src/core/db3/shared/schema/userPayloads";
import { loadAuthorization, type CMAuthorization } from "./requestAuthorization";

export type CMCtx = Ctx & { readonly auth: CMAuthorization };
export type CMAuthenticatedCtx = AuthenticatedCtx & {
    readonly auth: CMAuthorization & { readonly user: UserWithRolesPayload };
};

interface ContextResult<TInput, TContext> {
    readonly __blitz: true;
    readonly value: TInput;
    readonly ctx: TContext;
}

function cmauthorize(permission: typeof Permission.login): <TInput>(input: TInput, ctx: Ctx) => ContextResult<TInput, CMAuthenticatedCtx>;
function cmauthorize(permission: Permission): <TInput>(input: TInput, ctx: Ctx) => ContextResult<TInput, CMCtx>;
function cmauthorize(permission: Permission) {
    const middleware = async <TInput>(input: TInput, ctx: Ctx) => {
        const auth = await loadAuthorization(ctx.session);
        auth.requirePermission(permission);
        const nextContext = { ...ctx, auth };
        if (permission === Permission.login) {
            // requirePermission verified the active user and login grant.
            return { __blitz: true as const, value: input, ctx: nextContext as CMAuthenticatedCtx };
        }
        return { __blitz: true as const, value: input, ctx: nextContext };
    };
    // Blitz 2 awaits middleware before reading __blitz, but its pipe types
    // describe context changes only for synchronous middleware.
    return middleware as unknown as <TInput>(input: TInput, ctx: Ctx) => ContextResult<TInput, CMCtx>;
}

export const resolver = { ...blitzResolver, cmauthorize };
