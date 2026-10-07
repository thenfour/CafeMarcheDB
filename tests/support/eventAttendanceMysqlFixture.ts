import type { Prisma } from "@prisma/client";
import { Permission } from "shared/permissions";
import { parsePublicId } from "shared/publicId";
import { loadAuthorizationForUser } from "src/auth/server/serverAuthorization";
import { bindDB3ReadSnapshot } from "src/core/db3/server/db3ReadExecution";
import { readUserAttendanceHistory, readUserEventAttendance } from "src/core/db3/server/eventAttendanceRead";
import { updateEventAttendanceInTransaction } from "src/core/db3/server/eventAttendanceWrite";
import type { TupdateUserEventAttendanceMutationArgs } from "src/core/db3/shared/apiTypes";
import { generatePublicId } from "src/server/publicId";
import type { SettingsMysqlFixture } from "./settingsMysqlFixture";

export const responseGrants: Permission[] = [Permission.respond_to_events, Permission.view_events_nonpublic, Permission.visibility_members];

export async function prepareEventAttendanceFixture(tx: Prisma.TransactionClient, fixture: SettingsMysqlFixture, grants = responseGrants) {
    const band = fixture.bands[0]!;
    const bandPublicId = parsePublicId<"Band">(band.publicId);
    const role = await tx.bandRole.create({ data: { publicId: generatePublicId(), name: { create: { publicId: generatePublicId() } },
        bandRolePermissions: { create: (await tx.permission.findMany({ where: { name: { in: grants } } })).map(permission => ({ publicId: generatePublicId(), permissionId: permission.id })) },
    } });
    const member = await tx.bandUser.update({ where: { bandId_userId: { bandId: band.id, userId: fixture.user.id } }, data: { bandRoleId: role.id } });
    const person = await tx.user.findUniqueOrThrow({ where: { id: fixture.user.id } });
    const auth = await loadAuthorizationForUser(person, tx, bandPublicId);
    const visibility = await tx.permission.findUniqueOrThrow({ where: { name: Permission.visibility_members } });
    const event = await tx.event.create({ data: { publicId: generatePublicId(), bandId: band.id, name: "Concert", revision: 1, visiblePermissionId: visibility.id,
        startsAt: new Date("2099-01-01T12:00:00Z"), isAllDay: false, durationMillis: BigInt(3600000),
        segments: { create: [0, 1].map(index => ({ publicId: generatePublicId(), name: `Set ${index + 1}`, description: "", startsAt: new Date(`2099-01-01T1${index + 2}:00:00Z`), durationMillis: BigInt(3600000), isAllDay: false, dateTimeVersion: 2 })) },
    }, include: { segments: true } });
    const strings = await Promise.all(Array.from({ length: 5 }, () => tx.dynamicLocalizedString.create({ data: { publicId: generatePublicId() } })));
    const attendance = await tx.eventAttendance.create({ data: { publicId: generatePublicId(), buttonCaptionId: strings[0]!.id, personalCaptionId: strings[1]!.id,
        pastCaptionId: strings[2]!.id, personalPastCaptionId: strings[3]!.id, descriptionId: strings[4]!.id, strength: 100 } });
    const group = await tx.bandInstrumentFunctionalGroup.create({ data: { publicId: generatePublicId(), bandId: band.id } });
    const instrument = await tx.bandInstrument.create({ data: { publicId: generatePublicId(), bandId: band.id, functionalGroupId: group.id } });
    const args = { bandPublicId, userId: parsePublicId<"User">(person.publicId), eventId: parsePublicId<"Event">(event.publicId) };
    const answers = Object.fromEntries(event.segments.map(segment => [parsePublicId<"EventSegment">(segment.publicId), { attendanceId: parsePublicId<"EventAttendance">(attendance.publicId) }]));
    const write = (patch: Omit<TupdateUserEventAttendanceMutationArgs, keyof typeof args> & Partial<typeof args>) => updateEventAttendanceInTransaction(tx, auth, { ...args, ...patch });
    const snapshot = () => bindDB3ReadSnapshot(tx, auth, { isolationLevel: "Serializable" });
    const read = async () => readUserEventAttendance(await snapshot(), auth, args);
    const history = async (take = 100) => readUserAttendanceHistory(await snapshot(), auth, { bandPublicId, userId: args.userId, take });
    return { band, role, member, person, auth, event, attendance, instrument, args, answers, write, read, history };
}

