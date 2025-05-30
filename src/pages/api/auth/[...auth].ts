// src/pages/api/auth/[...auth].ts
import { passportAuth } from "@blitzjs/auth";
import db from "db";
import { nanoid } from 'nanoid';
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import signupMutation from "src/auth/mutations/signup";
import { api } from "src/blitz-server";
import { recordAction } from "src/core/db3/server/recordActionServer";
import { ActivityFeature } from "@/src/core/components/featureReports/activityTracking";
import { CreatePublicData } from "types";

export default api(
  passportAuth(({ ctx, req, res }) => ({
    successRedirectUrl: process.env.CMDB_LOGIN_SUCCESS_REDIRECT,
    errorRedirectUrl: process.env.CMDB_BASE_URL,
    strategies: [
      {
        strategy: new GoogleStrategy(
          {
            scope: ["openid", "email", "profile"],
            clientID: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            callbackURL: process.env.GOOGLE_CALLBACK_URL,

          },
          async function (accessToken, refreshToken, params, profile, done) {
            // find or create user with this google ID.
            // 1. matching googleID on existing user
            // 2. matching email & no matching googleID. on existing user
            // 3. create new.

            try {
              const email = profile.emails[0].value.toLowerCase();
              const googleId = profile.id;
              const displayName = profile.displayName;

              let user = await db.user.findFirst({
                where: {
                  AND: [
                    { googleId },
                    { isDeleted: false }
                  ]
                },
                include: { role: { include: { permissions: { include: { permission: true } } } } }
              });

              if (!user) {

                user = await db.user.findFirst({
                  where: {
                    AND: [
                      { email },
                      { isDeleted: false }
                    ]
                  },
                  include: { role: { include: { permissions: { include: { permission: true } } } } }
                });

                if (user) {
                  // user already has correct email, but not the google id. might as well update it. i guess strictly it's not necessary,
                  // as long as we don't allow users to update email addresses.
                  await recordAction({
                    feature: ActivityFeature.login_google,
                    userId: user.id,
                    uri: undefined,
                  }, ctx);
                  user = await db.user.update({
                    where: { id: user.id },
                    data: { googleId },
                    include: { role: { include: { permissions: { include: { permission: true } } } } }
                  });
                } else {
                  // i should just create separate schema validation/mutation for when a user uses a password vs. external auth.
                  // but whatever; simpler to just supply a password that will never be used.
                  user = await signupMutation({ email, googleId, password: "1234567890!@#$%^&aoeuAOEU" + nanoid(), name: displayName }, ctx);
                  await recordAction({
                    feature: ActivityFeature.signup_google,
                    userId: user.id,
                    uri: undefined,
                  }, ctx);
                }
              }

              // list permissions:
              // user.role.permissions.map(p => p.permission.name);

              done(null, { publicData: CreatePublicData({ user }) });
            } catch (err) {
              done(null, false);
            }
          }
        ),
      }, // new google strategy
    ],
  }))
)