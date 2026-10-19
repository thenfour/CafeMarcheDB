import { BandPermission } from "src/auth/shared/bandPermissionPolicy";
import { NotFoundError } from "blitz";
import type { FilePublicId } from "shared/publicId";
import type { CMServerAuthorization } from "src/auth/server/serverAuthorization";
import type { PresentationInput } from "src/locale/shared/presentationInput";
import { fileDetailView } from "../db3";
import { executeDB3Read, type DB3ReadDatabase } from "./db3ReadExecution";
import { queryView } from "./db3QueryCore";


export function readFileDetailPage(database: DB3ReadDatabase, authorization: CMServerAuthorization,
    input: PresentationInput, fileId: FilePublicId,
): Promise<{ title: string; fileId: FilePublicId } | null> {
    return executeDB3Read(database, authorization, async context => {
        const auth = context.authorization;
        if (!auth.user
            || !auth.hasPermission(BandPermission.access_file_landing_page)
            || !input.bandPublicId
            || auth.band?.publicId !== input.bandPublicId) {
            return null;
        }
        const result = await queryView({
            view: fileDetailView, ...input,
            filter: { tableParams: { fileId } }, take: 1, cmdbQueryContext: "file detail page",
        }, auth, context).catch(error => {
            if (error instanceof NotFoundError) {
                return null;
            }
            throw error;
        });
        const file = result?.items[0];
        return file ? { title: file.fileLeafName ?? "", fileId: file.publicId } : null;
    });
}
