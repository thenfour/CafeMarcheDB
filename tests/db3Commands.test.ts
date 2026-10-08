import { songCreditTypeReferenceFixture } from "./support/catalogReferenceFixtures";
import { eventAttendanceDtoFixture } from "./support/eventCatalogFixtures";
import { eventPublicId, segmentPublicId } from "./support/eventResponseFixtures";
import { attendancePublicId } from "./support/eventAttendanceFixtures";
import { listPublicId, listSongPublicId } from "./support/eventSongListFixtures";
import { songPublicId } from "./support/songFixtures";
import { userPublicId } from "./support/userFixtures";
import { describe, expect, expectTypeOf, it, vi } from "vitest";
import * as db3 from "@db3/db3";
import { eventSongListSaveCommandHandler } from "@db3/server/commands/eventSongListSaveCommand";
import type { DB3CommandExecutionContext } from "@db3/server/db3CommandCore";
import { getDB3CommandHandler } from "@db3/server/db3CommandRegistry";
import { defineEntityCrudCommandHandlers } from "@db3/server/db3EntityCrudCommand";
import type { ColorPaletteEntry } from "@components/color/palette";
import {
    isPublicId,
    parsePublicId,
    type EventStatusPublicId,
    type SetlistPlanGroupPublicId,
} from "shared/publicId";
import { z } from "zod";

const eventStatusPublicId: EventStatusPublicId = parsePublicId<"EventStatus">("CommandStatus001");
const userTagPublicId = parsePublicId<"UserTag">("CommandUserTag01");
const songCreditTypePublicId = parsePublicId<"SongCreditType">("CommandCreditTyp");
const songCreditPublicId = parsePublicId<"SongCredit">("CommandCreditRow");
const userInstrumentPublicId = parsePublicId<"UserInstrument">("CommandUsrInstr1");

function createContext(seed?: {
    songList?: Record<string, unknown> | null;
    songs?: Record<string, unknown>[];
    dividers?: Record<string, unknown>[];
}) {
    const insert = vi.fn(async (
        entity: db3.AnyDB3Table,
        values: Record<string, unknown>,
    ): Promise<Record<string, unknown>> => ({
        id: entity.tableID === db3.xEventSongList.tableID ? 50 : 900,
        publicId: listPublicId(50),
        ...values,
    }));
    const update = vi.fn(async (_entity: db3.AnyDB3Table, id: db3.DB3Identity, values: Record<string, unknown>) => ({
        id,
        ...values,
    }));
    const deleteRow = vi.fn(async () => undefined);
    const requireVisible = vi.fn(async (entity: db3.AnyDB3Table, identity: db3.DB3Identity) => ({
        ...(entity === db3.xEventSongList
            ? seed?.songList
            : entity === db3.xEvent
                ? { id: 5, publicId: eventPublicId(5) }
                : entity === db3.xSong
                    ? { id: 7, publicId: songPublicId(7) }
                : { id: identity }),
        tableID: entity.tableID,
    }));
    const afterMutation = vi.fn(async () => undefined);
    const context: DB3CommandExecutionContext = {
        authorization: {} as any,
        transaction: {
            eventSongList: {
                findFirst: vi.fn(async () => seed?.songList ?? null),
            },
            eventSongListSong: {
                findMany: vi.fn(async () => seed?.songs ?? []),
            },
            eventSongListDivider: {
                findMany: vi.fn(async () => seed?.dividers ?? []),
            },
        } as any,
        rowServices: {
            optIn: vi.fn(),
            insert,
            update,
            delete: deleteRow,
            requireVisible,
            afterMutation,
        },
    };
    return { context, insert, update, deleteRow, requireVisible, afterMutation };
}

const parentFields = {
    eventId: eventPublicId(5),
    name: "Concert set",
    description: "Main set",
    isActuallyPlayed: false,
    isOrdered: true,
    sortOrder: 3,
};

const SetlistPlanGroupPublicIdSchema = z.custom<SetlistPlanGroupPublicId>(
    (value): value is SetlistPlanGroupPublicId => isPublicId(value),
    "Expected an SetlistPlanGroup public ID.",
);
const setlistPlanGroupCrud = db3.defineEntityCrudCommands({
    entity: db3.xSetlistPlanGroup,
    identitySchema: SetlistPlanGroupPublicIdSchema,
    operations: { create: true, update: true, delete: true },
    createSchema: z.object({
        name: z.string().min(1),
        description: z.string(),
        sortOrder: z.number().int(),
        color: z.string().nullable(),
    }),
    updateFieldsSchema: z.object({
        name: z.string().min(1),
        description: z.string(),
        sortOrder: z.number().int(),
        color: z.string().nullable(),
    }),
});
const setlistPlanGroupCrudHandlers = defineEntityCrudCommandHandlers(
    setlistPlanGroupCrud,
);
const setlistGroupPublicId = parsePublicId<"SetlistPlanGroup">("AbCdEfGhIjKlMn01");
const songTagPublicId = parsePublicId<"SongTag">("AbCdEfGhIjKlMn05");
const otherSongTagPublicId = parsePublicId<"SongTag">("AbCdEfGhIjKlMn06");
const songTagAssociationPublicId = parsePublicId<"SongTagAssociation">("AbCdEfGhIjKlMn07");
const instrumentPublicId = parsePublicId<"Instrument">("AbCdEfGhIjKlMn08");
const wikiPageTagPublicId = parsePublicId<"WikiPageTag">("AbCdEfGhIjKlMn09");
const otherSetlistGroupPublicId = parsePublicId<"SetlistPlanGroup">("AbCdEfGhIjKlMn02");
const publicIdentityAssociationCommand = db3.defineAssociationCommand({
    commandID: "SetlistPlanGroup_RelationshipTest",
    localEntity: db3.xSetlistPlanGroup,
    foreignEntity: db3.xSetlistPlanGroup,
    localIdentitySchema: SetlistPlanGroupPublicIdSchema,
    foreignIdentitySchema: SetlistPlanGroupPublicIdSchema,
});

describe("DB3 commands", () => {
    it("validates strict command DTOs and results at the shared boundary", () => {
        expect(db3.saveEventSongListCommand.commandID).toBe("EventSongList_Save");
        expect(() => db3.saveEventSongListCommand.parseDto({
            ...parentFields,
            songs: [],
            dividers: [],
            unexpected: true,
        })).toThrow();
        expect(db3.saveEventSongListCommand.parseResult({ publicId: listPublicId(50) })).toEqual({ publicId: listPublicId(50) });
        expect(() => db3.saveEventSongListCommand.parseResult({ id: -1 })).toThrow();
        expect(db3.saveEventSongListCommand.invalidation).toEqual({
            mode: "caller",
            entityIDs: ["EventSongList", "EventSongListSong", "EventSongListDivider"],
        });
    });

    it("defines strict generated CRUD DTOs with present-keys-only patch semantics", () => {
        expectTypeOf<db3.CommandClientInputOf<typeof setlistPlanGroupCrud.operations.create.command>>()
            .toEqualTypeOf<{
                name: string;
                description: string;
                sortOrder: number;
                color: string | null;
            }>();
        expectTypeOf<db3.CommandClientInputOf<typeof setlistPlanGroupCrud.operations.update.command>>()
            .toEqualTypeOf<{
                identity: SetlistPlanGroupPublicId;
                patch: {
                    name?: string;
                    description?: string;
                    sortOrder?: number;
                    color?: string | null;
                };
            }>();
        expectTypeOf<db3.CommandResultOf<typeof setlistPlanGroupCrud.operations.delete.command>>()
            .toEqualTypeOf<{ identity: SetlistPlanGroupPublicId }>();
        expect(setlistPlanGroupCrud.operations.create.command.commandID)
            .toBe("SetlistPlanGroup_Create");
        expect(setlistPlanGroupCrud.operations.update.command.commandID)
            .toBe("SetlistPlanGroup_Update");
        expect(setlistPlanGroupCrud.operations.delete.command.commandID)
            .toBe("SetlistPlanGroup_Delete");
        expect(setlistPlanGroupCrud.operations.delete.deleteType).toBe("hard");
        expect(setlistPlanGroupCrud.operations.update.command.parseDto({
            identity: setlistGroupPublicId,
            patch: { color: null },
        })).toEqual({
            identity: setlistGroupPublicId,
            patch: { color: null },
        });
        expect(() => setlistPlanGroupCrud.operations.create.command.parseDto({
            name: "Brass",
            description: "",
            sortOrder: 0,
            color: null,
            publicId: setlistGroupPublicId,
        })).toThrow();
        expect(() => db3.defineEntityCrudCommands({
            entity: db3.xSetlistPlanGroup,
            identitySchema: SetlistPlanGroupPublicIdSchema,
            operations: { create: true, update: true, delete: true },
            createSchema: z.object({ publicId: SetlistPlanGroupPublicIdSchema }),
            updateFieldsSchema: z.object({ name: z.string() }),
        })).toThrow("must not declare server-owned identity fields: publicId");
        expect(() => setlistPlanGroupCrud.operations.update.command.parseDto({
            identity: setlistGroupPublicId,
            patch: {},
        })).toThrow("Update patch must contain at least one field");
        expect(() => setlistPlanGroupCrud.operations.update.command.parseDto({
            identity: setlistGroupPublicId,
            patch: { name: undefined },
        })).toThrow("Patch fields cannot be undefined");
        expect(() => setlistPlanGroupCrud.operations.update.command.parseDto({
            identity: 42,
            patch: { name: "Brass" },
        })).toThrow();
        expect(() => setlistPlanGroupCrud.operations.delete.command.parseDto({
            identity: setlistGroupPublicId,
            deleteType: "hard",
        })).toThrow();
        expect(setlistPlanGroupCrud.operations.create.command.invalidation).toEqual({
            mode: "caller",
            entityIDs: [db3.xSetlistPlanGroup.tableID],
        });
    });

    it("executes generated CRUD through row services and returns canonical identity", async () => {
        const { context, insert, update, deleteRow } = createContext();
        insert.mockResolvedValueOnce({
            id: 12,
            publicId: setlistGroupPublicId,
            name: "Brass",
        });

        await expect(setlistPlanGroupCrudHandlers.create!.execute({
            name: "Brass",
            description: "",
            sortOrder: 0,
            color: null,
        }, context)).resolves.toEqual({ identity: setlistGroupPublicId });
        expect(insert).toHaveBeenLastCalledWith(db3.xSetlistPlanGroup, {
            name: "Brass",
            description: "",
            sortOrder: 0,
            color: null,
        });

        await expect(setlistPlanGroupCrudHandlers.update!.execute({
            identity: setlistGroupPublicId,
            patch: { name: "Winds" },
        }, context)).resolves.toEqual({ identity: setlistGroupPublicId });
        expect(update).toHaveBeenLastCalledWith(
            db3.xSetlistPlanGroup,
            setlistGroupPublicId,
            { name: "Winds" },
        );

        await expect(setlistPlanGroupCrudHandlers.delete!.execute({
            identity: setlistGroupPublicId,
        }, context)).resolves.toEqual({ identity: setlistGroupPublicId });
        expect(deleteRow).toHaveBeenLastCalledWith(
            db3.xSetlistPlanGroup,
            setlistGroupPublicId,
            "hard",
        );
        expect(setlistPlanGroupCrudHandlers.all).toHaveLength(3);

        insert.mockResolvedValueOnce({ id: 13, name: "Missing public identity" });
        await expect(setlistPlanGroupCrudHandlers.create!.execute({
            name: "Strings",
            description: "",
            sortOrder: 1,
            color: null,
        }, context)).rejects.toThrow("Expected an SetlistPlanGroup public ID");
    });

    it("keeps the generic association contract on public client identities", () => {
        const payload = publicIdentityAssociationCommand.serialize({
            local: { publicId: setlistGroupPublicId } as any,
            foreign: { publicId: otherSetlistGroupPublicId } as any,
            isAssociated: false,
        });

        expect(payload).toEqual({
            localIdentity: setlistGroupPublicId,
            foreignIdentity: otherSetlistGroupPublicId,
            isAssociated: false,
        });
        expect(publicIdentityAssociationCommand.parseDto(payload)).toEqual(payload);
        expect(() => publicIdentityAssociationCommand.parseDto({
            ...payload,
            localIdentity: 42,
        })).toThrow("Expected an SetlistPlanGroup public ID");
    });

    it("composes and registers CRUD from the SetlistPlanGroup editor view", async () => {
        const view = db3.setlistPlanGroupEditorView;
        expect(view.entity).toBe(db3.xSetlistPlanGroup);
        expect(db3.getDB3CrudViewForCommand(view.crud.operations.create.command.commandID)).toBe(view);
        expect(view.crud.operations.create.command.parseDto({
            name: "Brass",
            description: "",
            sortOrder: 0,
            color: null,
        })).toEqual({
            name: "Brass",
            description: "",
            sortOrder: 0,
            color: null,
        });
        expect(() => view.crud.operations.create.command.parseDto({
            name: "Brass",
            publicId: setlistGroupPublicId,
        })).toThrow();
        expect(() => view.crud.operations.create.command.parseDto({
            name: "Brass",
            plans: [],
        })).toThrow();
        expect(() => view.crud.operations.create.command.parseDto({ name: 42 }))
            .toThrow("field is of unknown type");
        expect(() => view.crud.operations.update.command.parseDto({
            identity: setlistGroupPublicId,
            patch: { sortOrder: "not a number" },
        })).toThrow("Input string was not convertible to integer");
        expect(() => view.crud.operations.update.command.parseDto({
            identity: setlistGroupPublicId,
            patch: { unknownField: true },
        })).toThrow();

        const createHandler = getDB3CommandHandler(view.crud.operations.create.command.commandID);
        expect(createHandler.command).toBe(view.crud.operations.create.command);
        const { context, insert } = createContext();
        insert.mockResolvedValueOnce({
            id: 15,
            publicId: setlistGroupPublicId,
            name: "Brass",
        });
        await expect(createHandler.execute({ name: "Brass" }, context))
            .resolves.toEqual({ identity: setlistGroupPublicId });
        expect(insert).toHaveBeenCalledWith(
            db3.xSetlistPlanGroup,
            { name: "Brass" },
        );
    });

    it("defines finite CRUD views for the standalone relationship grids", () => {
        const attendance = eventAttendanceDtoFixture(attendancePublicId(1));
        expect(attendance).toMatchObject({ publicId: attendancePublicId(1), buttonCaption: "Going", strength: 100 });
        expect(db3.eventAttendanceEditorView.parseDto({ ...attendance, responses: [] })).toEqual(attendance);
        expect(db3.eventAttendanceEditorView.crud.operations.delete.deleteType)
            .toBe("softWhenPossible");

        expect(db3.eventSegmentEditorView.parseDto({
            publicId: segmentPublicId(2),
            name: "First set",
            description: "",
            startsAt: new Date("2026-10-10T18:00:00.000Z"),
            durationMillis: BigInt(3_600_000),
            isAllDay: false,
            statusId: eventStatusPublicId,
            eventId: eventPublicId(4),
            event: {
                publicId: eventPublicId(4),
                name: "Autumn concert",
                startsAt: new Date("2026-10-10T18:00:00.000Z"),
            },
        })).toMatchObject({
            publicId: segmentPublicId(2),
            statusId: eventStatusPublicId,
            event: { name: "Autumn concert" },
        });
        expect(db3.eventSegmentEditorView.crud.operations.update.command.parseDto({
            identity: segmentPublicId(2),
            patch: { name: "Opening set", eventId: eventPublicId(4), statusId: null },
        })).toEqual({
            identity: segmentPublicId(2),
            patch: { name: "Opening set", eventId: eventPublicId(4), statusId: null },
        });
        expect(() => db3.eventSegmentEditorView.crud.operations.update.command.parseDto({
            identity: segmentPublicId(2),
            patch: { responses: [] },
        })).toThrow();
        expect(db3.eventSegmentEditorView.crud.operations.delete.deleteType).toBe("hard");

        const credit = db3.songCreditEditorView.parseDto({
            publicId: songCreditPublicId,
            year: "2026",
            comment: "Original arrangement",
            userId: userPublicId(6),
            user: { publicId: userPublicId(6), name: "Ada" },
            songId: songPublicId(7),
            song: { publicId: songPublicId(7), name: "Autumn Leaves", description: "" },
            typeId: songCreditTypePublicId,
        });
        expect(credit).toMatchObject({ typeId: songCreditTypePublicId });
        expect(credit).not.toHaveProperty("type");
        const references = db3.createDashboardReferenceStore();
        db3.registerDashboardReferences(references, { songCreditType: [songCreditTypeReferenceFixture(songCreditTypePublicId)] });
        expect(db3.songCreditEditorView.hydrate(credit, references)).toMatchObject({
            publicId: songCreditPublicId,
            year: "2026",
            comment: "Original arrangement",
            user: { name: "Ada" },
            song: { name: "Autumn Leaves" },
            type: { name: "Composer" },
        });
        expect(db3.songCreditEditorView.crud.operations.create.command.parseDto({
            userId: userPublicId(6),
            songId: songPublicId(7),
            typeId: songCreditTypePublicId,
            year: "2026",
            comment: "Original arrangement",
        })).toEqual({
            userId: userPublicId(6),
            songId: songPublicId(7),
            typeId: songCreditTypePublicId,
            year: "2026",
            comment: "Original arrangement",
        });
        expect(db3.songCreditEditorView.crud.operations.delete.deleteType).toBe("hard");


        expect(db3.setlistPlanGroupEditorView.parseDto({
            publicId: "SetlistGroup0001",
            name: "First half",
            description: "Opening material",
            color: "blue",
            sortOrder: 1,
            createdByUserId: userPublicId(6),
            createdAt: new Date("2026-09-21T12:00:00.000Z"),
        })).toMatchObject({
            publicId: "SetlistGroup0001",
            name: "First half",
            sortOrder: 1,
        });
        expect(db3.setlistPlanGroupEditorView.crud.operations.update.command.parseDto({
            identity: "SetlistGroup0001",
            patch: {
                name: "Opening half",
                description: "Start here",
                color: "green",
            },
        })).toEqual({
            identity: "SetlistGroup0001",
            patch: {
                name: "Opening half",
                description: "Start here",
                color: "green",
            },
        });
        expect(() => db3.setlistPlanGroupEditorView.crud.operations.update.command.parseDto({
            identity: "SetlistGroup0001",
            patch: { setlistPlans: [] },
        })).toThrow();
        expect(db3.setlistPlanGroupEditorView.crud.operations.delete.deleteType).toBe("hard");
    });

    it("preserves xTable client-value transforms across CRUD reads and writes", () => {
        const view = db3.setlistPlanGroupEditorView;
        const colorField = db3.xSetlistPlanGroup.getColumn("color")!;
        const typedColorField: typeof db3.xSetlistPlanGroup.fields.color = colorField;

        expect(typedColorField).toBe(db3.xSetlistPlanGroup.fields.color);
        expectTypeOf<db3.ClientOf<typeof view>["publicId"]>()
            .toEqualTypeOf<SetlistPlanGroupPublicId>();
        expectTypeOf<db3.ClientOf<typeof view>["color"]>()
            .toEqualTypeOf<ColorPaletteEntry | null>();
        type TCreateInput = db3.CommandClientInputOf<
            typeof view.crud.operations.create.command
        >;
        type TUpdateInput = db3.CommandClientInputOf<
            typeof view.crud.operations.update.command
        >;
        expectTypeOf<TCreateInput["color"]>()
            .toEqualTypeOf<string | null | undefined>();
        expectTypeOf<TUpdateInput["patch"]["color"]>()
            .toEqualTypeOf<string | null | undefined>();
        if (false) {
            // @ts-expect-error Typed xTable keys reject members outside its field map.
            db3.xSetlistPlanGroup.getColumn("notAColumn");
        }

        for (const colorId of ["red", "light_red"] as const) {
            const dto = view.parseDto({
                publicId: setlistGroupPublicId,
                createdByUserId: userPublicId(6),
                createdAt: new Date("2026-09-21T12:00:00.000Z"),
                name: "Brass",
                description: "",
                sortOrder: 1,
                color: colorId,
            });
            const hydrated = db3.hydrateView(
                view,
                dto,
                new db3.DB3ReferenceStore(),
            );

            expect(hydrated.color).toMatchObject({ id: colorId });
            expect(colorField.ValidateAndParse({
                row: hydrated,
                mode: "update",
            }).result).toBe("success");

            const prepared = db3.xSetlistPlanGroup.clientToDbModel(
                { color: hydrated.color },
                "update",
            );
            expectTypeOf(prepared.color).toEqualTypeOf<string | null | undefined>();
            expect(prepared.color).toBe(colorId);
            expect(colorField.codec.encode(hydrated.color ?? null)).toBe(colorId);
            expect(view.crud.operations.update.command.parseDto({
                identity: setlistGroupPublicId,
                patch: { color: prepared.color },
            })).toEqual({
                identity: setlistGroupPublicId,
                patch: { color: colorId },
            });
        }
        expect(colorField.codec.decode(null)).toBeNull();
        expect(colorField.codec.encode(null)).toBeNull();
    });

    it("builds a present-keys-only patch from prepared TableClient values", () => {
        expect(db3.createEntityCrudUpdatePatch({
            name: "Brass",
            color: null,
            tags: [1, 2],
        }, {
            name: "Winds",
            color: null,
            tags: [1, 2],
        })).toEqual({ name: "Winds" });
        expect(db3.createEntityCrudUpdatePatch({ color: "red" }, { color: null }))
            .toEqual({ color: null });
        expect(db3.createEntityCrudUpdatePatch({}, { sortOrder: 0 }))
            .toEqual({ sortOrder: 0 });
    });

    it("creates a setlist aggregate through authorized row operations", async () => {
        const { context, insert, requireVisible, afterMutation } = createContext();

        const result = await eventSongListSaveCommandHandler.execute({
            ...parentFields,
            songs: [{ songId: songPublicId(7), sortOrder: 0, subtitle: "Open quietly" }],
            dividers: [{
                sortOrder: 1,
                color: null,
                isInterruption: true,
                subtitleIfSong: null,
                isSong: false,
                lengthSeconds: null,
                textStyle: null,
                subtitle: "Break",
            }],
        }, context);

        expect(result).toEqual({ publicId: listPublicId(50) });
        expect(requireVisible).toHaveBeenNthCalledWith(1, db3.xEvent, eventPublicId(5));
        expect(requireVisible).toHaveBeenNthCalledWith(2, db3.xSong, songPublicId(7));
        expect(insert).toHaveBeenNthCalledWith(1, db3.xEventSongList, parentFields);
        expect(insert).toHaveBeenNthCalledWith(2, db3.xEventSongListSong, {
            eventSongListId: listPublicId(50),
            songId: songPublicId(7),
            sortOrder: 0,
            subtitle: "Open quietly",
        });
        expect(insert).toHaveBeenNthCalledWith(3, db3.xEventSongListDivider, {
            eventSongListId: listPublicId(50),
            sortOrder: 1,
            color: null,
            isInterruption: true,
            subtitleIfSong: null,
            isSong: false,
            lengthSeconds: null,
            textStyle: null,
            subtitle: "Break",
        });
        expect(afterMutation).toHaveBeenCalledWith(db3.xEventSongList, { id: 50 });
    });

    it("synchronizes persisted children and rejects IDs owned by another setlist", async () => {
        const existingSong = {
            id: 501, publicId: listSongPublicId(501),
            eventSongListId: listPublicId(50),
            songId: 7,
            sortOrder: 0,
            subtitle: "Old",
        };
        const removedSong = {
            id: 502, publicId: listSongPublicId(502),
            eventSongListId: listPublicId(50),
            songId: 8,
            sortOrder: 1,
            subtitle: "Remove",
        };
        const { context, update, deleteRow } = createContext({
            songList: { id: 50, publicId: listPublicId(50), eventId: 5 },
            songs: [existingSong, removedSong],
        });

        await eventSongListSaveCommandHandler.execute({
            publicId: listPublicId(50),
            ...parentFields,
            songs: [{ publicId: listSongPublicId(501), songId: songPublicId(7), sortOrder: 0, subtitle: "Changed" }],
            dividers: [],
        }, context);

        expect(update).toHaveBeenCalledWith(db3.xEventSongList, listPublicId(50), {
            name: parentFields.name,
            description: parentFields.description,
            isActuallyPlayed: parentFields.isActuallyPlayed,
            isOrdered: parentFields.isOrdered,
            sortOrder: parentFields.sortOrder,
        });
        expect(update).toHaveBeenCalledWith(db3.xEventSongListSong, listSongPublicId(501), {
            songId: songPublicId(7),
            sortOrder: 0,
            subtitle: "Changed",
        });
        expect(deleteRow).toHaveBeenCalledWith(db3.xEventSongListSong, listSongPublicId(502), "hard");

        await expect(eventSongListSaveCommandHandler.execute({
            publicId: listPublicId(50),
            ...parentFields,
            songs: [{ publicId: listSongPublicId(999), songId: songPublicId(7), sortOrder: 0, subtitle: "Forged" }],
            dividers: [],
        }, context)).rejects.toThrow("does not belong to this setlist");
    });
});

// MIGRATION_RESTORE: role-administration
// Source: ab71102f2df004302ff85cb652a1be4f49b54191:tests/db3Commands.test.ts:9-9
// Reason: Single-band Role administration cannot execute against GlobalRole and BandRole.
// Restore: Restore role and permission editors, designations, account role assignment and continuity safeguards using GlobalRole/BandRole; never restore User.role.
// Verification: Adapt the preserved authorization and command tests; verify atomic designations, protected grants, fresh authorization, auditing and browser editors.
// SHA256: 3afb79db4226ad667341211c9033e8371a3cb24fed210af8500d01ec4effd240
// MIGRATION_REFERENCE_BEGIN
// import { rolePermissionSetCommandHandler } from "@db3/server/commands/rolePermissionSetCommand";
// MIGRATION_REFERENCE_END

// MIGRATION_RESTORE: role-administration
// Source: ab71102f2df004302ff85cb652a1be4f49b54191:tests/db3Commands.test.ts:27-31
// Reason: Single-band Role administration cannot execute against GlobalRole and BandRole.
// Restore: Restore role and permission editors, designations, account role assignment and continuity safeguards using GlobalRole/BandRole; never restore User.role.
// Verification: Adapt the preserved authorization and command tests; verify atomic designations, protected grants, fresh authorization, auditing and browser editors.
// SHA256: 2248a96ffb7d5e0172ac4b2c4a44ed1b08434bda4d3c64cb358b9efff161d9a4
// MIGRATION_REFERENCE_BEGIN
// const permissionPublicId = parsePublicId<"Permission">("CommandPermiss01");
// const rolePublicId100 = parsePublicId<"Role">("CommandRole00100");
// const rolePublicId200 = parsePublicId<"Role">("CommandRole00200");
// const rolePublicId250 = parsePublicId<"Role">("CommandRole00250");
// const rolePermissionPublicId = parsePublicId<"RolePermission">("CommandRolePerm1");
// MIGRATION_REFERENCE_END

// MIGRATION_RESTORE: role-administration
// Source: ab71102f2df004302ff85cb652a1be4f49b54191:tests/db3Commands.test.ts:222-300
// Reason: Single-band Role administration cannot execute against GlobalRole and BandRole.
// Restore: Restore role and permission editors, designations, account role assignment and continuity safeguards using GlobalRole/BandRole; never restore User.role.
// Verification: Adapt the preserved authorization and command tests; verify atomic designations, protected grants, fresh authorization, auditing and browser editors.
// SHA256: d746acc8a7661407aaef348db11cc9c6664c46972c95d75d7ece4736cf716ac7
// MIGRATION_REFERENCE_BEGIN
//     it("executes generated CRUD through row services and returns canonical identity", async () => {
//         const { context, insert, update, deleteRow } = createContext();
//         insert.mockResolvedValueOnce({
//             id: 12,
//             publicId: setlistGroupPublicId,
//             name: "Brass",
//         });
//
//         await expect(setlistPlanGroupCrudHandlers.create!.execute({
//             name: "Brass",
//             description: "",
//             sortOrder: 0,
//             color: null,
//         }, context)).resolves.toEqual({ identity: setlistGroupPublicId });
//         expect(insert).toHaveBeenLastCalledWith(db3.xSetlistPlanGroup, {
//             name: "Brass",
//             description: "",
//             sortOrder: 0,
//             color: null,
//         });
//
//         await expect(setlistPlanGroupCrudHandlers.update!.execute({
//             identity: setlistGroupPublicId,
//             patch: { name: "Winds" },
//         }, context)).resolves.toEqual({ identity: setlistGroupPublicId });
//         expect(update).toHaveBeenLastCalledWith(
//             db3.xSetlistPlanGroup,
//             setlistGroupPublicId,
//             { name: "Winds" },
//         );
//
//         await expect(setlistPlanGroupCrudHandlers.delete!.execute({
//             identity: setlistGroupPublicId,
//         }, context)).resolves.toEqual({ identity: setlistGroupPublicId });
//         expect(deleteRow).toHaveBeenLastCalledWith(
//             db3.xSetlistPlanGroup,
//             setlistGroupPublicId,
//             "hard",
//         );
//         expect(setlistPlanGroupCrudHandlers.all).toHaveLength(3);
//
//         insert.mockResolvedValueOnce({ id: 13, name: "Missing public identity" });
//         await expect(setlistPlanGroupCrudHandlers.create!.execute({
//             name: "Strings",
//             description: "",
//             sortOrder: 1,
//             color: null,
//         }, context)).rejects.toThrow("Expected an SetlistPlanGroup public ID");
//     });
//
//     it("defines a strict association command that serializes rich rows to identities", () => {
//         const command = db3.setRolePermissionCommand;
//         const payload = command.serialize({
//             local: { publicId: permissionPublicId },
//             foreign: { publicId: rolePublicId200 },
//             isAssociated: true,
//         });
//
//         expect(command.commandID).toBe("RolePermission_Set");
//         expect(payload).toEqual({
//             localIdentity: permissionPublicId,
//             foreignIdentity: rolePublicId200,
//             isAssociated: true,
//         });
//         expect(command.parseDto(payload)).toEqual(payload);
//         expect(command.parseResult(payload)).toEqual(payload);
//         expect(() => command.parseDto({ ...payload, unexpected: true })).toThrow();
//         expect(() => command.parseDto({ ...payload, localIdentity: -1 })).toThrow();
//         expect(command.invalidation).toEqual({
//             mode: "caller",
//             entityIDs: ["Permission", "Role", "RolePermission"],
//         });
//         expect(getDB3CommandHandler(command.commandID))
//             .toBe(rolePermissionSetCommandHandler);
//     });
//
//     it("keeps the generic association contract on public client identities", () => {
//         const payload = publicIdentityAssociationCommand.serialize({
//             local: { publicId: setlistGroupPublicId } as any,
// MIGRATION_REFERENCE_END

// MIGRATION_RESTORE: role-administration
// Source: ab71102f2df004302ff85cb652a1be4f49b54191:tests/db3Commands.test.ts:594-614
// Reason: Single-band Role administration cannot execute against GlobalRole and BandRole.
// Restore: Restore role and permission editors, designations, account role assignment and continuity safeguards using GlobalRole/BandRole; never restore User.role.
// Verification: Adapt the preserved authorization and command tests; verify atomic designations, protected grants, fresh authorization, auditing and browser editors.
// SHA256: 44684395341fed7b34bc5e552b07dd840603b2de554433176a958e0c88bbe5fd
// MIGRATION_REFERENCE_BEGIN
//     it("routes Role permission-set edits through the generated Role update command", async () => {
//         const handler = getDB3CommandHandler(db3.roleEditorView.crud.operations.update.command.commandID);
//         const { context, update } = createContext();
//
//         await expect(handler.execute({
//             identity: rolePublicId100,
//             patch: {
//                 name: "Editors",
//                 permissions: [permissionPublicId],
//             },
//         }, context)).resolves.toEqual({ identity: rolePublicId100 });
//         expect(update).toHaveBeenCalledWith(
//             db3.xRole,
//             rolePublicId100,
//             { name: "Editors", permissions: [permissionPublicId] },
//         );
//     });
//
//     it("builds a present-keys-only patch from prepared TableClient values", () => {
//         expect(db3.createEntityCrudUpdatePatch({
//             name: "Brass",
// MIGRATION_REFERENCE_END

// MIGRATION_RESTORE: member-profile
// Source: 15d112e042f38d63f5a18b105120cf1165df7845:tests/db3Commands.test.ts:430-459
// Reason: These specifications used person-level instrument/tag assignments; membership commands now own those edits.
// Restore: Restore reachable profile tabs, attendance, credits, wiki contributions, permitted account controls, and profile activity recording with explicit ownership.
// Verification: Test tab URLs, self/admin/outsider permissions and context switches; exercise each restored profile workflow in the built app.
// SHA256: 9642de2d9af73fd557a7bc55fcbb800ee39eccd0cf3279eef38f3cfe53eb29f8
// MIGRATION_REFERENCE_BEGIN
//         expect(db3.userInstrumentEditorView.parseDto({
//             publicId: userInstrumentPublicId,
//             userId: userPublicId(6),
//             user: { publicId: userPublicId(6), name: "Ada" },
//             instrumentId: instrumentPublicId,
//             instrument: {
//                 publicId: instrumentPublicId,
//                 name: "Trumpet",
//                 description: "",
//                 nameResolution: { value: "Trumpet", localeTag: "en-US", scope: "band", source: "stored", reason: "exact", requestedTag: "en-US" },
//                 nameStringPublicId: null,
//                 descriptionResolution: { value: "", localeTag: "en-US", scope: "band", source: "stored", reason: "exact", requestedTag: "en-US" },
//                 descriptionStringPublicId: null,
//                 functionalGroup: { publicId: "abcdefghijklmnop", color: "orange", colorOverride: "orange", colorInheritedValue: null },
//             },
//             isPrimary: true,
//         })).toMatchObject({
//             publicId: userInstrumentPublicId,
//             user: { name: "Ada" },
//             instrument: { name: "Trumpet" },
//             isPrimary: true,
//         });
//         expect(db3.userInstrumentEditorView.crud.operations.update.command.parseDto({
//             identity: userInstrumentPublicId,
//             patch: { instrumentId: instrumentPublicId, isPrimary: false },
//         })).toEqual({
//             identity: userInstrumentPublicId,
//             patch: { instrumentId: instrumentPublicId, isPrimary: false },
//         });
//         expect(db3.userInstrumentEditorView.crud.operations.delete.deleteType).toBe("hard");
// MIGRATION_REFERENCE_END
