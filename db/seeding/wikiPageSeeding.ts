// Preserved migration reference only. The empty export keeps this file a TypeScript module.
export {};


// MIGRATION_RESTORE: demo-seeding
// Source: 451c9cde3af65ffce804cb7360032dd001c681eb:db/seeding/wikiPageSeeding.ts:1-67
// Reason: Legacy demo generators were deleted because they referenced removed models.
// Restore: Account for useful sample users, catalogs, songs/files, events/attendance, wiki and activity generators using target-schema ownership; obtain explicit approval for any retired generator.
// Verification: Run restored generators only against a disposable target-schema database and verify their relationships; never restore automatic production startup backfills.
// SHA256: e1204ebde15206aab5158532d37b99fcbc516dfe23bca86edf0136e9070d72ce
// MIGRATION_REFERENCE_BEGIN
// import { Prisma } from '@prisma/client';
// import { faker } from '@faker-js/faker';
// import { SeedingState } from './base';
// import { generatePublicId } from '../../src/server/publicId';
//
// export const SeedWikiPages = async (gState: SeedingState) => {
//
//     const wikiPageCount = 30;
//     const wikiPageRevisionMaxCount = 3;
//     const namespaces = [
//         faker.lorem.slug(1),
//         faker.lorem.slug(1),
//         null,
//     ];
//     const pages: Prisma.WikiPageGetPayload<{}>[] = [];
//
//     for (let i = 0; i < wikiPageCount; i++) {
//         const namespace = faker.helpers.arrayElement(namespaces);
//         const slug = faker.lorem.slug({ min: 1, max: 3 });
//         const page = await gState.prisma.wikiPage.create({
//             data: {
//                 publicId: generatePublicId<"WikiPage">(),
//                 slug: namespace ? `${namespace}/${slug}` : slug,
//                 namespace,
//                 visiblePermissionId: gState.randomVisibilityPermissionId(),
//             },
//         });
//         pages.push(page);
//
//         // create revisions for this page
//         const revisionCount = faker.number.int({ min: 1, max: wikiPageRevisionMaxCount });
//         const revisions: Prisma.WikiPageRevisionGetPayload<{}>[] = [];
//         for (let j = 0; j < revisionCount; j++) {
//             const revision = await gState.prisma.wikiPageRevision.create({
//                 data: {
//                     publicId: generatePublicId<"WikiPageRevision">(),
//                     wikiPageId: page.id,
//                     name: faker.lorem.sentence(3),
//                     content: faker.lorem.paragraphs(faker.number.int({ min: 1, max: 5 })),
//                     createdByUserId: faker.helpers.arrayElement(gState.gAllUsers)?.id || null,
//                     createdAt: faker.date.past(),
//                 },
//             });
//             revisions.push(revision);
//         }
//
//         // make sure the latest revision is marked current.
//         // first find the latest revision.
//         const latestRevision = revisions.reduce((prev, current) => {
//             return (prev.createdAt > current.createdAt) ? prev : current;
//         });
//         // update the page with the latest revision.
//         await gState.prisma.wikiPage.update({
//             where: { id: page.id },
//             data: {
//                 currentRevisionId: latestRevision.id,
//             },
//         });
//     };
//     gState.gAllWikiPages = pages;
// };
//
//
//
//
//
//
// MIGRATION_REFERENCE_END
