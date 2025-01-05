import { AuthServerPlugin, PrismaStorage } from "@blitzjs/auth"
import { setupBlitzServer } from "@blitzjs/next"
import { BlitzLogger } from "blitz"
import db from "db"
import { CMDBResolverAuthorize } from "types"
import { authConfig } from "./blitz-client"

export const { gSSP, gSP, api } = setupBlitzServer({
  plugins: [
    AuthServerPlugin({
      ...authConfig,
      storage: PrismaStorage(db as any), // TODO correct typing or upgrade ? https://github.com/blitz-js/blitz/issues/4172
      isAuthorized: CMDBResolverAuthorize,
      //isAuthorized: simpleRolesIsAuthorized,//CMDBRolesIsAuthorized,
    }),
    //BlitzServerMiddleware(CMDBMiddleware)
  ],
  logger: BlitzLogger({
    //minLevel: 3,
  }),
})
