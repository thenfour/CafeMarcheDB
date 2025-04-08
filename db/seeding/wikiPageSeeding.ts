import { Prisma } from '@prisma/client';
import { faker } from '@faker-js/faker';
import { SeedingState } from './base';

export const SeedWikiPages = async (gState: SeedingState) => {

    const wikiPageCount = 30;
    const wikiPageRevisionMaxCount = 3;
    const namespaces = [
        faker.lorem.slug(1),
        faker.lorem.slug(1),
        null,
    ];
    const pages: Prisma.WikiPageGetPayload<{}>[] = [];

    for (let i = 0; i < wikiPageCount; i++) {
        const namespace = faker.helpers.arrayElement(namespaces);
        const slug = faker.lorem.slug({ min: 1, max: 3 });
        const page = await gState.prisma.wikiPage.create({
            data: {
                slug: namespace ? `${namespace}/${slug}` : slug,
                namespace,
                visiblePermissionId: gState.randomVisibilityPermissionId(),
            },
        });
        pages.push(page);

        // create revisions for this page
        const revisionCount = faker.number.int({ min: 1, max: wikiPageRevisionMaxCount });
        const revisions: Prisma.WikiPageRevisionGetPayload<{}>[] = [];
        for (let j = 0; j < revisionCount; j++) {
            const revision = await gState.prisma.wikiPageRevision.create({
                data: {
                    wikiPageId: page.id,
                    name: faker.lorem.sentence(3),
                    content: faker.lorem.paragraphs(faker.number.int({ min: 1, max: 5 })),
                    createdByUserId: faker.helpers.arrayElement(gState.gAllUsers)?.id || null,
                    createdAt: faker.date.past(),
                },
            });
            revisions.push(revision);
        }

        // make sure the latest revision is marked current.
        // first find the latest revision.
        const latestRevision = revisions.reduce((prev, current) => {
            return (prev.createdAt > current.createdAt) ? prev : current;
        });
        // update the page with the latest revision.
        await gState.prisma.wikiPage.update({
            where: { id: page.id },
            data: {
                currentRevisionId: latestRevision.id,
            },
        });
    };
    gState.gAllWikiPages = pages;
};






