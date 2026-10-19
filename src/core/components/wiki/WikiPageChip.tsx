import { BandPermission } from "src/auth/shared/bandPermissionPolicy";
import { getHashedColor } from "@/shared/utils";
import { useCmdbRouter } from "@/src/route/useCmdbRouter";
import { wikiParseCanonicalWikiPath, wikiPageInternalHref } from "../../wiki/shared/wikiUtils";
import { CMChip, CMChipSizeOptions } from "../CMChip";
import { ColorVariationSpec } from "../color/palette";
import { useDashboardContext } from "../dashboardContext/DashboardContext";

export interface WikiPageChipProps {
    slug: string;
    // todo: use actual wiki page name
    variation?: ColorVariationSpec;
    size?: CMChipSizeOptions;
    onClick?: () => void;
    className?: string;
    startAdornment?: React.ReactNode;
    endAdornment?: React.ReactNode;
    useHashedColor?: boolean;
};

export const WikiPageChip = (props: WikiPageChipProps) => {
    const dashboardContext = useDashboardContext();
    const router = useCmdbRouter();
    const isAuthorized = dashboardContext.isAuthorized(BandPermission.view_wiki_pages);
    const wikiPath = wikiParseCanonicalWikiPath(props.slug);

    return <CMChip
        variation={props.variation}
        size={props.size}
        href={isAuthorized ? router.href(wikiPageInternalHref(wikiPath.canonicalWikiPath, router.requestPath.bandPublicId)) : undefined}
        className={props.className}
    >
        {props.startAdornment}
        <span style={{ color: props.useHashedColor ? getHashedColor(props.slug) : undefined }}>
            {props.slug}
        </span>
        {props.endAdornment}
    </CMChip>
}

