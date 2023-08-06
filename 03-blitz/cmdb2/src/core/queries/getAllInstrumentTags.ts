import { resolver } from "@blitzjs/rpc";
import db, { Prisma } from "db";
import { Permission } from "shared/permissions";
import { Nullable } from "shared/utils";

interface QueryParams extends Pick<Prisma.InstrumentTagFindManyArgs, "where" | "orderBy" | "skip" | "take"> { };
type QP2 = { localPk: number | null } & QueryParams;
type TRet = Nullable<Prisma.InstrumentTagAssociationGetPayload<{ include: { tag: true } }>>;

export default resolver.pipe(
    resolver.authorize("getAllInstrumentTags", Permission.view_general_info),
    async ({ localPk, ...params }: QP2, ctx) => {
        try {
            const items = await db.instrumentTag.findMany({
                ...params,
                include: {
                    instruments: {
                        include: {
                            instrument: true,
                            tag: true,
                        }
                    }
                }
            });

            // return all as mockup associations
            const ret: TRet[] = items.map(item => {
                return {
                    id: null,
                    instrumentId: localPk,
                    tagId: item.id,
                    tag: item,
                }
            });

            return ret;
        } catch (e) {
            console.error(e);
            throw (e);
        }
    }
);



