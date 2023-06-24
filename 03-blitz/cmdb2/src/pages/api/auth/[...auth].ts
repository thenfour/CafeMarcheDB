// src/pages/api/auth/[...auth].ts
import { passportAuth } from "@blitzjs/auth"
import { api } from "src/blitz-server"
import db from "db"
import { Strategy as GoogleStrategy } from "passport-google-oauth20"
import { Strategy as Auth0Strategy } from 'passport-auth0';
import signupMutation from "src/auth/mutations/signup"

export default api(
  passportAuth(({ ctx, req, res }) => ({
    successRedirectUrl: "http://localhost:3000/",
    errorRedirectUrl: "http://localhost:3000/",
    strategies: [
      {
        strategy: new GoogleStrategy(
          {
            //scope: ["google", "scopes"], // email profile ... ?
            scope: ["openid", "email", "profile"],
            //prompt: "consent",
            //accessType: "online",
            //includeGrantedScopes: true,

            clientID: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            callbackURL: process.env.GOOGLE_CALLBACK_URL,

          },
          async function (accessToken, refreshToken, params, profile, done) {
            // Create user and call done
            //console.log(` user token: ${accessToken}`);
            //console.log(`${typeof db.user}`);

            // find or create user with this google ID.
            // 1. matching googleID on existing user
            // 2. matching email & no matching googleID. on existing user
            // 3. create new.

            // upsert won't work because it doesn't support all that logic, at least not in a simple enough way to justify.
            //const session = await getSession(req, res);

            try {
              const email = profile.emails[0].value.toLowerCase();
              const googleId = profile.id;
              const displayName = profile.displayName;

              //const user = await db.user.findFirst({ where: { email: email.toLowerCase() } })

              //await prisma.$queryRaw("SELECT pg_notify('prisma', '');");

              let user = await db.user.findFirst({
                where: {
                  googleId
                }
              });

              if (!user) {

                user = await db.user.findFirst({
                  where: {
                    email
                  }
                });

                if (user) {
                  // user already has correct email, but not the google id. might as well update it. i guess strictly it's not necessary,
                  // as long as we don't allow users to update email addresses.
                  user = await db.user.update({
                    where: { id: user.id },
                    data: { googleId },
                  });
                } else {
                  user = await signupMutation({ email, googleId, password: "1234567890!@#$%^&aoeuAOEU", name: displayName }, ctx);
                }
              }

              done(null, { publicData: { userId: user.id } });
            } catch (err) {
              done(null, false);
            }
          }
        ),
      }, // new google strategy
      {
        strategy: new Auth0Strategy(
          {
            scope: ["openid", "email", "profile"],
            clientID: process.env.AUTH0_CLIENT_ID,
            clientSecret: process.env.AUTH0_CLIENT_SECRET,
            callbackURL: process.env.AUTH0_CALLBACK_URL,
            domain: process.env.AUTH0_DOMAIN,
          },
          async function (accessToken, refreshToken, params, profile, done) {
            // Create user and call done
            //console.log(` user token: ${accessToken}`);
            //console.log(`${typeof db.user}`);

            // find or create user with this google ID.
            // 1. matching googleID on existing user
            // 2. matching email & no matching googleID. on existing user
            // 3. create new.

            // upsert won't work because it doesn't support all that logic, at least not in a simple enough way to justify.
            //const session = await getSession(req, res);

            try {
              const email = profile.emails[0].value.toLowerCase();
              const googleId = profile.id;
              const displayName = profile.displayName;

              done(null, false);
            } catch (err) {
              done(null, false);
            }
          }
        ),
      } // auth0 strategy,
    ],
  }))
)