import type { UserPublicId } from "shared/publicId";
import type { DB3QueryContextInput } from "src/core/db3/components/useDB3Context";

// TODO: proper routing mechanism

export function bandMemberHref(personId: UserPublicId, context: DB3QueryContextInput): string {
    return withMemberPresentation(`/backstage/user/${personId}`, context);
}

export function withMemberPresentation(path: string, context: DB3QueryContextInput): string {
    if (!path.startsWith("/") || path.startsWith("//")) {
        return path;
    }
    const url = new URL(path, "https://cmdb.invalid");
    const query = url.searchParams;
    if (context.bandPublicId) {
        query.set("bandPublicId", context.bandPublicId);
    } else {
        query.delete("bandPublicId");
    }
    if (context.routeLocale) {
        query.set("routeLocale", context.routeLocale);
    } else {
        query.delete("routeLocale");
    }
    return `${url.pathname}${query.size > 0 ? `?${query.toString()}` : ""}${url.hash}`;
}
