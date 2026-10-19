import { BandPermission } from "src/auth/shared/bandPermissionPolicy";
import { getHashedColor } from "@/shared/utils";
import { useCmdbRouter } from "@/src/route/useCmdbRouter";
import { Prisma } from "@prisma/client";
import type { FilePublicId } from "shared/publicId";
import * as db3 from "src/core/db3/db3";
import { CMChip, CMChipSizeOptions } from "../CMChip";
import { ColorVariationSpec } from "../color/palette";
import { useDashboardContext } from "../dashboardContext/DashboardContext";
import { Markdown } from "../markdown/Markdown";

/** Public reference navigation requires no storage path or external download target. */
export const FileReferenceChip = ({ value }: { readonly value: { readonly publicId: FilePublicId; readonly fileLeafName: string } }) => {
    //const dashboard = useDashboardContext();
    const router = useCmdbRouter();
    return <CMChip href={router.getURIForFileLandingPage({ publicId: value.publicId })}>
        <span style={{ color: getHashedColor(value.publicId) }}>{value.fileLeafName}</span>
    </CMChip>;
};


export interface FileChipProps {
    value: Prisma.FileGetPayload<{ select: { publicId: true, storedLeafName: true, fileLeafName: true, externalURI: true } }>;
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
    const router = useCmdbRouter();
    const href = dashboardContext.isAuthorized(BandPermission.view_files) ? router.getURIForFile(props.value) : undefined;
    return <CMChip
        variation={props.variation}
        size={props.size}
        href={href}
        className={props.className}
    >
        {props.startAdornment}
        <span style={{ color: props.useHashedColor ? getHashedColor(props.value.publicId) : undefined }}>
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
        {props.value.name}
    </CMChip>
}


