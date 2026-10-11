import { isPublicId } from "shared/publicId";

interface ActivityContextBreadcrumb {
    readonly label: string; readonly prefix: string; readonly leadingSeparators: string; readonly trailingSeparators: string;
}

/** Keep literal roots and separators, so App/a/ cannot accidentally select App/another/. */
export function activityContextBreadcrumbs(value: string): ActivityContextBreadcrumb[] {
    const parts: ActivityContextBreadcrumb[] = [];
    const segments = /[^/]+/g;
    for (let match = segments.exec(value); match !== null; match = segments.exec(value)) {
        const end = match.index + match[0].length;
        const trailingSeparators = value.slice(end).match(/^\/+/)?.[0] ?? "";
        parts.push({ label: match[0], prefix: value.slice(0, end + trailingSeparators.length),
            leadingSeparators: parts.length === 0 ? value.slice(0, match.index) : "", trailingSeparators });
    }
    if (!parts.length && value) {
        return [{ label: value, prefix: value, leadingSeparators: "", trailingSeparators: "" }];
    }
    return parts;
}

/** Historical contexts can embed person IDs and names, e.g. App/profile/<person>/name. */
export function anonymousActivityContext(value: string | null): string | null {
    if (value === null) {
        return null;
    }
    const parts = value.split("/");
    const identityIndex = parts.findIndex((part, index) => {
        const parent = parts[index - 1]?.toLowerCase();
        // Opaque IDs and numeric IDs cannot safely be attributed to a public domain here.
        return Boolean(part) && (parent === "profile" || parent === "user" || isPublicId(part)
            || /^\d+$/.test(part) || part.includes("@"));
    });
    if (identityIndex < 0) {
        return value;
    }
    if (identityIndex === 0) {
        return null;
    }
    return `${parts.slice(0, identityIndex).join("/")}/`;
}
