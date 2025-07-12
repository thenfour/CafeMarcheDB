import { useQuery } from "@blitzjs/rpc";
import getUserExtraInfo from "../../db3/queries/getUserExtraInfo";
import { GoogleIconSmall, NameValuePair } from "../CMCoreComponents2";



type UserIdentityIndicatorProps = {
    showPassword?: boolean;
    user?: { id: number };
    userId?: number;
};

export const UserIdentityIndicator = ({ showPassword = true, ...props }: UserIdentityIndicatorProps) => {
    const userId = props.user?.id || props.userId;
    if (!userId) return null;
    const [extraInfo, { refetch }] = useQuery(getUserExtraInfo, { userId: userId });
    return extraInfo.identity === "Google" ? <GoogleIconSmall /> : (showPassword ? "Password" : null);
}


export const ProfilePageIdentityControl = ({ userId }: { userId: number }) => {
    if (!userId) return null;
    const [extraInfo, { refetch }] = useQuery(getUserExtraInfo, { userId: userId });

    const haveGoogleIdentity = extraInfo.identity === "Google";

    // if you don't have a google identity there's just not much to show here; don't show anything.
    if (!haveGoogleIdentity) return null;

    return <NameValuePair
        isReadOnly={false}
        name={"Identity and login"}
        value={<div className="googleIdentityControl">
            <img src="/web_light_rd_na.svg" />
            <div>You have a Google identity and can sign in with your Google account. You still have the option of signing in with an email & password.</div>
        </div>}
    />;
}
