import { BlitzCtx, EmptyPublicData, PublicData, SimpleRolesIsAuthorized } from "@blitzjs/auth"
import { SessionContext } from "@blitzjs/auth";
import { AuthenticatedCtx, RequestMiddleware, assert } from "blitz";
import db, { Prisma, User } from "db"
import { Permission, gPublicPermissions } from "shared/permissions";
import { Ctx } from "@blitzjs/next";


export type PublicDataType = {
  userId: User["id"],
  impersonatingFromUserId?: User["id"],
  isSysAdmin: boolean,
  permissions: string[],
  permissionsLastRefreshedAt: string, // iso utc string new Date().toISOString()

  showAdminControls: boolean; // show things like editing chrome content (SettingMarkdown etc)
};

export type CMAuthorize2Args = {
  reason: string,
  permission: Permission | null,

  isSysAdmin: boolean,
  userPermissions: string[],
  userId: number | null;
};

export function CMAuthorize2(args: CMAuthorize2Args) {
  assert(!!args.permission && args.permission.length, `CMAuthorize: Permission is invalid; Maybe a call was improperly made. args=${JSON.stringify(args)}`);
  assert(!!args.reason && args.reason.length, `CMAuthorize: Permission is invalid; this is required for diagnostics and tracing. Maybe a call was improperly made. args=${JSON.stringify(args)}`);
  const ret = (!!args.userId) && (args.isSysAdmin || args.userPermissions.some(p => p === args.permission));

  return ret || false;
};

type CMAuthorizeArgs = {
  reason: string,
  permission: Permission | null,
  publicData: Partial<PublicDataType> | EmptyPublicData,
};

export function CMAuthorize(args: CMAuthorizeArgs) {
  return CMAuthorize2({
    isSysAdmin: args.publicData.isSysAdmin || false,
    userPermissions: args.publicData.permissions || [],
    reason: args.reason,
    permission: args.permission,
    userId: args.publicData.userId || null,
  });
};

export function CMDBAuthorizeOrThrow(reason: string, permission: Permission, ctx: AuthenticatedCtx) {
  if (!CMAuthorize({ reason, permission, publicData: ctx.session.$publicData })) {
    throw new Error(`Unauthorized: ${reason}`);
  }
}

// use instead of resolver.authorize
interface CMDBResolverAuthorizeArgs {
  ctx: Ctx,
  args: [permission: string],
};

export function CMDBResolverAuthorize(args: CMDBResolverAuthorizeArgs) {
  return CMAuthorize({
    permission: args.args[0] as Permission,
    reason: "resolver.authorize => CMDBResolverAuthorize",
    publicData: args.ctx.session.$publicData,
  });
}

declare module "@blitzjs/auth" {
  export interface Session {
    isAuthorized: SimpleRolesIsAuthorized,//myRolesIsAuthorized
    PublicData: PublicDataType,
  }
}

export interface CreatePublicDataArgs {
  user?: Prisma.UserGetPayload<{ include: { role: { include: { permissions: { include: { permission: true } } } } } }>; // if no user, public profile.
  impersonatingFromUserId?: number;
  showAdminControls?: boolean; // client-side option
}

export function CreatePublicData(args: CreatePublicDataArgs): PublicDataType {
  if (!args.user) {
    // anonymous/public
    return {
      userId: 0, // numeric & falsy
      isSysAdmin: false,
      permissions: [...gPublicPermissions],
      impersonatingFromUserId: args.impersonatingFromUserId,
      showAdminControls: false,
      permissionsLastRefreshedAt: new Date().toISOString(),
    };
  }
  return {
    userId: args.user.id,
    isSysAdmin: args.user.isSysAdmin,
    permissions: [...gPublicPermissions, ...((args.user.role?.permissions)?.map(p => p.permission?.name) || [])],
    impersonatingFromUserId: args.impersonatingFromUserId,
    showAdminControls: args.showAdminControls || false,
    permissionsLastRefreshedAt: new Date().toISOString(),
  };
};
