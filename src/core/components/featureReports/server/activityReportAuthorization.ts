import { AuthorizationError } from "blitz";
import { Permission } from "shared/permissions";
import type { BandPublicId } from "shared/publicId";
import type { CMServerAuthorization } from "src/auth/server/serverAuthorization";

export function authorizeActivityReport(authorization: CMServerAuthorization, bandPublicId: BandPublicId) {
    const auth = authorization.requireUser();
    const band = auth.requireBand();
    if (band.publicId !== bandPublicId) {
        throw new AuthorizationError("Activity reports require the selected band.");
    }
    auth.requirePermission(Permission.view_feature_reports);
    return { auth, band };
}
