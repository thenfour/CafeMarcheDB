import { resolver } from "@blitzjs/rpc";
import db, { Prisma } from "db";
import { Permission } from "shared/permissions";
import * as db3 from "../db3";
import { AuthenticatedMiddlewareCtx, Ctx } from "blitz";
import { CMDBAuthorizeOrThrow } from "types";
import { HomepageContentSpec } from "../shared/apiTypes";

export default resolver.pipe(
    async (input: {}, ctx: Ctx) => {

        const events = await db.event.findMany({
            where: {
                AND: [
                    {
                        frontpageVisible: true,
                    },
                    {
                        visiblePermission: {
                            name: Permission.visibility_public,
                        }
                    },
                    {
                        // tagged as confirmed
                        status: {
                            significance: db3.EventStatusSignificance.FinalConfirmation,
                        }
                    },
                    {
                        // only use events ending in the future, or TBD
                        segments: {
                            some: {
                            }
                        }
                    }]
            }

        });



        // frontpageVisible     Boolean @default(false)
        // frontpageDate        String  @default("") // e.g. "Zaterdag 11 november"
        // frontpageTime        String  @default("") // e.g. 14u
        // frontpageDetails     String  @default("")
        // frontpageTitle       String? // null = use normal one
        // frontpageLocation    String? // null = use normal
        // frontpageLocationURI String? // null = use normal
        // frontpageTags        String? // null, use normal


        // model FrontpageGalleryItem {
        //     id        Int     @id @default(autoincrement())
        //     isDeleted Boolean @default(false)
        //     caption   String // markdown
        //     sortOrder Int     @default(0)
        //     fileId    Int
        //     file      File    @relation(fields: [fileId], references: [id], onDelete: Cascade)
        //   }

        /*
        
        so how will image editing work?
        1. when you upload photos, we need to create a reasonably-sized jpg or webp version
        2. user adjusts the image and when saving, we can create a new variation with correct crop/size. should be done from the original photo; this would clearly be its own mutation.
            - to save gallery item
            - create image variation
            - save file preview data
        
        */


        const ret: HomepageContentSpec = {
            agenda: [{
                title: "*lol* an item"
            }, {
                title: "aoenuhoentuh"
            }],
            gallery: [{
                descriptionMarkdown: "a photo",
                uri: "/images/card.jpg",
            }],
        };

        return ret;
    }
);



