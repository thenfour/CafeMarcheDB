import { recordIds } from "../classifyRecords";
import { countEffect, type MergeContext, type MergeDatabase, type MergePolicy } from "../types";

// heard you like plugins...
// so here is a plugin-like structure inside a plugin

// all "author"-like content ownership gets merged to the main user

const ownerships = [
    {
        relation: "Song.createdByUserId",
        label: "Songs",
        delegate: (db: MergeDatabase): OwnershipDelegate => ({ findMany: args => db.song.findMany(args), updateMany: args => db.song.updateMany(args) }),
    },
    {
        relation: "Event.createdByUserId",
        label: "Events",
        delegate: (db: MergeDatabase): OwnershipDelegate => ({ findMany: args => db.event.findMany(args), updateMany: args => db.event.updateMany(args) }),
    },
    {
        relation: "FrontpageGalleryItem.createdByUserId",
        label: "Gallery items",
        delegate: (db: MergeDatabase): OwnershipDelegate => ({ findMany: args => db.frontpageGalleryItem.findMany(args), updateMany: args => db.frontpageGalleryItem.updateMany(args) }),
    },
    {
        relation: "CustomLink.createdByUserId",
        label: "Custom links",
        delegate: (db: MergeDatabase): OwnershipDelegate => ({ findMany: args => db.customLink.findMany(args), updateMany: args => db.customLink.updateMany(args) }),
    },
    {
        relation: "MenuLink.createdByUserId",
        label: "Menu links",
        delegate: (db: MergeDatabase): OwnershipDelegate => ({ findMany: args => db.menuLink.findMany(args), updateMany: args => db.menuLink.updateMany(args) }),
    },
    {
        relation: "WikiPage.createdByUserId",
        label: "Wiki pages",
        delegate: (db: MergeDatabase): OwnershipDelegate => ({ findMany: args => db.wikiPage.findMany(args), updateMany: args => db.wikiPage.updateMany(args) }),
    },
    {
        relation: "SetlistPlan.createdByUserId",
        label: "Setlist plans",
        delegate: (db: MergeDatabase): OwnershipDelegate => ({ findMany: args => db.setlistPlan.findMany(args), updateMany: args => db.setlistPlan.updateMany(args) }),
    },
    {
        relation: "SetlistPlanGroup.createdByUserId",
        label: "Setlist plan groups",
        delegate: (db: MergeDatabase): OwnershipDelegate => ({ findMany: args => db.setlistPlanGroup.findMany(args), updateMany: args => db.setlistPlanGroup.updateMany(args) }),
    },
] as const;

// shared shape for tables with exactly this ownership field.
type OwnershipDelegate = {
    findMany: (args: {
        where: { createdByUserId: number };
        select: { id: true };
        orderBy: { id: "asc" };
    }) => Promise<{ id: number }[]>;
    updateMany: (args: {
        where: { id: { in: number[] } };
        data: { createdByUserId: number };
    }) => Promise<unknown>;
};

async function prepareOwnership(context: MergeContext, ownership: typeof ownerships[number]) {
    const delegate = ownership.delegate(context.db);
    const records = await delegate.findMany({
        where: { createdByUserId: context.retiringUserId },
        select: { id: true }, orderBy: { id: "asc" },
    });

    return {
        relation: ownership.relation,
        records,
        effect: countEffect(`${ownership.label} attributed to Main`, records.length),
        apply: (db: MergeDatabase) => (ownership.delegate(db)).updateMany({
            where: { id: { in: recordIds(records) } },
            data: { createdByUserId: context.mainUserId },
        }),
    };
}

export const authoredContentPolicy: MergePolicy = {
    key: "authoredContent",
    userRelations: ownerships.map(ownership => ownership.relation),
    async prepare(context) {
        const plans: Awaited<ReturnType<typeof prepareOwnership>>[] = [];
        for (const ownership of ownerships) {
            plans.push(await prepareOwnership(context, ownership));
        }
        return {
            reviewState: plans.map(plan => ({
                relation: plan.relation,
                records: plan.records,
            })),
            report: {
                key: "authoredContent",
                title: "Authored content",
                policy: "Transfer current creator attribution and ownership to Main, including deactivated content. Preserve historical editing and audit records.",
                effects: plans.map(plan => plan.effect),
            },
            async apply(db) {
                for (const plan of plans) {
                    await plan.apply(db)
                };
            },
        };
    },
};
