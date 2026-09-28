import { useQuery } from "@blitzjs/rpc";
import { Email, Google } from "@mui/icons-material";
import { Tooltip } from "@mui/material";
import getUserExtraInfo, { type UserExtraInfo } from "../../db3/queries/getUserExtraInfo";
import { NameValuePair } from "../CMCoreComponents2";
import type { UserPublicId } from "shared/publicId";

type UserIdentityIndicatorProps = {
    // whether to show the password indicator. for user search list items,
    // we only show a google badge / non-password-identity indicator.
    //showPassword?: boolean;
    user?: { publicId: UserPublicId };
    userId?: UserPublicId;
};

const GoogleIdentityBadge = ({ display }: { display: string | null }) => <Tooltip title={display ? `Google sign-in: ${display}` : "Has a Google sign-in"}><Google /></Tooltip>;
const EmailIdentityBadge = ({ display }: { display: string | null }) => <Tooltip title={display ? `Email sign-in: ${display}` : "Has an email sign-in"}><Email /></Tooltip>;

const IdentityIndicator = ({ signinMethods }: UserExtraInfo) => {
    return [...signinMethods].sort((a, b) => a.type.localeCompare(b.type)).map((method, index) => {
        if (method.type === "google") return <GoogleIdentityBadge key={`google-${index}`} display={method.displayId} />;
        if (method.type === "email") return <EmailIdentityBadge key={`email-${index}`} display={method.displayId} />;
        return null;
    });
};

export const UserIdentityIndicator = ({ /*showPassword = true,*/ ...props }: UserIdentityIndicatorProps) => {
    const userId = props.user?.publicId || props.userId;
    if (!userId) {
        return null;
    }
    const [extraInfo, { refetch }] = useQuery(getUserExtraInfo, { userId: userId });

    return <IdentityIndicator signinMethods={extraInfo.signinMethods} />;
}


export const ProfilePageIdentityControl = ({ userId }: { userId: UserPublicId }) => {
    if (!userId) {
        return null;
    }
    const [extraInfo, { refetch }] = useQuery(getUserExtraInfo, { userId: userId });

    if (!extraInfo || extraInfo.signinMethods.length < 1) {
        return null;
    }

    return <NameValuePair
        isReadOnly={false}
        name={"Sign-in"}
        value={<IdentityIndicator signinMethods={extraInfo.signinMethods} />}
    />;
}
