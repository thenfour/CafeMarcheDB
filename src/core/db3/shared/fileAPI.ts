
import { Prisma } from "db";
import { isNonEmptyString } from "@/shared/utils";

export enum FileClass {
    Audio = "audio",
    Image = "image",
    Video = "video",
    Document = "document",
    Archive = "archive",
    Other = "other",
    Link = "link",
};

export const GetFileClass = (file: Prisma.FileGetPayload<{ select: { externalURI, mimeType, fileLeafName } }>): FileClass => {
    if (file.externalURI) return FileClass.Link;
    if (isNonEmptyString(file.mimeType)) {
        if (file.mimeType.startsWith("audio/")) return FileClass.Audio;
        if (file.mimeType.startsWith("image/")) return FileClass.Image;
        if (file.mimeType.startsWith("video/")) return FileClass.Video;
        if (file.mimeType.startsWith("application/pdf") || file.mimeType.startsWith("text/")) return FileClass.Document;
        if (file.mimeType.startsWith("application/zip") || file.mimeType.startsWith("application/x-tar")) return FileClass.Archive;
    }
    // check extensions
    const ext = file.fileLeafName.split('.').pop()?.toLowerCase();
    if (ext) {
        if (["mp3", "wav", "flac"].includes(ext)) return FileClass.Audio;
        if (["jpg", "jpeg", "png", "gif"].includes(ext)) return FileClass.Image;
        if (["mp4", "avi", "mkv"].includes(ext)) return FileClass.Video;
        if (["pdf", "txt", "docx"].includes(ext)) return FileClass.Document;
        if (["zip", "tar", "gz"].includes(ext)) return FileClass.Archive;
    }
    return FileClass.Other;
}
