import { PrismaClient, Prisma } from '@prisma/client'
import { gPermissionOrdered } from '../../shared/permissions'
import { faker } from '@faker-js/faker';
import { slugify } from '../../shared/rootroot';
import { DateTimeRange, gMillisecondsPerDay, roundToNearest15Minutes } from '../../shared/time';

function monthsFromNow(months: number): Date {
    const date = new Date();
    date.setMonth(date.getMonth() + months);
    return date;
}

export class SeedingState {
    gAllVisibilityPermissions: Prisma.PermissionGetPayload<{}>[] = [];
    gAllUserTags: Prisma.UserTagGetPayload<{}>[] = [];
    gAllRoles: Prisma.RoleGetPayload<{}>[] = [];
    gAllInstruments: Prisma.InstrumentGetPayload<{}>[] = [];
    gAllEventTypes: Prisma.EventTypeGetPayload<{}>[] = [];
    gAllEventStatuses: Prisma.EventStatusGetPayload<{}>[] = [];
    gAllEventTags: Prisma.EventTagGetPayload<{}>[] = [];
    gAllUsers: Prisma.UserGetPayload<{}>[] = [];
    gAllSongTags: Prisma.SongTagGetPayload<{}>[] = [];
    gAllSongCreditTypes: Prisma.SongCreditTypeGetPayload<{}>[] = [];
    gAllSongs: Prisma.SongGetPayload<{}>[] = [];
    gAllAttendanceOptions: Prisma.EventAttendanceGetPayload<{}>[] = [];

    prisma = new PrismaClient();

    config = {
        userCount: 100,
        songCount: 150,

        events: {
            minDate: monthsFromNow(-120),
            maxDate: monthsFromNow(9),
        }


    };

    constructor() {
    }

    randomVisibilityPermissionId = () => {
        return faker.helpers.arrayElement([null, ...this.gAllVisibilityPermissions])?.id || null;
    };

    FakeFile = async (visiblePermissionId) => {
        return await this.prisma.file.create({
            data: {
                storedLeafName: faker.git.commitSha(),
                isDeleted: faker.datatype.boolean(0.8),
                fileLeafName: faker.git.commitSha(),
                description: faker.datatype.boolean(0.9) ? "" : faker.database.column(),
                uploadedAt: faker.date.past(),
                mimeType: faker.helpers.arrayElement([
                    null,
                    "application/vnd.google-apps.document",
                    "application/vnd.ms-excel",
                    "application/pdf",
                    "application/msword",
                    "text/plain",
                    "audio/wav",
                    "audio/mpeg",
                    "audio/ogg",
                    "image/png",
                    "image/svg+xml",
                    "video/x-m4v",
                    "video/x-msvideo",
                ]),
                sizeBytes: faker.number.int({ min: 0, max: 1000000000 }),
                externalURI: faker.datatype.boolean(0.5) ? null : faker.internet.url(),
                visiblePermissionId,
            }
        });
    };

};

