import { describe, expect, expectTypeOf, it, vi } from "vitest";
import * as db3 from "@db3/db3";
import { eventSongListSaveCommandHandler } from "@db3/server/commands/eventSongListSaveCommand";
import { rolePermissionSetCommandHandler } from "@db3/server/commands/rolePermissionSetCommand";
import type { DB3CommandExecutionContext } from "@db3/server/db3CommandCore";
import { getDB3CommandHandler } from "@db3/server/db3CommandRegistry";
import { defineEntityCrudCommandHandlers } from "@db3/server/db3EntityCrudCommand";
import { isPublicId, parsePublicId, type InstrumentFunctionalGroupPublicId } from "shared/publicId";
import { z } from "zod";

function createContext(seed?: {
    songList?: Record<string, unknown> | null;
    songs?: Record<string, unknown>[];
    dividers?: Record<string, unknown>[];
}) {
    const insert = vi.fn(async (
        entity: db3.AnyDB3Entity,
        values: Record<string, unknown>,
    ): Promise<Record<string, unknown>> => ({
        id: entity.entityID === db3.eventSongListEntity.entityID ? 50 : 900,
        ...values,
    }));
    const update = vi.fn(async (_entity: db3.AnyDB3Entity, id: db3.DB3EntityId, values: Record<string, unknown>) => ({
        id,
        ...values,
    }));
    const deleteRow = vi.fn(async () => undefined);
    const requireVisible = vi.fn(async (entity: db3.AnyDB3Entity, identity: db3.DB3EntityId) => ({
        id: identity,
        entityID: entity.entityID,
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
    entity: db3.instrumentFunctionalGroupEntity,
    identitySchema: InstrumentFunctionalGroupPublicIdSchema,
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
const otherFunctionalGroupPublicId = parsePublicId<"InstrumentFunctionalGroup">("AbCdEfGhIjKlMn02");
const publicIdentityAssociationCommand = db3.defineAssociationCommand({
    commandID: "InstrumentFunctionalGroup_RelationshipTest",
    localEntity: db3.instrumentFunctionalGroupEntity,
    foreignEntity: db3.instrumentFunctionalGroupEntity,
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
        expect(db3.saveEventSongListCommand.parseResult({ id: 50 })).toEqual({ id: 50 });
        expect(() => db3.saveEventSongListCommand.parseResult({ id: -1 })).toThrow();
        expect(db3.saveEventSongListCommand.invalidation).toEqual({
            mode: "caller",
            entityIDs: ["EventSongList", "EventSongListSong", "EventSongListDivider"],
        });
    });

    it("defines strict generated CRUD DTOs with present-keys-only patch semantics", () => {
        expectTypeOf<db3.CommandClientInputOf<typeof instrumentFunctionalGroupCrud.createCommand>>()
            .toEqualTypeOf<{
                name: string;
                description: string;
                sortOrder: number;
                color: string | null;
            }>();
        expectTypeOf<db3.CommandClientInputOf<typeof instrumentFunctionalGroupCrud.updateCommand>>()
            .toEqualTypeOf<{
                identity: InstrumentFunctionalGroupPublicId;
                patch: {
                    name?: string;
                    description?: string;
                    sortOrder?: number;
                    color?: string | null;
                };
            }>();
        expectTypeOf<db3.CommandResultOf<typeof instrumentFunctionalGroupCrud.deleteCommand>>()
            .toEqualTypeOf<{ identity: InstrumentFunctionalGroupPublicId }>();
        expect(instrumentFunctionalGroupCrud.createCommand.commandID)
            .toBe("InstrumentFunctionalGroup_Create");
        expect(instrumentFunctionalGroupCrud.updateCommand.commandID)
            .toBe("InstrumentFunctionalGroup_Update");
        expect(instrumentFunctionalGroupCrud.deleteCommand.commandID)
            .toBe("InstrumentFunctionalGroup_Delete");
        expect(instrumentFunctionalGroupCrud.deleteType).toBe("hard");
        expect(instrumentFunctionalGroupCrud.updateCommand.parseDto({
            identity: functionalGroupPublicId,
            patch: { color: null },
        })).toEqual({
            identity: functionalGroupPublicId,
            patch: { color: null },
        });
        expect(() => instrumentFunctionalGroupCrud.createCommand.parseDto({
            name: "Brass",
            description: "",
            sortOrder: 0,
            color: null,
            publicId: functionalGroupPublicId,
        })).toThrow();
        expect(() => db3.defineEntityCrudCommands({
            entity: db3.instrumentFunctionalGroupEntity,
            identitySchema: InstrumentFunctionalGroupPublicIdSchema,
            createSchema: z.object({ publicId: InstrumentFunctionalGroupPublicIdSchema }),
            updateFieldsSchema: z.object({ name: z.string() }),
        })).toThrow("must not declare server-owned identity fields: publicId");
        expect(() => instrumentFunctionalGroupCrud.updateCommand.parseDto({
            identity: functionalGroupPublicId,
            patch: {},
        })).toThrow("Update patch must contain at least one field");
        expect(() => instrumentFunctionalGroupCrud.updateCommand.parseDto({
            identity: functionalGroupPublicId,
            patch: { name: undefined },
        })).toThrow("Patch fields cannot be undefined");
        expect(() => instrumentFunctionalGroupCrud.updateCommand.parseDto({
            identity: 42,
            patch: { name: "Brass" },
        })).toThrow();
        expect(() => instrumentFunctionalGroupCrud.deleteCommand.parseDto({
            identity: functionalGroupPublicId,
            deleteType: "hard",
        })).toThrow();
        expect(instrumentFunctionalGroupCrud.createCommand.invalidation).toEqual({
            mode: "caller",
            entityIDs: [db3.instrumentFunctionalGroupEntity.entityID],
        });
    });

    it("executes generated CRUD through row services and returns canonical identity", async () => {
        const { context, insert, update, deleteRow } = createContext();
        insert.mockResolvedValueOnce({
            id: 12,
            publicId: functionalGroupPublicId,
            name: "Brass",
        });

        await expect(instrumentFunctionalGroupCrudHandlers.create.execute({
            name: "Brass",
            description: "",
            sortOrder: 0,
            color: null,
        }, context)).resolves.toEqual({ identity: functionalGroupPublicId });
        expect(insert).toHaveBeenLastCalledWith(db3.instrumentFunctionalGroupEntity, {
            name: "Brass",
            description: "",
            sortOrder: 0,
            color: null,
        });

        await expect(instrumentFunctionalGroupCrudHandlers.update.execute({
            identity: functionalGroupPublicId,
            patch: { name: "Winds" },
        }, context)).resolves.toEqual({ identity: functionalGroupPublicId });
        expect(update).toHaveBeenLastCalledWith(
            db3.instrumentFunctionalGroupEntity,
            functionalGroupPublicId,
            { name: "Winds" },
        );

        await expect(instrumentFunctionalGroupCrudHandlers.delete.execute({
            identity: functionalGroupPublicId,
        }, context)).resolves.toEqual({ identity: functionalGroupPublicId });
        expect(deleteRow).toHaveBeenLastCalledWith(
            db3.instrumentFunctionalGroupEntity,
            functionalGroupPublicId,
            "hard",
        );
        expect(instrumentFunctionalGroupCrudHandlers.all).toHaveLength(3);

        insert.mockResolvedValueOnce({ id: 13, name: "Missing public identity" });
        await expect(instrumentFunctionalGroupCrudHandlers.create.execute({
            name: "Strings",
            description: "",
            sortOrder: 1,
            color: null,
        }, context)).rejects.toThrow("Expected an InstrumentFunctionalGroup public ID");
    });

    it("defines a strict association command that serializes rich rows to identities", () => {
        const command = db3.setRolePermissionCommand;
        const payload = command.serialize({
            local: { id: 300 } as any,
            foreign: { id: 200 } as any,
            isAssociated: true,
        });

        expect(command.commandID).toBe("RolePermission_Set");
        expect(payload).toEqual({
            localIdentity: 300,
            foreignIdentity: 200,
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

    it("sets one RolePermission cell from authoritative current associations", async () => {
        const update = vi.fn(async () => ({}));
        const requireVisible = vi.fn(async (_entity, identity) => ({ id: identity }));
        const findMany = vi.fn()
            .mockResolvedValueOnce([{ roleId: 100 }, { roleId: 200 }])
            .mockResolvedValueOnce([{ roleId: 100 }, { roleId: 200 }])
            .mockResolvedValueOnce([{ roleId: 100 }, { roleId: 200 }]);
        const context = {
            authorization: {} as any,
            transaction: { rolePermission: { findMany } } as any,
            rowServices: {
                insert: vi.fn(),
                update,
                delete: vi.fn(),
                requireVisible,
                afterMutation: vi.fn(),
            },
        } as DB3CommandExecutionContext;

        await expect(rolePermissionSetCommandHandler.execute({
            localIdentity: 300,
            foreignIdentity: 250,
            isAssociated: true,
        }, context)).resolves.toEqual({
            localIdentity: 300,
            foreignIdentity: 250,
            isAssociated: true,
        });
        expect(update).toHaveBeenLastCalledWith(
            db3.permissionEntity,
            300,
            { roles: [100, 200, 250] },
        );

        await rolePermissionSetCommandHandler.execute({
            localIdentity: 300,
            foreignIdentity: 200,
            isAssociated: false,
        }, context);
        expect(update).toHaveBeenLastCalledWith(
            db3.permissionEntity,
            300,
            { roles: [100] },
        );

        await rolePermissionSetCommandHandler.execute({
            localIdentity: 300,
            foreignIdentity: 200,
            isAssociated: true,
        }, context);
        expect(update).toHaveBeenLastCalledWith(
            db3.permissionEntity,
            300,
            { roles: [100, 200] },
        );
        expect(requireVisible).toHaveBeenCalledWith(db3.permissionEntity, 300);
        expect(requireVisible).toHaveBeenCalledWith(db3.roleEntity, 250);
        expect(findMany).toHaveBeenCalledWith({ where: { permissionId: 300 } });
    });

    it("composes and registers CRUD from the InstrumentFunctionalGroup editor view", async () => {
        const view = db3.instrumentFunctionalGroupEditorView;
        expect(view.entity).toBe(db3.instrumentFunctionalGroupEntity);
        expect(db3.getDB3CrudViewForCommand(view.crud.createCommand.commandID)).toBe(view);
        expect(view.crud.createCommand.parseDto({
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
        expect(() => view.crud.createCommand.parseDto({
            name: "Brass",
            publicId: functionalGroupPublicId,
        })).toThrow();
        expect(() => view.crud.createCommand.parseDto({
            name: "Brass",
            instruments: [],
        })).toThrow();
        expect(() => view.crud.createCommand.parseDto({ name: 42 }))
            .toThrow("field is of unknown type");
        expect(() => view.crud.updateCommand.parseDto({
            identity: functionalGroupPublicId,
            patch: { sortOrder: "not a number" },
        })).toThrow("Input string was not convertible to integer");
        expect(() => view.crud.updateCommand.parseDto({
            identity: functionalGroupPublicId,
            patch: { unknownField: true },
        })).toThrow();

        const createHandler = getDB3CommandHandler(view.crud.createCommand.commandID);
        expect(createHandler.command).toBe(view.crud.createCommand);
        const { context, insert } = createContext();
        insert.mockResolvedValueOnce({
            id: 15,
            publicId: functionalGroupPublicId,
            name: "Brass",
        });
        await expect(createHandler.execute({ name: "Brass" }, context))
            .resolves.toEqual({ identity: functionalGroupPublicId });
        expect(insert).toHaveBeenCalledWith(
            db3.instrumentFunctionalGroupEntity,
            { name: "Brass" },
        );
    });

    it("preserves xTable client-value transforms across CRUD reads and writes", () => {
        const view = db3.instrumentFunctionalGroupEditorView;
        const colorField = db3.xInstrumentFunctionalGroup.getColumn("color")!;

        for (const colorId of ["red", "light_red"] as const) {
            const dto = view.parseDto({
                publicId: functionalGroupPublicId,
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
            expect(prepared.color).toBe(colorId);
            expect(view.crud.updateCommand.parseDto({
                identity: functionalGroupPublicId,
                patch: { color: prepared.color },
            })).toEqual({
                identity: functionalGroupPublicId,
                patch: { color: colorId },
            });
        }
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

        expect(result).toEqual({ id: 50 });
        expect(requireVisible).toHaveBeenNthCalledWith(1, db3.eventEntity, 5);
        expect(requireVisible).toHaveBeenNthCalledWith(2, db3.songEntity, 7);
        expect(insert).toHaveBeenNthCalledWith(1, db3.eventSongListEntity, parentFields);
        expect(insert).toHaveBeenNthCalledWith(2, db3.eventSongListSongEntity, {
            eventSongListId: 50,
            songId: 7,
            sortOrder: 0,
            subtitle: "Open quietly",
        });
        expect(insert).toHaveBeenNthCalledWith(3, db3.eventSongListDividerEntity, {
            eventSongListId: 50,
            sortOrder: 1,
            color: null,
            isInterruption: true,
            subtitleIfSong: null,
            isSong: false,
            lengthSeconds: null,
            textStyle: null,
            subtitle: "Break",
        });
        expect(afterMutation).toHaveBeenCalledWith(db3.eventSongListEntity, { id: 50 });
    });

    it("synchronizes persisted children and rejects IDs owned by another setlist", async () => {
        const existingSong = {
            id: 501,
            eventSongListId: 50,
            songId: 7,
            sortOrder: 0,
            subtitle: "Old",
        };
        const removedSong = {
            id: 502,
            eventSongListId: 50,
            songId: 8,
            sortOrder: 1,
            subtitle: "Remove",
        };
        const { context, update, deleteRow } = createContext({
            songList: { id: 50, eventId: 5 },
            songs: [existingSong, removedSong],
        });

        await eventSongListSaveCommandHandler.execute({
            id: 50,
            ...parentFields,
            songs: [{ id: 501, songId: 7, sortOrder: 0, subtitle: "Changed" }],
            dividers: [],
        }, context);

        expect(update).toHaveBeenCalledWith(db3.eventSongListEntity, 50, {
            name: parentFields.name,
            description: parentFields.description,
            isActuallyPlayed: parentFields.isActuallyPlayed,
            isOrdered: parentFields.isOrdered,
            sortOrder: parentFields.sortOrder,
        });
        expect(update).toHaveBeenCalledWith(db3.eventSongListSongEntity, 501, {
            songId: 7,
            sortOrder: 0,
            subtitle: "Changed",
        });
        expect(deleteRow).toHaveBeenCalledWith(db3.eventSongListSongEntity, 502, "hard");

        await expect(eventSongListSaveCommandHandler.execute({
            id: 50,
            ...parentFields,
            songs: [{ id: 999, songId: 7, sortOrder: 0, subtitle: "Forged" }],
            dividers: [],
        }, context)).rejects.toThrow("does not belong to this setlist");
    });
});
