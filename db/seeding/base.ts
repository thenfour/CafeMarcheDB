// Preserved migration reference only. The empty export keeps this file a TypeScript module.
export {};


// MIGRATION_RESTORE: demo-seeding
// Source: 451c9cde3af65ffce804cb7360032dd001c681eb:db/seeding/base.ts:1-80
// Reason: Legacy demo generators were deleted because they referenced removed models.
// Restore: Account for useful sample users, catalogs, songs/files, events/attendance, wiki and activity generators using target-schema ownership; obtain explicit approval for any retired generator.
// Verification: Run restored generators only against a disposable target-schema database and verify their relationships; never restore automatic production startup backfills.
// SHA256: 69b82d1452888a6cd215e86fb9b0a4a65a1c72d6d580f284c7a7e022bf5846e4
// MIGRATION_REFERENCE_BEGIN
// import { faker } from '@faker-js/faker';
// import { Prisma, PrismaClient } from '@prisma/client';
// import { generatePublicId } from '../../src/server/publicId';
//
// function monthsFromNow(months: number): Date {
//     const date = new Date();
//     date.setMonth(date.getMonth() + months);
//     return date;
// }
//
// export class SeedingState {
//     gAllVisibilityPermissions: Prisma.PermissionGetPayload<{}>[] = [];
//     gAllUserTags: Prisma.UserTagGetPayload<{}>[] = [];
//     gAllRoles: Prisma.RoleGetPayload<{}>[] = [];
//     gAllInstruments: Prisma.InstrumentGetPayload<{}>[] = [];
//     gAllEventTypes: Prisma.EventTypeGetPayload<{}>[] = [];
//     gAllEventStatuses: Prisma.EventStatusGetPayload<{}>[] = [];
//     gAllEventTags: Prisma.EventTagGetPayload<{}>[] = [];
//     gAllEvents: Prisma.EventGetPayload<{}>[] = [];
//     gAllWikiPages: Prisma.WikiPageGetPayload<{}>[] = [];
//     gAllUsers: Prisma.UserGetPayload<{}>[] = [];
//     gAllSongTags: Prisma.SongTagGetPayload<{}>[] = [];
//     gAllSongCreditTypes: Prisma.SongCreditTypeGetPayload<{}>[] = [];
//     gAllSongs: Prisma.SongGetPayload<{}>[] = [];
//     gAllAttendanceOptions: Prisma.EventAttendanceGetPayload<{}>[] = [];
//
//     prisma = new PrismaClient();
//
//     config = {
//         userCount: 80,
//         songCount: 100,
//
//         events: {
//             minDate: monthsFromNow(-40),
//             maxDate: monthsFromNow(6),
//         }
//
//
//     };
//
//     constructor() {
//     }
//
//     randomVisibilityPermissionId = () => {
//         return faker.helpers.arrayElement([null, ...this.gAllVisibilityPermissions])?.id || null;
//     };
//
//     FakeFile = async (visiblePermissionId) => {
//         return await this.prisma.file.create({
//             data: {
//                 publicId: generatePublicId<"File">(),
//                 storedLeafName: faker.git.commitSha(),
//                 isDeleted: faker.datatype.boolean(0.8),
//                 fileLeafName: faker.git.commitSha(),
//                 description: faker.datatype.boolean(0.9) ? "" : faker.database.column(),
//                 uploadedAt: faker.date.past(),
//                 mimeType: faker.helpers.arrayElement([
//                     null,
//                     "application/vnd.google-apps.document",
//                     "application/vnd.ms-excel",
//                     "application/pdf",
//                     "application/msword",
//                     "text/plain",
//                     "audio/wav",
//                     "audio/mpeg",
//                     "audio/ogg",
//                     "image/png",
//                     "image/svg+xml",
//                     "video/x-m4v",
//                     "video/x-msvideo",
//                 ]),
//                 sizeBytes: faker.number.int({ min: 0, max: 1000000000 }),
//                 externalURI: faker.datatype.boolean(0.5) ? null : faker.internet.url(),
//                 visiblePermissionId,
//             }
//         });
//     };
//
// };
//
// MIGRATION_REFERENCE_END
