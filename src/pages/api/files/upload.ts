import { BandPermission } from "src/auth/shared/bandPermissionPolicy";
import type { Ctx } from "@blitzjs/next";
import { AuthenticationError, AuthorizationError, NotFoundError } from "blitz";
import db from "db";
import formidable from "formidable";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { Permission } from "shared/permissions";
import { api } from "src/blitz-server";
import { loadAuthorization } from "src/auth/server/serverAuthorization";
import { BandPublicIdSchema } from "src/locale/shared/presentationInput";
import { MakeErrorUploadResponsePayload } from "src/core/db3/shared/fileAPI";
import { FileUploadArgsSchema } from "src/core/db3/shared/fileUpload";
import type { UploadResponsePayload } from "src/core/db3/shared/fileTypes";
import { FileUploadInputError, uploadFiles } from "src/core/db3/server/fileUpload";
import { GetFileServerStoragePath } from "src/core/db3/server/db3mutationCore";

export const config = { api: { bodyParser: false } };

export async function uploadFileRoute(req: NextApiRequest, res: NextApiResponse<UploadResponsePayload>, ctx: Ctx): Promise<void> {
    res.setHeader("Cache-Control", "no-store");
    let staging: string | undefined;
    let storageDirectory: string | undefined;
    try {
        ctx.session.$authorize(Permission.login);
        if (req.method !== "POST") {
            res.setHeader("Allow", "POST");
            res.status(405).end();
            return;
        }
        const bandPublicId = BandPublicIdSchema.parse(req.query.bandPublicId);
        const auth = (await loadAuthorization(ctx.session, bandPublicId)).requireUser();
        auth.requirePermission(BandPermission.upload_files);
        storageDirectory = path.dirname(GetFileServerStoragePath("upload-staging"));
        await mkdir(storageDirectory, { recursive: true });
        staging = await mkdtemp(path.join(storageDirectory, ".incoming-"));
        const form = formidable({ uploadDir: staging, maxFiles: 20, maxFileSize: 200 * 1024 * 1024,
            maxTotalFileSize: 200 * 1024 * 1024, maxFields: 16, maxFieldsSize: 16 * 1024 });
        const [fields, files] = await form.parse(req);
        // Multipart fields can repeat; this endpoint accepts exactly one value per declared field.
        const singleFields = Object.fromEntries(Object.entries(fields).map(([name, values]) => {
            if (!values || values.length !== 1) {
                throw new FileUploadInputError("Upload fields must have one value each.");
            }
            return [name, values[0]];
        }));
        if (Object.prototype.hasOwnProperty.call(singleFields, "bandPublicId")) {
            throw new FileUploadInputError("Select the upload band in the request URL.");
        }
        const input = FileUploadArgsSchema.parse({ ...singleFields, bandPublicId });
        const parts = Object.values(files).flatMap(values => values ?? []).map(file => ({
            temporaryPath: file.filepath, originalFilename: file.originalFilename ?? "",
            lastModifiedDate: file.mtime ?? null,
        }));
        res.status(200).json(await uploadFiles(db, auth, input, parts, storageDirectory));
    } catch (error) {
        let status = 500;
        if (error instanceof AuthenticationError || error instanceof AuthorizationError || error instanceof NotFoundError) {
            status = error.statusCode;
        } else if (error instanceof z.ZodError || error instanceof FileUploadInputError) {
            status = 400;
        } else if (error instanceof Error && "httpCode" in error && typeof error.httpCode === "number") {
            status = error.httpCode;
        }
        const message = error instanceof Error ? error.message : "Upload failed.";
        res.status(status).json(MakeErrorUploadResponsePayload(message));
    } finally {
        if (staging && storageDirectory) {
            // mkdtemp created this exact directory immediately beneath the trusted storage root.
            if (path.dirname(staging) !== storageDirectory || !path.basename(staging).startsWith(".incoming-")) {
                throw new Error("Invalid upload staging directory.");
            }
            await rm(staging, { recursive: true, force: true });
        }
    }
}
export default api(uploadFileRoute);
