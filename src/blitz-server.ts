import { AuthServerPlugin, PrismaStorage, getSession } from "@blitzjs/auth"
import { setupBlitzServer } from "@blitzjs/next"
import { BlitzLogger, BlitzServerMiddleware } from "blitz"
import type { IncomingMessage, ServerResponse } from "http"
import db from "db"
import { CMDBResolverAuthorize } from "types"
import { authConfig } from "./blitz-client"
import { getRequestAuthorization } from "./auth/server/requestAuthorization"

// Used both by Blitz middleware and the Next page adapter in _app.
export async function getSessionForRequest(req: IncomingMessage, res: ServerResponse) {
  const session = await getSession(req, res)
  await getRequestAuthorization(session)
  return session
}

export const { gSSP, gSP, api } = setupBlitzServer({
  plugins: [
    AuthServerPlugin({
      ...authConfig,
      storage: PrismaStorage(db as any), // TODO correct typing or upgrade ? https://github.com/blitz-js/blitz/issues/4172
      isAuthorized: CMDBResolverAuthorize,
      //isAuthorized: simpleRolesIsAuthorized,//CMDBRolesIsAuthorized,
    }),
    BlitzServerMiddleware(async (req, res, next) => {
      await getSessionForRequest(req, res)
      await next()
    }),
  ],
  logger: BlitzLogger({
    //minLevel: 3,
  }),
})
