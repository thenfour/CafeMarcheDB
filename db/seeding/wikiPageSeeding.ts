import { faker } from "@faker-js/faker";
import type { WikiPage } from "@prisma/client";
import { generatePublicId } from "../../src/server/publicId";
import { randomVisibilityPermissionId, seedContentAuthorship, type SeedingState } from "./base";
import { choose, probability, randomDate, subset } from "./random";

export async function seedWikiPage(state: SeedingState, slug: string, visiblePermissionId: number | null,
    title: string, content: string, revisionCount: number): Promise<WikiPage> {
    const authorship = seedContentAuthorship(state, state.now);
    const page = await state.db.wikiPage.create({ data: {
        publicId: generatePublicId<"WikiPage">(), bandId: state.band.band.id, slug,
        namespace: slug.includes("/") ? slug.slice(0, slug.lastIndexOf("/")) : null,
        visiblePermissionId, ...authorship, contentVersion: revisionCount,
    } });
    const dates = Array.from({ length: revisionCount }, (_, index) => index === 0 ? authorship.createdAt
        : randomDate(authorship.createdAt, state.now))
        .sort((a, b) => a.valueOf() - b.valueOf());
    let latestRevisionId: number | null = null;
    for (const [index, createdAt] of dates.entries()) {
        const revision = await state.db.wikiPageRevision.create({ data: {
            publicId: generatePublicId<"WikiPageRevision">(), wikiPageId: page.id,
            name: index === revisionCount - 1 ? title : faker.lorem.sentence(3),
            content: index === revisionCount - 1 ? content : faker.lorem.paragraphs(faker.number.int({ min: 1, max: 5 })),
            createdAt, createdByUserId: probability(0.9) ? choose(state.band.members.filter(member => member.createdAt <= createdAt)).userId : null,
        } });
        latestRevisionId = revision.id;
    }
    await state.db.wikiPageTagAssignment.createMany({ data: subset(state.band.wikiTags, 0, 3).map(tag => ({
        publicId: generatePublicId<"WikiPageTagAssignment">(), wikiPageId: page.id, bandWikiPageTagId: tag.id,
    })) });
    return state.db.wikiPage.update({ where: { id: page.id }, data: { currentRevisionId: latestRevisionId } });
}

export async function seedWikiPages(state: SeedingState, count: number): Promise<WikiPage[]> {
    const pages: WikiPage[] = [];
    const memberVisibility = await state.db.permission.findUniqueOrThrow({ where: { name: "visibility_members" } });
    for (const locale of state.band.locales) {
        const language = locale === "fr-BE" ? { slug: "bienvenue", title: "Bienvenue", text: "La répétition a lieu chaque semaine." }
            : locale === "nl-BE" ? { slug: "welkom", title: "Welkom", text: "We repeteren elke week." }
                : { slug: "welcome", title: "Welcome", text: "We rehearse every week." };
        pages.push(await seedWikiPage(state, language.slug, memberVisibility.id, `${language.title} — ${state.band.title}`,
            `# ${state.band.title}\n\n${language.text}\n\n[Score](/score?bandPublicId=${state.band.band.publicId})`, 1));
    }
    const namespaces = [faker.lorem.slug(1), faker.lorem.slug(1), null];
    for (let index = 0; index < count; index++) {
        const namespace = choose(namespaces);
        // The suffix prevents random slug collisions from failing a whole reset.
        const slug = `${namespace ? `${namespace}/` : ""}${faker.lorem.slug({ min: 1, max: 3 })}-${index + 1}`;
        pages.push(await seedWikiPage(state, slug, randomVisibilityPermissionId(state), faker.lorem.sentence(3),
            faker.lorem.paragraphs(faker.number.int({ min: 1, max: 5 })), faker.number.int({ min: 1, max: 3 })));
    }
    return pages;
}
