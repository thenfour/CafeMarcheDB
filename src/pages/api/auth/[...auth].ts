import { authorizationDatabase } from "@/src/auth/server/authorizationContext";
// src/pages/api/auth/[...auth].ts
import { ActivityFeature } from "@/src/core/components/featureReports/activityTracking";
import { ServerApi } from "@/src/server/serverApi";
import { passportAuth } from "@blitzjs/auth";
import { resolveGoogleSignIn } from "src/auth/server/googleSignIn";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { api } from "src/blitz-server";
import { createActionRecord } from "src/core/db3/server/recordActionServer";
import { createPublicDataFromDatabase } from "src/auth/server/effectivePermissions";
import { GoogleProfileWithEmails } from "@/src/auth/server/googleProfile";
import { resolvePortalRequest } from "src/route/server/portalRequest";
import { NotFoundError } from "blitz";
import { portalPublicOrigin } from "src/route/server/portalConfig";

export default api(
  passportAuth(({ ctx, req, res }) => {
    // Passport stores this local return path in the session across its external callback.
    const returnPaths = new URL(req.url ?? "/", portalPublicOrigin()).searchParams.getAll("redirectUrl");
    if (returnPaths.length > 1) {
      throw new NotFoundError();
    }
    const returnPath = returnPaths[0];
    if (returnPath !== undefined) {
      if (!returnPath.startsWith("/")) {
        throw new NotFoundError();
      }
      resolvePortalRequest(req, returnPath);
    }
    return {
    successRedirectUrl: process.env.CMDB_LOGIN_SUCCESS_REDIRECT,
    errorRedirectUrl: ServerApi.getAbsoluteUri('/'),
    strategies: [
      {
        strategy: new GoogleStrategy(
          {
            scope: ["openid", "email", "profile"],
            clientID: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            callbackURL: process.env.GOOGLE_CALLBACK_URL,

          },
          async function (accessToken, refreshToken, params, profile: GoogleProfileWithEmails, done) {
            try {
              //console.log("Google profile:", profile);
              const { user, created } = await resolveGoogleSignIn(profile, ctx);
              await createActionRecord({
                feature: created ? ActivityFeature.signup_google : ActivityFeature.login_google,
                userId: user.id,
                uri: undefined,
                isClient: false,
              }, { bandId: null, localeContextId: null });
              done(null, { publicData: await createPublicDataFromDatabase(authorizationDatabase, { user }) });
            } catch (err) {
              done(null, false);
            }
          }
        ),
      }, // new google strategy
    ],
    };
  })
)
