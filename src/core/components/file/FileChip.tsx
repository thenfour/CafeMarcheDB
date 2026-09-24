import { Permission } from "@/shared/permissions";
import { getHashedColor } from "@/shared/utils";
import { Prisma } from "@prisma/client";
import * as db3 from "src/core/db3/db3";
import { CMChip, CMChipSizeOptions } from "../CMChip";
import { ColorVariationSpec } from "../color/palette";
import { useDashboardContext } from "../dashboardContext/DashboardContext";
import { Markdown } from "../markdown/Markdown";


export interface FileChipProps {
    value: Prisma.FileGetPayload<{ select: { id: true, storedLeafName: true, fileLeafName: true, externalURI: true } }> | db3.FilePayloadMinimum;
    variation?: ColorVariationSpec;
    size?: CMChipSizeOptions;
    onClick?: () => void;
    className?: string;
    startAdornment?: React.ReactNode;
    endAdornment?: React.ReactNode;
    useHashedColor?: boolean;
};

export const FileChip = (props: FileChipProps) => {
    const dashboardContext = useDashboardContext();
    const href = dashboardContext.isAuthorized(Permission.view_files) ? dashboardContext.routingApi.getURIForFile(props.value) : undefined;
    return <CMChip
        variation={props.variation}
        size={props.size}
        href={href}
        className={props.className}
    >
        {props.startAdornment}
        <span style={{ color: props.useHashedColor ? getHashedColor(props.value.id.toString()) : undefined }}>
            {props.value.fileLeafName}
        </span>
        {props.endAdornment}
    </CMChip>
}



export interface FileTagChipProps {
    value: db3.FileTagDashboardClient;
    size?: CMChipSizeOptions;
    onClick?: () => void;
    className?: string;
};

export const FileTagChip = (props: FileTagChipProps) => {
    return <CMChip
        variation={undefined}
        size={props.size}
        onClick={props.onClick}
        className={props.className}
        color={props.value.color}
        shape={"rectangle"}
        border={"noBorder"}
        tooltip={props.value.description && <Markdown markdown={props.value.description} />}
    >
        {props.value.text}
    </CMChip>
}


