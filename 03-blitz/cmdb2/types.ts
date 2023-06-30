//import { SimpleRolesIsAuthorized } from "@blitzjs/auth"
import { SessionContext } from "@blitzjs/auth";
import { User, Role, Permission } from "db"

type CMDBRolesIsAuthorizedArgs = {
  ctx: any
  args: [roleOrRoles?: string]
}

interface CMDBRolesIsAuthorized {
  ({ ctx, args }: {
    ctx: any;
    args: [roleOrRoles?: string];
  }): boolean;
}


export function CMDBRolesIsAuthorized({ ctx, args }: CMDBRolesIsAuthorizedArgs) {
  // todo
  console.log(`CMDBRolesIsAuthorized for ctx,args:`);
  //console.log((ctx.session as SessionContext));
  console.log((ctx.session as SessionContext).$publicData);
  console.log(args);
  return true;
}

declare module "@blitzjs/auth" {
  export interface Session {
    isAuthorized: CMDBRolesIsAuthorized//myRolesIsAuthorized
    PublicData: {
      userId: User["id"],
      isSysAdmin: boolean,
      permissions: string[]
    }
  }
}

export function CreatePublicData(user: User) {
  if (!user) return {};
  return {
    userId: user.id,
    isSysAdmin: user.isSysAdmin,
    permissions: ((((user.role) as Role)?.permissions) as Permission[])?.map(p => p.permission?.name) || [],
  };
};

