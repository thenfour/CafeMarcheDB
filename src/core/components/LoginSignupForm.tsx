import Link from "next/link";
import { useRouter } from "next/router";
import { LoginForm } from "src/auth/components/LoginForm";
import { simulateLinkClick } from "./CMCoreComponents2";
import { AppContextMarker } from "./AppContext";
import { CMLink } from "./CMLink";
import { ActivityFeature } from "./featureReports/activityTracking";

export const LoginSignup = () => {
    const router = useRouter();
    return (
        <div className="signInPageMain">
            <AppContextMarker name="LoginSignup">
                <CMLink trackingFeature={ActivityFeature.login_google} href="/api/auth/google" className="signInBlock google link googleSignInLink">
                    <div className="title">
                        <img src="/web_light_rd_na.svg" />
                        Click here to sign in via Google
                    </div>
                    <div className="description">
                        <p>Using this option avoids creating a username & password just for this website.
                            Your private information will not be shared with this website.</p>
                        <p>If you don't have an account on this website yet, one will be created and associated with your Google identity automatically.</p>
                    </div>
                </CMLink>
                <div className="signInBlock login">
                    <LoginForm
                        onSuccess={(_user) => {
                            //const next = router.query.next ? decodeURIComponent(router.query.next as string) : "/"
                            //return router.push(next)
                            simulateLinkClick("/backstage");
                        }}
                    />
                </div>
                <Link href={"/auth/signup"} className="signInBlock link createNewAccount">
                    <div className="title">
                        Create a new account using email & password
                    </div>
                    <div className="description">
                        Use this option if you don't have a Google account.
                        {/* Anyone can create an account, but you'll have limited access at first. An admin will need to give you elevated access. */}
                    </div>
                </Link>
            </AppContextMarker>
        </div>
    );
};
