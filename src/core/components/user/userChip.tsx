import React from "react";
import { CMChip, CMChipSizeOptions } from "../CMChip";
import { useQuery } from "@blitzjs/rpc";
import getUser from "../../db3/queries/getUser";
import { getHashedColor } from "shared/utils";
import { ColorVariationSpec } from "../color/palette";
import { Permission } from "@/shared/permissions";
import { useDashboardContext } from "../dashboardContext/DashboardContext";
import type { UserPublicId } from "shared/publicId";
import { useDB3QueryContext } from "src/core/db3/components/useDB3Context";
import { bandMemberHref } from "./bandMemberLinks";


export interface UserChipBaseProps {
    variation?: ColorVariationSpec;
    size?: CMChipSizeOptions;
    onClick?: () => void;
    className?: string;
    startAdornment?: React.ReactNode;
    endAdornment?: React.ReactNode;
    useHashedColor?: boolean;
    noLink?: boolean; // if true, will not render as a link
};

// the user chip when you know the user info.
type ValuedUserChipProps = UserChipBaseProps & {
    value: { publicId: UserPublicId; name?: string } | null;
    userId?: never;
    color?: string | null;
};

// the user chip when you know the user ID, and need to query for the info.
type QueriedUserChipProps = UserChipBaseProps & {
    userId: UserPublicId | null;
    color?: string | null;
};

const ValuedUserChip = (props: ValuedUserChipProps) => {
    const dashboardContext = useDashboardContext();
    const context = useDB3QueryContext();

    const userId = props.value?.publicId || null;
    const canViewProfile = dashboardContext.isAuthorized(Permission.view_users_basic_info) || dashboardContext.currentUser?.publicId === userId;
    const userURI = userId && context.bandPublicId && canViewProfile
        ? bandMemberHref(userId, context) : undefined;

    const clickHandler = props.onClick;

    return <CMChip
        variation={props.variation}
        size={props.size}
        onClick={clickHandler}
        href={props.noLink ? undefined : userURI}
        className={props.className}
        color={props.color}
    >
        {props.startAdornment}
        <span style={{ color: props.useHashedColor ? getHashedColor(props.value?.publicId || "") : undefined }}>
            {props.value?.name || "--"}
        </span>
        {props.endAdornment}
    </CMChip>
}


function LoadedQueriedUserChip({ userId, ...props }: UserChipBaseProps & { readonly userId: UserPublicId; readonly color?: string | null }) {
    const context = useDB3QueryContext();
    const [user] = useQuery(getUser, { userId, ...context }, { staleTime: 0, cacheTime: 0, keepPreviousData: false });
    return <ValuedUserChip {...props} value={user} />;
}

const QueriedUserChip: React.FC<QueriedUserChipProps> = ({ userId, ...props }) => {
    const context = useDB3QueryContext();
    if (userId === null || !context.bandPublicId) {
        return <ValuedUserChip {...props} value={null} />;
    }
    return <LoadedQueriedUserChip key={`${context.bandPublicId}/${userId}/${context.clientRequestId ?? "initial"}`} {...props} userId={userId} />;
};

export const UserChip = (props: ValuedUserChipProps | QueriedUserChipProps) => {

    return (props.userId !== undefined) ?
        <QueriedUserChip
            userId={props.userId}
            variation={props.variation}
            size={props.size}
            onClick={props.onClick}
            className={props.className}
            startAdornment={props.startAdornment}
            endAdornment={props.endAdornment}
            useHashedColor={props.useHashedColor}
            color={props.color}
            noLink={props.noLink}
        />
        : <ValuedUserChip
            value={props.value}
            variation={props.variation}
            size={props.size}
            onClick={props.onClick}
            className={props.className}
            startAdornment={props.startAdornment}
            endAdornment={props.endAdornment}
            useHashedColor={props.useHashedColor}
            color={props.color}
            noLink={props.noLink}
        />
}



// MIGRATION_RESTORE: directory-search
// Source: 1768352278c2ac37768c8bd2c2cc0ad5ffd4324a:src/core/components/user/userChip.tsx:1-115
// Reason: The membership directory replaces the old user search with a smaller feature set.
// Restore: Restore multi-value filter operators, presets, URL state, contact search policy, and CSV export for the selected band.
// Verification: Test filter combinations, permission restrictions, pagination, URL round trips, and exported rows; exercise the built directory.
// SHA256: 214e6121bce6d350aa9ac360c3f6e47e480bf12c131b5bb90a3cef282f77138d
// MIGRATION_REFERENCE_BEGIN
// import React from "react";
// import { CMChip, CMChipSizeOptions } from "../CMChip";
// import { useQuery } from "@blitzjs/rpc";
// import getUser from "../../db3/queries/getUser";
// import { getHashedColor } from "shared/utils";
// import { ColorVariationSpec } from "../color/palette";
// import { Permission } from "@/shared/permissions";
// import { useDashboardContext } from "../dashboardContext/DashboardContext";
// import type { UserPublicId } from "shared/publicId";
//
//
// export interface UserChipBaseProps {
//     variation?: ColorVariationSpec;
//     size?: CMChipSizeOptions;
//     onClick?: () => void;
//     className?: string;
//     startAdornment?: React.ReactNode;
//     endAdornment?: React.ReactNode;
//     useHashedColor?: boolean;
//     noLink?: boolean; // if true, will not render as a link
// };
//
// // the user chip when you know the user info.
// type ValuedUserChipProps = UserChipBaseProps & {
//     value: { publicId: UserPublicId; name?: string } | null;
//     userId?: never;
//     color?: string | null;
// };
//
// // the user chip when you know the user ID, and need to query for the info.
// type QueriedUserChipProps = UserChipBaseProps & {
//     userId: UserPublicId | null;
//     color?: string | null;
// };
//
// const ValuedUserChip = (props: ValuedUserChipProps) => {
//     const dashboardContext = useDashboardContext();
//
//     const userId = props.value?.publicId || null;
//     const userURI = userId && dashboardContext.isAuthorized(Permission.view_users_basic_info) ? dashboardContext.routingApi.getURIForUser({ publicId: userId }) : undefined;
//
//     const clickHandler = props.onClick;
//
//     return <CMChip
//         variation={props.variation}
//         size={props.size}
//         onClick={clickHandler}
//         href={props.noLink ? undefined : userURI}
//         className={props.className}
//         color={props.color}
//     >
//         {props.startAdornment}
//         <span style={{ color: props.useHashedColor ? getHashedColor(props.value?.publicId || "") : undefined }}>
//             {props.value?.name || "--"}
//         </span>
//         {props.endAdornment}
//     </CMChip>
// }
//
//
// const QueriedUserChip: React.FC<QueriedUserChipProps> = (props) => {
//     if (props.userId === null) {
//         return <ValuedUserChip
//             value={null}
//             variation={props.variation}
//             size={props.size}
//             onClick={props.onClick}
//             className={props.className}
//             startAdornment={props.startAdornment}
//             endAdornment={props.endAdornment}
//             useHashedColor={props.useHashedColor}
//         />;
//     }
//     const [user, userX] = useQuery(getUser, { userId: props.userId });
//     return <ValuedUserChip
//         value={user}
//         variation={props.variation}
//         size={props.size}
//         onClick={props.onClick}
//         className={props.className}
//         startAdornment={props.startAdornment}
//         endAdornment={props.endAdornment}
//         useHashedColor={props.useHashedColor}
//     />;
// };
//
// export const UserChip = (props: ValuedUserChipProps | QueriedUserChipProps) => {
//
//     return (props.userId !== undefined) ?
//         <QueriedUserChip
//             userId={props.userId}
//             variation={props.variation}
//             size={props.size}
//             onClick={props.onClick}
//             className={props.className}
//             startAdornment={props.startAdornment}
//             endAdornment={props.endAdornment}
//             useHashedColor={props.useHashedColor}
//             color={props.color}
//             noLink={props.noLink}
//         />
//         : <ValuedUserChip
//             value={props.value}
//             variation={props.variation}
//             size={props.size}
//             onClick={props.onClick}
//             className={props.className}
//             startAdornment={props.startAdornment}
//             endAdornment={props.endAdornment}
//             useHashedColor={props.useHashedColor}
//             color={props.color}
//             noLink={props.noLink}
//         />
// }
//
// MIGRATION_REFERENCE_END
