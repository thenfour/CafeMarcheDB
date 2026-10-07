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

