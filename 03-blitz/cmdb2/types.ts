import { EmptyPublicData, PublicData, SimpleRolesIsAuthorized } from "@blitzjs/auth"
import { SessionContext } from "@blitzjs/auth";
import { AuthenticatedMiddlewareCtx } from "blitz";
import { User } from "db"
import { Permission } from "shared/permissions";

type PublicDataType = {
  userId: User["id"],
  isSysAdmin: boolean,
  permissions: string[],
};

type CMAuthorizeArgs = {
  reason: string,
  permission?: Permission | null,
  publicData?: Partial<PublicDataType> | EmptyPublicData,
};

export function CMAuthorize(args: CMAuthorizeArgs) {
  console.assert(!!args.permission && args.permission.length, `CMAuthorize: Permission is invalid; Maybe a call was improperly made. args=${JSON.stringify(args)}`);
  console.assert(!!args.reason && args.reason.length, `CMAuthorize: Permission is invalid; this is required for diagnostics and tracing. Maybe a call was improperly made. args=${JSON.stringify(args)}`);
  const ret = (!!args.publicData?.userId) && (args.publicData?.isSysAdmin || args.publicData?.permissions?.some(p => p === args.permission));
  console.log(`********** CMAuthorize<${args.reason}> [${ret ? "AUTHORIZED" : "DENIED"}] perm:${args.permission} for user ${args.publicData?.userId || "<null>"} with perms ${JSON.stringify(args.publicData?.permissions || [])}`);
  return ret || false;
};

// intended only for use via resolver.authorize("reason", "an arg PermissionFindManyArgs"),
export function CMDBRolesIsAuthorized(params: any) {
  const publicData = (params.ctx.session as SessionContext).$publicData;
  const [reason, permission] = params.args;

  return CMAuthorize({ reason, permission, publicData });
}

// use instead of resolver.authorize
export function CMDBAuthorizeOrThrow(reason: string, permission: Permission, ctx: AuthenticatedMiddlewareCtx) {
  if (!CMAuthorize({ reason, permission, publicData: ctx.session.$publicData })) {
    throw new Error(`Unauthorized: ${reason}`);
  }
}

declare module "@blitzjs/auth" {
  export interface Session {
    isAuthorized: SimpleRolesIsAuthorized,//myRolesIsAuthorized
    PublicData: PublicDataType,
  }
}

export function CreatePublicData(user: any): PublicDataType {
  if (!user) {
    return {
      userId: 0, // numeric & falsy
      isSysAdmin: false,
      permissions: []
    };
  }
  return {
    userId: user.id,
    isSysAdmin: user.isSysAdmin,
    permissions: (user.role?.permissions)?.map(p => p.permission?.name) || [],
  };
};

