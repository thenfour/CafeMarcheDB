import { isPublicId } from "shared/publicId";

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
