import { portalPublicOrigin } from "src/route/server/portalConfig";

export function publicFeedBaseURL(): string {
    return portalPublicOrigin().href;
}
