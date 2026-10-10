import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { faker } from "@faker-js/faker";
import type { File } from "@prisma/client";
import { generatePublicId } from "../../src/server/publicId";
import { sampleScore, createSampleRecording } from "./assets";
import { seedContentAuthorship, type SeedingState } from "./base";
import { choose, probability, randomDate, subset } from "./random";

interface SeedAsset { extension: string; mimeType: string; bytes: Buffer; }

function createScorePdf(): Buffer {
    const stream = "BT /F1 20 Tf 50 760 Td (CMDB rehearsal score) Tj 0 -35 Td /F1 12 Tf (Original development sample) Tj ET\n";
    const objects = ["<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
        "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>", `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}endstream`];
    let pdf = "%PDF-1.4\n";
    const offsets = [0];
    for (const [index, object] of objects.entries()) {
        offsets.push(Buffer.byteLength(pdf));
        pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
    }
    const xref = Buffer.byteLength(pdf);
    pdf += `xref\n0 ${offsets.length}\n0000000000 65535 f \n`;
    for (const offset of offsets.slice(1)) {
        pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
    }
    pdf += `trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
    return Buffer.from(pdf);
}

const assets: readonly SeedAsset[] = [
    { extension: "svg", mimeType: "image/svg+xml", bytes: Buffer.from(sampleScore) },
    { extension: "wav", mimeType: "audio/wav", bytes: createSampleRecording() },
    { extension: "pdf", mimeType: "application/pdf", bytes: createScorePdf() },
    { extension: "txt", mimeType: "text/plain", bytes: Buffer.from("Rehearsal notes\nRépétition / Repetitie\nBring your music stand.\n") },
];

export async function seedFile(state: SeedingState, visiblePermissionId: number | null,
    options: { assetIndex: number | null; isDeleted: boolean; name: string }): Promise<File> {
    const asset = options.assetIndex === null ? choose(assets) : assets[options.assetIndex]!;
    const publicId = generatePublicId<"File">();
    const storedLeafName = `seed-${publicId}.${asset.extension}`;
    await mkdir(state.assetDirectory, { recursive: true });
    // Never clear the upload directory: it can also hold manually uploaded files.
    await writeFile(path.join(state.assetDirectory, storedLeafName), new Uint8Array(asset.bytes));
    const upload = seedContentAuthorship(state, state.now);
    const file = await state.db.file.create({ data: {
        publicId, bandId: state.band.band.id, storedLeafName, fileLeafName: `${options.name}.${asset.extension}`,
        description: probability(0.1) ? faker.lorem.paragraph() : "", isDeleted: options.isDeleted,
        sizeBytes: asset.bytes.length, mimeType: options.assetIndex !== null || probability(0.9) ? asset.mimeType : null,
        // External-link examples still point to these real, band-authorized hosted bytes.
        externalURI: options.assetIndex === null && probability(0.5)
            ? `/api/files/download/${storedLeafName}?bandPublicId=${state.band.band.publicId}` : null,
        uploadedAt: upload.createdAt,
        fileCreatedAt: probability(0.5) ? randomDate(new Date(upload.createdAt.valueOf() - 365 * 86_400_000), upload.createdAt) : null,
        uploadedByUserId: upload.createdByUserId, visiblePermissionId,
    } });
    await state.db.bandFileTagAssignment.createMany({ data: subset(state.band.fileTags, 0, state.band.fileTags.length).map(tag => ({
        publicId: generatePublicId<"BandFileTagAssignment">(), fileId: file.id, bandFileTagId: tag.id,
    })) });
    await state.db.fileInstrumentTag.createMany({ data: subset(state.band.instruments, 0, 3).map(instrument => ({
        publicId: generatePublicId<"FileInstrumentTag">(), fileId: file.id, bandInstrumentId: instrument.id,
    })) });
    await state.db.fileUserTag.createMany({ data: subset(state.band.members, 0, 3).map(member => ({
        publicId: generatePublicId<"FileUserTag">(), fileId: file.id, bandUserId: member.id,
    })) });
    return file;
}

export async function seedBandSampleFiles(state: SeedingState, firstSongId: number | null): Promise<void> {
    const memberVisibility = await state.db.permission.findUniqueOrThrow({ where: { name: "visibility_members" } });
    for (const [assetIndex, slug] of ["score", "recording"].entries()) {
        const file = await seedFile(state, memberVisibility.id, { assetIndex, isDeleted: false, name: `${state.band.title}-${slug}` });
        await state.db.customLink.create({ data: {
            publicId: generatePublicId<"CustomLink">(), bandId: state.band.band.id, slug, name: slug,
            description: "Development sample asset", redirectType: "ServeFile", fileId: file.id, createdByUserId: state.band.manager.id,
            createdAt: randomDate(file.uploadedAt, state.now),
        } });
        if (firstSongId !== null) {
            await state.db.fileSongTag.create({ data: { publicId: generatePublicId<"FileSongTag">(), fileId: file.id, songId: firstSongId } });
            if (assetIndex === 1) {
                await state.db.song.update({ where: { id: firstSongId }, data: { pinnedRecordingId: file.id } });
            }
        }
    }
}
