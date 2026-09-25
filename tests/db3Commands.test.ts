import { listPublicId, listSongPublicId } from "./support/eventSongListFixtures";
import { describe, expect, expectTypeOf, it, vi } from "vitest";
import * as db3 from "@db3/db3";
import { eventSongListSaveCommandHandler } from "@db3/server/commands/eventSongListSaveCommand";
import { rolePermissionSetCommandHandler } from "@db3/server/commands/rolePermissionSetCommand";
import type { DB3CommandExecutionContext } from "@db3/server/db3CommandCore";
import { getDB3CommandHandler } from "@db3/server/db3CommandRegistry";
import { defineEntityCrudCommandHandlers } from "@db3/server/db3EntityCrudCommand";
import type { ColorPaletteEntry } from "@components/color/palette";
import {
    isPublicId,
    parsePublicId,
    type EventStatusPublicId,
    type InstrumentFunctionalGroupPublicId,
} from "shared/publicId";
import { z } from "zod";

const eventStatusPublicId: EventStatusPublicId = parsePublicId<"EventStatus">("CommandStatus001");
const userTagPublicId = parsePublicId<"UserTag">("CommandUserTag01");
const songCreditTypePublicId = parsePublicId<"SongCreditType">("CommandCreditTyp");
const songCreditPublicId = parsePublicId<"SongCredit">("CommandCreditRow");
const userInstrumentPublicId = parsePublicId<"UserInstrument">("CommandUsrInstr1");
const permissionPublicId = parsePublicId<"Permission">("CommandPermiss01");
const rolePublicId100 = parsePublicId<"Role">("CommandRole00100");
const rolePublicId200 = parsePublicId<"Role">("CommandRole00200");
const rolePublicId250 = parsePublicId<"Role">("CommandRole00250");
const rolePermissionPublicId = parsePublicId<"RolePermission">("CommandRolePerm1");

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
        ...(entity === db3.xEventSongList ? seed?.songList : { id: identity }),
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
    eventId: 5,
    name: "Concert set",
    description: "Main set",
    isActuallyPlayed: false,
    isOrdered: true,
    sortOrder: 3,
};

const InstrumentFunctionalGroupPublicIdSchema = z.custom<InstrumentFunctionalGroupPublicId>(
    (value): value is InstrumentFunctionalGroupPublicId => isPublicId(value),
    "Expected an InstrumentFunctionalGroup public ID.",
);
const instrumentFunctionalGroupCrud = db3.defineEntityCrudCommands({
    entity: db3.xInstrumentFunctionalGroup,
    identitySchema: InstrumentFunctionalGroupPublicIdSchema,
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
const instrumentFunctionalGroupCrudHandlers = defineEntityCrudCommandHandlers(
    instrumentFunctionalGroupCrud,
);
const functionalGroupPublicId = parsePublicId<"InstrumentFunctionalGroup">("AbCdEfGhIjKlMn01");
const instrumentTagPublicId = parsePublicId<"InstrumentTag">("AbCdEfGhIjKlMn02");
const otherInstrumentTagPublicId = parsePublicId<"InstrumentTag">("AbCdEfGhIjKlMn03");
const instrumentTagAssociationPublicId = parsePublicId<"InstrumentTagAssociation">("AbCdEfGhIjKlMn04");
const songTagPublicId = parsePublicId<"SongTag">("AbCdEfGhIjKlMn05");
const otherSongTagPublicId = parsePublicId<"SongTag">("AbCdEfGhIjKlMn06");
const songTagAssociationPublicId = parsePublicId<"SongTagAssociation">("AbCdEfGhIjKlMn07");
const instrumentPublicId = parsePublicId<"Instrument">("AbCdEfGhIjKlMn08");
const wikiPageTagPublicId = parsePublicId<"WikiPageTag">("AbCdEfGhIjKlMn09");
const otherFunctionalGroupPublicId = parsePublicId<"InstrumentFunctionalGroup">("AbCdEfGhIjKlMn02");
const publicIdentityAssociationCommand = db3.defineAssociationCommand({
    commandID: "InstrumentFunctionalGroup_RelationshipTest",
    localEntity: db3.xInstrumentFunctionalGroup,
    foreignEntity: db3.xInstrumentFunctionalGroup,
    localIdentitySchema: InstrumentFunctionalGroupPublicIdSchema,
    foreignIdentitySchema: InstrumentFunctionalGroupPublicIdSchema,
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
        expectTypeOf<db3.CommandClientInputOf<typeof instrumentFunctionalGroupCrud.operations.create.command>>()
            .toEqualTypeOf<{
                name: string;
                description: string;
                sortOrder: number;
                color: string | null;
            }>();
        expectTypeOf<db3.CommandClientInputOf<typeof instrumentFunctionalGroupCrud.operations.update.command>>()
            .toEqualTypeOf<{
                identity: InstrumentFunctionalGroupPublicId;
                patch: {
                    name?: string;
                    description?: string;
                    sortOrder?: number;
                    color?: string | null;
                };
            }>();
        expectTypeOf<db3.CommandResultOf<typeof instrumentFunctionalGroupCrud.operations.delete.command>>()
            .toEqualTypeOf<{ identity: InstrumentFunctionalGroupPublicId }>();
        expect(instrumentFunctionalGroupCrud.operations.create.command.commandID)
            .toBe("InstrumentFunctionalGroup_Create");
        expect(instrumentFunctionalGroupCrud.operations.update.command.commandID)
            .toBe("InstrumentFunctionalGroup_Update");
        expect(instrumentFunctionalGroupCrud.operations.delete.command.commandID)
            .toBe("InstrumentFunctionalGroup_Delete");
        expect(instrumentFunctionalGroupCrud.operations.delete.deleteType).toBe("hard");
        expect(instrumentFunctionalGroupCrud.operations.update.command.parseDto({
            identity: functionalGroupPublicId,
            patch: { color: null },
        })).toEqual({
            identity: functionalGroupPublicId,
            patch: { color: null },
        });
        expect(() => instrumentFunctionalGroupCrud.operations.create.command.parseDto({
            name: "Brass",
            description: "",
            sortOrder: 0,
            color: null,
            publicId: functionalGroupPublicId,
        })).toThrow();
        expect(() => db3.defineEntityCrudCommands({
            entity: db3.xInstrumentFunctionalGroup,
            identitySchema: InstrumentFunctionalGroupPublicIdSchema,
            operations: { create: true, update: true, delete: true },
            createSchema: z.object({ publicId: InstrumentFunctionalGroupPublicIdSchema }),
            updateFieldsSchema: z.object({ name: z.string() }),
        })).toThrow("must not declare server-owned identity fields: publicId");
        expect(() => instrumentFunctionalGroupCrud.operations.update.command.parseDto({
            identity: functionalGroupPublicId,
            patch: {},
        })).toThrow("Update patch must contain at least one field");
        expect(() => instrumentFunctionalGroupCrud.operations.update.command.parseDto({
            identity: functionalGroupPublicId,
            patch: { name: undefined },
        })).toThrow("Patch fields cannot be undefined");
        expect(() => instrumentFunctionalGroupCrud.operations.update.command.parseDto({
            identity: 42,
            patch: { name: "Brass" },
        })).toThrow();
        expect(() => instrumentFunctionalGroupCrud.operations.delete.command.parseDto({
            identity: functionalGroupPublicId,
            deleteType: "hard",
        })).toThrow();
        expect(instrumentFunctionalGroupCrud.operations.create.command.invalidation).toEqual({
            mode: "caller",
            entityIDs: [db3.xInstrumentFunctionalGroup.tableID],
        });
    });

    it("executes generated CRUD through row services and returns canonical identity", async () => {
        const { context, insert, update, deleteRow } = createContext();
        insert.mockResolvedValueOnce({
            id: 12,
            publicId: functionalGroupPublicId,
            name: "Brass",
        });

        await expect(instrumentFunctionalGroupCrudHandlers.create!.execute({
            name: "Brass",
            description: "",
            sortOrder: 0,
            color: null,
        }, context)).resolves.toEqual({ identity: functionalGroupPublicId });
        expect(insert).toHaveBeenLastCalledWith(db3.xInstrumentFunctionalGroup, {
            name: "Brass",
            description: "",
            sortOrder: 0,
            color: null,
        });

        await expect(instrumentFunctionalGroupCrudHandlers.update!.execute({
            identity: functionalGroupPublicId,
            patch: { name: "Winds" },
        }, context)).resolves.toEqual({ identity: functionalGroupPublicId });
        expect(update).toHaveBeenLastCalledWith(
            db3.xInstrumentFunctionalGroup,
            functionalGroupPublicId,
            { name: "Winds" },
        );

        await expect(instrumentFunctionalGroupCrudHandlers.delete!.execute({
            identity: functionalGroupPublicId,
        }, context)).resolves.toEqual({ identity: functionalGroupPublicId });
        expect(deleteRow).toHaveBeenLastCalledWith(
            db3.xInstrumentFunctionalGroup,
            functionalGroupPublicId,
            "hard",
        );
        expect(instrumentFunctionalGroupCrudHandlers.all).toHaveLength(3);

        insert.mockResolvedValueOnce({ id: 13, name: "Missing public identity" });
        await expect(instrumentFunctionalGroupCrudHandlers.create!.execute({
            name: "Strings",
            description: "",
            sortOrder: 1,
            color: null,
        }, context)).rejects.toThrow("Expected an InstrumentFunctionalGroup public ID");
    });

    it("defines a strict association command that serializes rich rows to identities", () => {
        const command = db3.setRolePermissionCommand;
        const payload = command.serialize({
            local: { publicId: permissionPublicId },
            foreign: { publicId: rolePublicId200 },
            isAssociated: true,
        });

        expect(command.commandID).toBe("RolePermission_Set");
        expect(payload).toEqual({
            localIdentity: permissionPublicId,
            foreignIdentity: rolePublicId200,
            isAssociated: true,
        });
        expect(command.parseDto(payload)).toEqual(payload);
        expect(command.parseResult(payload)).toEqual(payload);
        expect(() => command.parseDto({ ...payload, unexpected: true })).toThrow();
        expect(() => command.parseDto({ ...payload, localIdentity: -1 })).toThrow();
        expect(command.invalidation).toEqual({
            mode: "caller",
            entityIDs: ["Permission", "Role", "RolePermission"],
        });
        expect(getDB3CommandHandler(command.commandID))
            .toBe(rolePermissionSetCommandHandler);
    });

    it("keeps the generic association contract on public client identities", () => {
        const payload = publicIdentityAssociationCommand.serialize({
            local: { publicId: functionalGroupPublicId } as any,
            foreign: { publicId: otherFunctionalGroupPublicId } as any,
            isAssociated: false,
        });

        expect(payload).toEqual({
            localIdentity: functionalGroupPublicId,
            foreignIdentity: otherFunctionalGroupPublicId,
            isAssociated: false,
        });
        expect(publicIdentityAssociationCommand.parseDto(payload)).toEqual(payload);
        expect(() => publicIdentityAssociationCommand.parseDto({
            ...payload,
            localIdentity: 42,
        })).toThrow("Expected an InstrumentFunctionalGroup public ID");
    });

    it("composes and registers CRUD from the InstrumentFunctionalGroup editor view", async () => {
        const view = db3.instrumentFunctionalGroupEditorView;
        expect(view.entity).toBe(db3.xInstrumentFunctionalGroup);
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
            publicId: functionalGroupPublicId,
        })).toThrow();
        expect(() => view.crud.operations.create.command.parseDto({
            name: "Brass",
            instruments: [],
        })).toThrow();
        expect(() => view.crud.operations.create.command.parseDto({ name: 42 }))
            .toThrow("field is of unknown type");
        expect(() => view.crud.operations.update.command.parseDto({
            identity: functionalGroupPublicId,
            patch: { sortOrder: "not a number" },
        })).toThrow("Input string was not convertible to integer");
        expect(() => view.crud.operations.update.command.parseDto({
            identity: functionalGroupPublicId,
            patch: { unknownField: true },
        })).toThrow();

        const createHandler = getDB3CommandHandler(view.crud.operations.create.command.commandID);
        expect(createHandler.command).toBe(view.crud.operations.create.command);
        const { context, insert } = createContext();
        insert.mockResolvedValueOnce({
            id: 15,
            publicId: functionalGroupPublicId,
            name: "Brass",
        });
        await expect(createHandler.execute({ name: "Brass" }, context))
            .resolves.toEqual({ identity: functionalGroupPublicId });
        expect(insert).toHaveBeenCalledWith(
            db3.xInstrumentFunctionalGroup,
            { name: "Brass" },
        );
    });

    it("defines finite CRUD views for the standalone relationship grids", () => {
        expect(db3.eventAttendanceEditorView.parseDto({
            id: 1,
            text: "Going",
            personalText: "You are going",
            pastText: "Went",
            pastPersonalText: "You went",
            description: "Confirmed attendance",
            sortOrder: 1,
            isActive: true,
            isDeleted: false,
            iconName: "Check",
            color: "green",
            strength: 100,
        })).toMatchObject({ id: 1, text: "Going", strength: 100 });
        expect(db3.eventAttendanceEditorView.parseDto({
            id: 1,
            responses: [],
        })).toEqual({ id: 1 });
        expect(db3.eventAttendanceEditorView.crud.operations.delete.deleteType)
            .toBe("softWhenPossible");

        expect(db3.eventSegmentEditorView.parseDto({
            id: 2,
            name: "First set",
            description: "",
            startsAt: new Date("2026-10-10T18:00:00.000Z"),
            durationMillis: BigInt(3_600_000),
            isAllDay: false,
            statusId: eventStatusPublicId,
            status: { publicId: eventStatusPublicId, label: "Confirmed" },
            eventId: 4,
            event: {
                id: 4,
                name: "Autumn concert",
                startsAt: new Date("2026-10-10T18:00:00.000Z"),
            },
        })).toMatchObject({
            id: 2,
            status: { label: "Confirmed" },
            event: { name: "Autumn concert" },
        });
        expect(db3.eventSegmentEditorView.crud.operations.update.command.parseDto({
            identity: 2,
            patch: { name: "Opening set", eventId: 4, statusId: null },
        })).toEqual({
            identity: 2,
            patch: { name: "Opening set", eventId: 4, statusId: null },
        });
        expect(() => db3.eventSegmentEditorView.crud.operations.update.command.parseDto({
            identity: 2,
            patch: { responses: [] },
        })).toThrow();
        expect(db3.eventSegmentEditorView.crud.operations.delete.deleteType).toBe("hard");

        expect(db3.songCreditEditorView.parseDto({
            publicId: songCreditPublicId,
            year: "2026",
            comment: "Original arrangement",
            userId: 6,
            user: { id: 6, name: "Ada" },
            songId: 7,
            song: { id: 7, name: "Autumn Leaves", description: "" },
            typeId: songCreditTypePublicId,
            type: {
                publicId: songCreditTypePublicId,
                text: "Composer",
                description: "",
                color: null,
                sortOrder: 1,
                significance: null,
            },
        })).toMatchObject({
            publicId: songCreditPublicId,
            year: "2026",
            comment: "Original arrangement",
            user: { name: "Ada" },
            song: { name: "Autumn Leaves" },
            type: { text: "Composer" },
        });
        expect(db3.songCreditEditorView.crud.operations.create.command.parseDto({
            userId: 6,
            songId: 7,
            typeId: songCreditTypePublicId,
            year: "2026",
            comment: "Original arrangement",
        })).toEqual({
            userId: 6,
            songId: 7,
            typeId: songCreditTypePublicId,
            year: "2026",
            comment: "Original arrangement",
        });
        expect(db3.songCreditEditorView.crud.operations.delete.deleteType).toBe("hard");

        expect(db3.userInstrumentEditorView.parseDto({
            publicId: userInstrumentPublicId,
            userId: 6,
            user: { id: 6, name: "Ada" },
            instrumentId: instrumentPublicId,
            instrument: {
                publicId: instrumentPublicId,
                name: "Trumpet",
                description: "",
                functionalGroup: { publicId: "abcdefghijklmnop", color: "brass" },
            },
            isPrimary: true,
        })).toMatchObject({
            publicId: userInstrumentPublicId,
            user: { name: "Ada" },
            instrument: { name: "Trumpet" },
            isPrimary: true,
        });
        expect(db3.userInstrumentEditorView.crud.operations.update.command.parseDto({
            identity: userInstrumentPublicId,
            patch: { instrumentId: instrumentPublicId, isPrimary: false },
        })).toEqual({
            identity: userInstrumentPublicId,
            patch: { instrumentId: instrumentPublicId, isPrimary: false },
        });
        expect(db3.userInstrumentEditorView.crud.operations.delete.deleteType).toBe("hard");

        expect(db3.setlistPlanGroupEditorView.parseDto({
            id: 11,
            name: "First half",
            description: "Opening material",
            color: "blue",
            sortOrder: 1,
            createdByUserId: 6,
            createdAt: new Date("2026-09-21T12:00:00.000Z"),
        })).toMatchObject({
            id: 11,
            name: "First half",
            sortOrder: 1,
        });
        expect(db3.setlistPlanGroupEditorView.crud.operations.update.command.parseDto({
            identity: 11,
            patch: {
                name: "Opening half",
                description: "Start here",
                color: "green",
            },
        })).toEqual({
            identity: 11,
            patch: {
                name: "Opening half",
                description: "Start here",
                color: "green",
            },
        });
        expect(() => db3.setlistPlanGroupEditorView.crud.operations.update.command.parseDto({
            identity: 11,
            patch: { setlistPlans: [] },
        })).toThrow();
        expect(db3.setlistPlanGroupEditorView.crud.operations.delete.deleteType).toBe("hard");
    });

    it("preserves xTable client-value transforms across CRUD reads and writes", () => {
        const view = db3.instrumentFunctionalGroupEditorView;
        const colorField = db3.xInstrumentFunctionalGroup.getColumn("color")!;
        const typedColorField: typeof db3.xInstrumentFunctionalGroup.fields.color = colorField;

        expect(typedColorField).toBe(db3.xInstrumentFunctionalGroup.fields.color);
        expectTypeOf<db3.ClientOf<typeof view>["publicId"]>()
            .toEqualTypeOf<InstrumentFunctionalGroupPublicId>();
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
            db3.xInstrumentFunctionalGroup.getColumn("notAColumn");
        }

        for (const colorId of ["red", "light_red"] as const) {
            const dto = view.parseDto({
                publicId: functionalGroupPublicId,
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

            const prepared = db3.xInstrumentFunctionalGroup.clientToDbModel(
                { color: hydrated.color },
                "update",
            );
            expectTypeOf(prepared.color).toEqualTypeOf<string | null | undefined>();
            expect(prepared.color).toBe(colorId);
            expect(colorField.codec.encode(hydrated.color ?? null)).toBe(colorId);
            expect(view.crud.operations.update.command.parseDto({
                identity: functionalGroupPublicId,
                patch: { color: prepared.color },
            })).toEqual({
                identity: functionalGroupPublicId,
                patch: { color: colorId },
            });
        }
        expect(colorField.codec.decode(null)).toBeNull();
        expect(colorField.codec.encode(null)).toBeNull();
    });

    it("routes Role permission-set edits through the generated Role update command", async () => {
        const handler = getDB3CommandHandler(db3.roleEditorView.crud.operations.update.command.commandID);
        const { context, update } = createContext();

        await expect(handler.execute({
            identity: rolePublicId100,
            patch: {
                name: "Editors",
                permissions: [permissionPublicId],
            },
        }, context)).resolves.toEqual({ identity: rolePublicId100 });
        expect(update).toHaveBeenCalledWith(
            db3.xRole,
            rolePublicId100,
            { name: "Editors", permissions: [permissionPublicId] },
        );
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
            songs: [{ songId: 7, sortOrder: 0, subtitle: "Open quietly" }],
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
        expect(requireVisible).toHaveBeenNthCalledWith(1, db3.xEvent, 5);
        expect(requireVisible).toHaveBeenNthCalledWith(2, db3.xSong, 7);
        expect(insert).toHaveBeenNthCalledWith(1, db3.xEventSongList, parentFields);
        expect(insert).toHaveBeenNthCalledWith(2, db3.xEventSongListSong, {
            eventSongListId: listPublicId(50),
            songId: 7,
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
            songs: [{ publicId: listSongPublicId(501), songId: 7, sortOrder: 0, subtitle: "Changed" }],
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
            songId: 7,
            sortOrder: 0,
            subtitle: "Changed",
        });
        expect(deleteRow).toHaveBeenCalledWith(db3.xEventSongListSong, listSongPublicId(502), "hard");

        await expect(eventSongListSaveCommandHandler.execute({
            publicId: listPublicId(50),
            ...parentFields,
            songs: [{ publicId: listSongPublicId(999), songId: 7, sortOrder: 0, subtitle: "Forged" }],
            dividers: [],
        }, context)).rejects.toThrow("does not belong to this setlist");
    });
});
