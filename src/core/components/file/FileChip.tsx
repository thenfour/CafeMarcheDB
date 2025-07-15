import { Permission } from "@/shared/permissions";
import { getHashedColor } from "@/shared/utils";
import { Prisma } from "@prisma/client";
import * as db3 from "src/core/db3/db3";
import { getURIForFile } from "../../db3/clientAPILL";
import { CMChip, CMChipSizeOptions } from "../CMChip";
import { ColorVariationSpec } from "../color/palette";
import { useDashboardContext } from "../DashboardContext";
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
    const href = dashboardContext.isAuthorized(Permission.view_files) ? getURIForFile(props.value) : undefined;
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
    value: number | { id: number };
    size?: CMChipSizeOptions;
    onClick?: () => void;
    className?: string;
};

export const FileTagChip = (props: FileTagChipProps) => {
    const dashboardContext = useDashboardContext();
    let tagId = typeof (props.value) === "number" ? props.value : props.value.id;
    let tag = dashboardContext.fileTag.getById(tagId);

    return <CMChip
        variation={undefined}
        size={props.size}
        onClick={props.onClick}
        className={props.className}
        color={tag?.color}
        shape={"rectangle"}
        border={"noBorder"}
        tooltip={tag?.description && <Markdown markdown={tag.description} />}
    >
        {tag?.text || "<null>"}
    </CMChip>
}


