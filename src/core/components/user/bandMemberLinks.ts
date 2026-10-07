import type { UserPublicId } from "shared/publicId";
import type { DB3QueryContextInput } from "src/core/db3/components/useDB3Context";

// TODO: proper routing mechanism

export function bandMemberHref(personId: UserPublicId, context: DB3QueryContextInput): string {
    return withMemberPresentation(`/backstage/user/${personId}`, context);
}

export function withMemberPresentation(path: string, context: DB3QueryContextInput): string {
    const query = new URLSearchParams();
    if (context.bandPublicId) {
        query.set("bandPublicId", context.bandPublicId);
    }
    if (context.routeLocale) {
        query.set("routeLocale", context.routeLocale);
    }
    return query.size > 0 ? `${path}?${query.toString()}` : path;
}
