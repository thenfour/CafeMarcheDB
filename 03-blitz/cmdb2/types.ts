import { SimpleRolesIsAuthorized } from "@blitzjs/auth"
import { User } from "db"

// ROLE_USER = basic user, lowest access & default
// ROLE_MEMBER = elevated user; access to CM stuff
// ROLE_BOARD = customization
// ROLE_ADMIN = full unfiltered access
export type Role = "ROLE_BOARD" | "ROLE_MEMBER" | "ROLE_ADMIN" | "ROLE_USER"



declare module "@blitzjs/auth" {
  export interface Session {
    isAuthorized: SimpleRolesIsAuthorized<Role>
    PublicData: {
      userId: User["id"]
      role: Role
    }
  }
}
