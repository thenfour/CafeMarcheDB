import { SimpleRolesIsAuthorized } from "@blitzjs/auth";
import { Ctx } from "@blitzjs/next";
import { Prisma } from "db";
import { isPermission, Permission } from "shared/permissions";
import { UserWithRolesPayload } from "./src/core/db3/shared/schema/userPayloads";
//import { UserWithRolesPayload } from "./src/core/db3/db3";
//import { UserWithRolesPayload } from "src/core/db3/db3"; // circular dep

// when you make a query that includes a n aux user like "CreatedBy", don't include everything.
export const AuxUserArgs = Prisma.validator<Prisma.UserDefaultArgs>()({
  select: {
    id: true,
    name: true,
    cssClass: true,
  }
});

// export type AuxUserPayload = Prisma.UserGetPayload<typeof AuxUserArgs>;

// serializable.
export type PublicDataType = {
  userId: number,
  impersonatingFromUserId?: number | null,
  isSysAdmin: boolean,
  permissionNames: string[],

  showAdminControls: boolean; // show things like editing chrome content (SettingMarkdown etc)
  GOOGLE_ANALYTICS_ID_BACKSTAGE: string | undefined;
  GOOGLE_ANALYTICS_ID_PUBLIC: string | undefined;
};

// Blitz still invokes this for resolvers using resolver.authorize.
interface CMDBResolverAuthorizeArgs {
  ctx: Ctx,
  args: [permission: string],
};

export function CMDBResolverAuthorize(args: CMDBResolverAuthorizeArgs) {
  // Blitz's synchronous callback reads the grants refreshed at request entry.
  const permission = args.args[0];
  if (!isPermission(permission)) throw new Error(`Unknown resolver permission: ${permission}`);
  if (permission === Permission.never_grant) return false;
  if (permission === Permission.login && !args.ctx.session.userId) return false;
  return args.ctx.session.$publicData.permissionNames?.includes(permission) ?? false;
}

declare module "@blitzjs/auth" {
  export interface Session {
    isAuthorized: SimpleRolesIsAuthorized,//myRolesIsAuthorized
    PublicData: PublicDataType,
  }
}

export interface CreatePublicDataArgs {
  user?: UserWithRolesPayload | null; //Prisma.UserGetPayload<{ include: { role: { include: { permissions: { include: { permission: true } } } } } }>; // if no user, public profile.
  impersonatingFromUserId?: number;
  showAdminControls?: boolean; // client-side option
  permissions: string[];
}

export function CreatePublicData(args: CreatePublicDataArgs): PublicDataType {
  if (!args.user) {
    // anonymous/public
    return {
      userId: 0, // numeric & falsy
      isSysAdmin: false,
      permissionNames: [...new Set(args.permissions)],
      impersonatingFromUserId: args.impersonatingFromUserId,
      showAdminControls: false,
      GOOGLE_ANALYTICS_ID_BACKSTAGE: process.env.GOOGLE_ANALYTICS_ID_BACKSTAGE,
      GOOGLE_ANALYTICS_ID_PUBLIC: process.env.GOOGLE_ANALYTICS_ID_PUBLIC,
    };
  }
  return {
    userId: args.user.id,
    isSysAdmin: args.user.isSysAdmin,
    permissionNames: [...new Set(args.permissions)],
    impersonatingFromUserId: args.impersonatingFromUserId,
    showAdminControls: args.showAdminControls || false,
    GOOGLE_ANALYTICS_ID_BACKSTAGE: process.env.GOOGLE_ANALYTICS_ID_BACKSTAGE,
    GOOGLE_ANALYTICS_ID_PUBLIC: process.env.GOOGLE_ANALYTICS_ID_PUBLIC,
  };
};
