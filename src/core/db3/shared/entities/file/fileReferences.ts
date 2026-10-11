import { Prisma } from "@prisma/client";
import { defineView } from "../../core/db3View";
import { deriveViewContract } from "../../core/db3ViewContract";
import { xFile, xFrontpageGalleryItem } from "../../schema/file";

// Reference labels and navigation do not need storage paths, download URLs or uploader metadata.
const fileReferenceContract = deriveViewContract(xFile, Prisma.validator<Prisma.FileDefaultArgs>()({
    select: { publicId: true, fileLeafName: true },
}));
export const fileReferenceView = defineView({
    viewID: "File_Reference", entity: xFile,
    selection: fileReferenceContract.prismaSelection,
    dtoSchema: fileReferenceContract.dtoSchema,
    hydrate: fileReferenceContract.hydrate,
});

const galleryReferenceContract = deriveViewContract(xFrontpageGalleryItem, Prisma.validator<Prisma.FrontpageGalleryItemDefaultArgs>()({
    select: { publicId: true, fileId: true },
}));
export const frontpageGalleryItemReferenceView = defineView({
    viewID: "FrontpageGalleryItem_Reference", entity: xFrontpageGalleryItem,
    selection: galleryReferenceContract.prismaSelection,
    dtoSchema: galleryReferenceContract.dtoSchema,
    hydrate: galleryReferenceContract.hydrate,
});
