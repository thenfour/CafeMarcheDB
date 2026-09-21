import { useQuery } from "@blitzjs/rpc";
import { Email, Google } from "@mui/icons-material";
import { Tooltip } from "@mui/material";
import getUserExtraInfo from "../../db3/queries/getUserExtraInfo";
import { NameValuePair } from "../CMCoreComponents2";

type UserIdentityIndicatorProps = {
    // whether to show the password indicator. for user search list items,
    // we only show a google badge / non-password-identity indicator.
    //showPassword?: boolean;
    user?: { id: number };
    userId?: number;
};

const GoogleIdentityBadge = () => <Tooltip title="Has a Google sign-in"><Google /></Tooltip>;
const EmailIdentityBadge = () => <Tooltip title="Has an email sign-in"><Email /></Tooltip>;

const IdentityIndicator = ({ signinMethods }: { signinMethods: string[] }) => {
    return signinMethods.sort((a, b) => a.localeCompare(b)).map((method, index) => {
        if (method === "google") return <GoogleIdentityBadge key={`google-${index}`} />;
        if (method === "email") return <EmailIdentityBadge key={`email-${index}`} />;
        return null;
    });
};

export const UserIdentityIndicator = ({ /*showPassword = true,*/ ...props }: UserIdentityIndicatorProps) => {
    const userId = props.user?.id || props.userId;
    if (!userId) {
        return null;
    }
    const [extraInfo, { refetch }] = useQuery(getUserExtraInfo, { userId: userId });

    return <IdentityIndicator signinMethods={extraInfo.signinMethods} />;
}


export const ProfilePageIdentityControl = ({ userId }: { userId: number }) => {
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
