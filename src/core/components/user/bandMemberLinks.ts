import type { UserPublicId } from "shared/publicId";
import { portalHref, type BandHostingConfig, type RouteBandAndLocale } from "src/route/portalRouting";

export function bandMemberHref(personId: UserPublicId, context: RouteBandAndLocale, hosting: BandHostingConfig): string {
    return portalHref(`/backstage/user/${personId}`, context, hosting);
}
