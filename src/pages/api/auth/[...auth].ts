// src/pages/api/auth/[...auth].ts
import { ActivityFeature } from "@/src/core/components/featureReports/activityTracking";
import { ServerApi } from "@/src/server/serverApi";
import { passportAuth } from "@blitzjs/auth";
import db from "db";
import { resolveGoogleSignIn } from "src/auth/server/googleSignIn";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { api } from "src/blitz-server";
import { recordAction } from "src/core/db3/server/recordActionServer";
import { createPublicDataFromDatabase } from "src/auth/server/effectivePermissions";
import { GoogleProfileWithEmails } from "@/src/auth/server/googleProfile";

export default api(
  passportAuth(({ ctx, req, res }) => ({
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
              await recordAction({
                feature: created ? ActivityFeature.signup_google : ActivityFeature.login_google,
                userId: user.id,
                uri: undefined,
              }, ctx);
              done(null, { publicData: await createPublicDataFromDatabase(db, { user }) });
            } catch (err) {
              done(null, false);
            }
          }
        ),
      }, // new google strategy
    ],
  }))
)
