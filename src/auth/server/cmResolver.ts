import type { AuthenticatedCtx, Ctx } from "blitz";
import { Permission } from "shared/permissions";
import { loadAuthorization, type CMServerAuthorization, type CMServerAuthorizationWithUser } from "./serverAuthorization";
import type { AuthorizationScopeSelection } from "./authorizationContext";

export type CMAuthCtx = Ctx & { readonly auth: CMServerAuthorization };
export type CMAuthCtxWithUser = AuthenticatedCtx & {
    readonly auth: CMServerAuthorizationWithUser;
};

interface ContextResult<TInput, TContext> {
    readonly __blitz: true;
    readonly value: TInput;
    readonly ctx: TContext;
}

type RequireUser = {
    readonly requireUser: true;
}
type DontRequireUser = {
    readonly requireUser?: false;
}

type CmauthorizeArgsCommon = {
    readonly permission: Permission;
    readonly scope?: AuthorizationScopeSelection;
}

type CmauthorizeArgsRequiringUser = CmauthorizeArgsCommon & RequireUser;
type CmauthorizeArgsNotRequiringUser = CmauthorizeArgsCommon & DontRequireUser;
type CmauthorizeArgs = CmauthorizeArgsCommon & (RequireUser | DontRequireUser);


export function cmauthorize(args: CmauthorizeArgsRequiringUser): <TInput>(input: TInput, ctx: Ctx) => ContextResult<TInput, CMAuthCtxWithUser>;
export function cmauthorize(args: CmauthorizeArgsNotRequiringUser): <TInput>(input: TInput, ctx: Ctx) => ContextResult<TInput, CMAuthCtx>;
export function cmauthorize(permission: Permission): <TInput>(input: TInput, ctx: Ctx) => ContextResult<TInput, CMAuthCtx>;
export function cmauthorize(argsOrPermission: CmauthorizeArgs | Permission) {
    const middleware = async <TInput>(input: TInput, ctx: Ctx) => {
        const auth = await loadAuthorization(ctx.session, typeof argsOrPermission === "object" ? argsOrPermission.scope : undefined);

        let permission: Permission;
        let requireUser: boolean;
        if (typeof argsOrPermission === "object") {
            permission = argsOrPermission.permission;
            requireUser = argsOrPermission.requireUser ?? false;
        } else {
            permission = argsOrPermission;
            requireUser = false;
        }

        auth.requirePermission(permission);

        if (requireUser) {
            const authenticatedAuth = auth.requireUser();
            return { __blitz: true as const, value: input, ctx: { ...ctx, auth: authenticatedAuth } };
        }
        return { __blitz: true as const, value: input, ctx: { ...ctx, auth } };
    };
    // Blitz 2 awaits middleware before reading __blitz, but its pipe types
    // describe context changes only for synchronous middleware.
    return middleware as unknown as <TInput>(input: TInput, ctx: Ctx) => ContextResult<TInput, CMAuthCtx>;
}
