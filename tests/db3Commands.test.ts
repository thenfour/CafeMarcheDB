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
    type InstrumentFunctionalGroupPublicId,
    type InstrumentTagPublicId,
} from "shared/publicId";
import { z } from "zod";

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
        ...values,
    }));
    const update = vi.fn(async (_entity: db3.AnyDB3Table, id: db3.DB3Identity, values: Record<string, unknown>) => ({
        id,
        ...values,
    }));
    const deleteRow = vi.fn(async () => undefined);
    const requireVisible = vi.fn(async (entity: db3.AnyDB3Table, identity: db3.DB3Identity) => ({
        id: identity,
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
        expect(db3.saveEventSongListCommand.parseResult({ id: 50 })).toEqual({ id: 50 });
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
            db3.xPermission,
            300,
            { roles: [100, 200, 250] },
        );

        await rolePermissionSetCommandHandler.execute({
            localIdentity: 300,
            foreignIdentity: 200,
            isAssociated: false,
        }, context);
        expect(update).toHaveBeenLastCalledWith(
            db3.xPermission,
            300,
            { roles: [100] },
        );

        await rolePermissionSetCommandHandler.execute({
            localIdentity: 300,
            foreignIdentity: 200,
            isAssociated: true,
        }, context);
        expect(update).toHaveBeenLastCalledWith(
            db3.xPermission,
            300,
            { roles: [100, 200] },
        );
        expect(requireVisible).toHaveBeenCalledWith(db3.xPermission, 300);
        expect(requireVisible).toHaveBeenCalledWith(db3.xRole, 250);
        expect(findMany).toHaveBeenCalledWith({ where: { permissionId: 300 } });
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

    it("registers generated CRUD for the administration-grid migration batches", () => {
        const views = [
            db3.eventTypeEditorView,
            db3.eventStatusEditorView,
            db3.eventTagEditorView,
            db3.fileTagEditorView,
            db3.instrumentTagEditorView,
            db3.songTagEditorView,
            db3.songCreditTypeEditorView,
            db3.userTagEditorView,
            db3.wikiPageTagEditorView,
            db3.permissionEditorView,
            db3.settingEditorView,
            db3.frontpageGalleryItemEditorView,
            db3.roleEditorView,
            db3.instrumentEditorView,
            db3.songEditorView,
            db3.userEditorView,
            db3.eventEditorView,
            db3.eventAttendanceEditorView,
            db3.eventSegmentEditorView,
            db3.songCreditEditorView,
            db3.userInstrumentEditorView,
            db3.setlistPlanGroupEditorView,
            db3.customLinkEditorView,
            db3.menuLinkEditorView,
        ];

        for (const view of views) {
            expect(db3.getDB3CrudViewForCommand(view.crud.operations.create.command.commandID)).toBe(view);
            expect(getDB3CommandHandler(view.crud.operations.create.command.commandID).command)
                .toBe(view.crud.operations.create.command);
            expect(getDB3CommandHandler(view.crud.operations.update.command.commandID).command)
                .toBe(view.crud.operations.update.command);
            if (view.crud.operations.delete) {
                expect(getDB3CommandHandler(view.crud.operations.delete.command.commandID).command)
                    .toBe(view.crud.operations.delete.command);
            }
        }

        expect(db3.eventTypeEditorView.crud.operations.create.command.parseDto({
            text: "Concert",
            description: "",
            color: null,
            sortOrder: 0,
            significance: null,
            iconName: null,
            isDeleted: false,
        })).toMatchObject({ text: "Concert", sortOrder: 0 });
        expect(() => db3.eventTypeEditorView.crud.operations.create.command.parseDto({
            text: "Concert",
            events: [],
        })).toThrow();
        expect(() => db3.eventStatusEditorView.crud.operations.update.command.parseDto({
            identity: 1,
            patch: { id: 2 },
        })).toThrow();
        expect(() => db3.eventTagEditorView.crud.operations.delete.command.parseDto({
            identity: 1,
            deleteType: "hard",
        })).toThrow();
        expect(db3.songTagEditorView.crud.operations.create.command.parseDto({
            text: "Ballad",
            group: "Style",
            indicator: "B",
            indicatorCssClass: "ballad",
        })).toEqual({
            text: "Ballad",
            group: "Style",
            indicator: "B",
            indicatorCssClass: "ballad",
        });
        expect(db3.userTagEditorView.crud.operations.update.command.parseDto({
            identity: 1,
            patch: { cssClass: null },
        })).toEqual({
            identity: 1,
            patch: { cssClass: null },
        });
        expect(() => db3.fileTagEditorView.crud.operations.create.command.parseDto({
            text: "Chart",
            fileAssignments: [],
        })).toThrow();
        expect(() => db3.wikiPageTagEditorView.crud.operations.create.command.parseDto({
            text: "Policy",
            wikiPages: [],
        })).toThrow();
        expect(db3.permissionEditorView.crud.operations.update.command.parseDto({
            identity: 1,
            patch: { isVisibility: true, significance: null },
        })).toEqual({
            identity: 1,
            patch: { isVisibility: true, significance: null },
        });
        expect(() => db3.permissionEditorView.crud.operations.update.command.parseDto({
            identity: 1,
            patch: { roles: [] },
        })).toThrow();
        expect(db3.permissionEditorView.crud.operations.delete).toBeUndefined();
        expect(db3.getDB3CrudViewForCommand("Permission_Delete")).toBeUndefined();
        expect(db3.settingEditorView.crud.operations.create.command.parseDto({
            name: "settings_markdown",
            value: "Welcome",
        })).toEqual({
            name: "settings_markdown",
            value: "Welcome",
        });
        expect(db3.settingEditorView.crud.operations.delete).toBeUndefined();
        expect(db3.getDB3CrudViewForCommand("Setting_Delete")).toBeUndefined();
        expect(db3.frontpageGalleryItemEditorView.parseDto({
            id: 1,
            caption: "Opening night",
            caption_nl: null,
            caption_fr: null,
            isDeleted: false,
            sortOrder: 0,
            displayParams: "{}",
            fileId: 42,
            file: {
                id: 42,
                fileLeafName: "opening-night.jpg",
                storedLeafName: "stored-opening-night.jpg",
                externalURI: null,
                description: "",
                sizeBytes: 1024,
                mimeType: "image/jpeg",
                customData: "{}",
                uploadedByUserId: 7,
            },
            createdByUserId: 7,
            createdByUser: { id: 7, name: "Editor" },
            visiblePermissionId: 3,
            visiblePermission: {
                id: 3,
                name: "visibility_public",
                isVisibility: true,
                description: "Public",
                sortOrder: 1,
                significance: null,
                color: null,
                iconName: "Public",
            },
        })).toMatchObject({
            id: 1,
            caption_nl: null,
            file: {
                id: 42,
                fileLeafName: "opening-night.jpg",
                storedLeafName: "stored-opening-night.jpg",
                sizeBytes: 1024,
            },
            createdByUser: { id: 7, name: "Editor" },
            visiblePermission: { id: 3, name: "visibility_public" },
        });
        expect(db3.frontpageGalleryItemEditorView.crud.operations.create.command.parseDto({
            caption: "Opening night",
            caption_nl: "",
            caption_fr: "",
            sortOrder: 1,
            fileId: 42,
            displayParams: "{}",
            createdByUserId: 7,
            visiblePermissionId: null,
            isDeleted: false,
        })).toMatchObject({
            caption: "Opening night",
            fileId: 42,
            displayParams: "{}",
        });
        expect(() => db3.frontpageGalleryItemEditorView.crud.operations.update.command.parseDto({
            identity: 1,
            patch: { file: { id: 42 } },
        })).toThrow();
        expect(db3.frontpageGalleryItemEditorView.crud.operations.delete.deleteType)
            .toBe("softWhenPossible");
        expect(db3.roleEditorView.parseDto({
            id: 10,
            name: "Editors",
            description: "Can edit content",
            sortOrder: 2,
            color: null,
            significance: null,
            permissions: [{
                id: 50,
                roleId: 10,
                permissionId: 20,
                permission: {
                    id: 20,
                    name: "edit_content",
                    description: "Edit content",
                    sortOrder: 1,
                },
            }],
        })).toMatchObject({
            id: 10,
            permissions: [{ permissionId: 20, permission: { name: "edit_content" } }],
        });
        expect(db3.roleEditorView.crud.operations.update.command.parseDto({
            identity: 10,
            patch: { name: "Editors", permissions: [20, 30] },
        })).toEqual({
            identity: 10,
            patch: { name: "Editors", permissions: [20, 30] },
        });
        expect(() => db3.roleEditorView.crud.operations.update.command.parseDto({
            identity: 10,
            patch: { isSysAdminRole: true },
        })).toThrow();
        expect(db3.roleEditorView.crud.operations.delete).toBeUndefined();
        expect(db3.getDB3CrudViewForCommand("Role_Delete")).toBeUndefined();
        const instrumentDto = db3.instrumentEditorView.parseDto({
            id: 7,
            name: "Trumpet",
            description: "",
            autoAssignFileLeafRegex: "trumpet",
            sortOrder: 1,
            functionalGroupId: functionalGroupPublicId,
            instrumentTags: [{
                publicId: instrumentTagAssociationPublicId,
                tagId: instrumentTagPublicId,
            }],
        });
        expect(instrumentDto).toEqual({
            id: 7,
            name: "Trumpet",
            description: "",
            autoAssignFileLeafRegex: "trumpet",
            sortOrder: 1,
            functionalGroupId: functionalGroupPublicId,
            instrumentTags: [{
                publicId: instrumentTagAssociationPublicId,
                tagId: instrumentTagPublicId,
            }],
        });
        const functionalGroup: db3.InstrumentFunctionalGroupDashboardClient = {
            publicId: functionalGroupPublicId,
            name: "Brass",
            description: "",
            sortOrder: 1,
            color: null,
        };
        const instrumentTag: db3.InstrumentTagDashboardClient = {
            publicId: instrumentTagPublicId,
            text: "Uses electricity",
            description: "",
            sortOrder: 1,
            color: null,
            significance: "NeedsPower",
        };
        const instrumentReferences = db3.createDashboardReferenceStore();
        db3.registerDashboardReferences(instrumentReferences, {
            instrumentFunctionalGroup: [functionalGroup],
            instrumentTag: [instrumentTag],
        });
        const hydratedInstrument = db3.hydrateView(
            db3.instrumentEditorView,
            instrumentDto,
            instrumentReferences,
        );
        expect(hydratedInstrument.functionalGroup).toBe(functionalGroup);
        expect(hydratedInstrument.instrumentTags[0]?.tag).toBe(instrumentTag);
        expectTypeOf(hydratedInstrument).toEqualTypeOf<db3.InstrumentEditorClient>();
        type InstrumentUpdateInput = db3.CommandClientInputOf<
            typeof db3.instrumentEditorView.crud.operations.update.command
        >;
        expectTypeOf<NonNullable<InstrumentUpdateInput["patch"]["instrumentTags"]>>()
            .toEqualTypeOf<InstrumentTagPublicId[]>();
        expect(db3.instrumentEditorView.crud.operations.update.command.parseDto({
            identity: 7,
            patch: {
                functionalGroupId: functionalGroupPublicId,
                instrumentTags: [instrumentTagPublicId, otherInstrumentTagPublicId],
            },
        })).toEqual({
            identity: 7,
            patch: {
                functionalGroupId: functionalGroupPublicId,
                instrumentTags: [instrumentTagPublicId, otherInstrumentTagPublicId],
            },
        });
        expect(() => db3.instrumentEditorView.crud.operations.update.command.parseDto({
            identity: 7,
            patch: { instrumentTags: [20] },
        })).toThrow();
        expect(() => db3.instrumentEditorView.crud.operations.update.command.parseDto({
            identity: 7,
            patch: { functionalGroup: { publicId: functionalGroupPublicId } },
        })).toThrow();
        expect(db3.instrumentEditorView.crud.operations.delete.deleteType).toBe("hard");
        expect(db3.songEditorView.parseDto({
            id: 8,
            name: "Autumn Leaves",
            aliases: "Les Feuilles mortes",
            description: "",
            startBPM: 120,
            endBPM: null,
            introducedYear: 1945,
            lengthSeconds: 180,
            isDeleted: false,
            createdByUserId: 7,
            createdByUser: { id: 7, name: "Editor", cssClass: null },
            visiblePermissionId: 3,
            visiblePermission: {
                id: 3,
                name: "visibility_public",
                description: "Public",
                isVisibility: true,
                sortOrder: 1,
                significance: null,
                color: null,
                iconName: null,
            },
            tags: [{
                id: 80,
                songId: 8,
                tagId: 20,
                tag: {
                    id: 20,
                    text: "Jazz",
                    description: "",
                    color: null,
                    sortOrder: 1,
                    significance: null,
                    group: "Style",
                    indicator: null,
                    indicatorCssClass: null,
                },
            }],
        })).toMatchObject({
            id: 8,
            createdByUser: { id: 7, name: "Editor" },
            visiblePermission: { id: 3, name: "visibility_public" },
            tags: [{ tagId: 20, tag: { text: "Jazz" } }],
        });
        expect(db3.songEditorView.crud.operations.update.command.parseDto({
            identity: 8,
            patch: {
                visiblePermissionId: 3,
                tags: [20, 30],
            },
        })).toEqual({
            identity: 8,
            patch: {
                visiblePermissionId: 3,
                tags: [20, 30],
            },
        });
        expect(() => db3.songEditorView.crud.operations.update.command.parseDto({
            identity: 8,
            patch: { taggedFiles: [40] },
        })).toThrow();
        expect(() => db3.songEditorView.crud.operations.update.command.parseDto({
            identity: 8,
            patch: { credits: [50] },
        })).toThrow();
        expect(() => db3.songEditorView.crud.operations.update.command.parseDto({
            identity: 8,
            patch: { pinnedRecordingId: 40 },
        })).toThrow();
        expect(db3.songEditorView.crud.operations.delete.deleteType).toBe("softWhenPossible");
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
            statusId: 3,
            status: { id: 3, label: "Confirmed" },
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
            id: 5,
            year: "2026",
            comment: "Original arrangement",
            userId: 6,
            user: { id: 6, name: "Ada" },
            songId: 7,
            song: { id: 7, name: "Autumn Leaves", description: "" },
            typeId: 8,
            type: {
                id: 8,
                text: "Composer",
                description: "",
                color: null,
                sortOrder: 1,
                significance: null,
            },
        })).toMatchObject({
            id: 5,
            year: "2026",
            comment: "Original arrangement",
            user: { name: "Ada" },
            song: { name: "Autumn Leaves" },
            type: { text: "Composer" },
        });
        expect(db3.songCreditEditorView.crud.operations.create.command.parseDto({
            userId: 6,
            songId: 7,
            typeId: 8,
            year: "2026",
            comment: "Original arrangement",
        })).toEqual({
            userId: 6,
            songId: 7,
            typeId: 8,
            year: "2026",
            comment: "Original arrangement",
        });
        expect(db3.songCreditEditorView.crud.operations.delete.deleteType).toBe("hard");

        expect(db3.userInstrumentEditorView.parseDto({
            id: 9,
            userId: 6,
            user: { id: 6, name: "Ada" },
            instrumentId: 10,
            instrument: {
                id: 10,
                name: "Trumpet",
                description: "",
                functionalGroup: { publicId: "abcdefghijklmnop", color: "brass" },
            },
            isPrimary: true,
        })).toMatchObject({
            id: 9,
            user: { name: "Ada" },
            instrument: { name: "Trumpet" },
            isPrimary: true,
        });
        expect(db3.userInstrumentEditorView.crud.operations.update.command.parseDto({
            identity: 9,
            patch: { instrumentId: 10, isPrimary: false },
        })).toEqual({
            identity: 9,
            patch: { instrumentId: 10, isPrimary: false },
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
            identity: 10,
            patch: {
                name: "Editors",
                permissions: [20, 30],
            },
        }, context)).resolves.toEqual({ identity: 10 });
        expect(update).toHaveBeenCalledWith(
            db3.xRole,
            10,
            { name: "Editors", permissions: [20, 30] },
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

        expect(result).toEqual({ id: 50 });
        expect(requireVisible).toHaveBeenNthCalledWith(1, db3.xEvent, 5);
        expect(requireVisible).toHaveBeenNthCalledWith(2, db3.xSong, 7);
        expect(insert).toHaveBeenNthCalledWith(1, db3.xEventSongList, parentFields);
        expect(insert).toHaveBeenNthCalledWith(2, db3.xEventSongListSong, {
            eventSongListId: 50,
            songId: 7,
            sortOrder: 0,
            subtitle: "Open quietly",
        });
        expect(insert).toHaveBeenNthCalledWith(3, db3.xEventSongListDivider, {
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
        expect(afterMutation).toHaveBeenCalledWith(db3.xEventSongList, { id: 50 });
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

        expect(update).toHaveBeenCalledWith(db3.xEventSongList, 50, {
            name: parentFields.name,
            description: parentFields.description,
            isActuallyPlayed: parentFields.isActuallyPlayed,
            isOrdered: parentFields.isOrdered,
            sortOrder: parentFields.sortOrder,
        });
        expect(update).toHaveBeenCalledWith(db3.xEventSongListSong, 501, {
            songId: 7,
            sortOrder: 0,
            subtitle: "Changed",
        });
        expect(deleteRow).toHaveBeenCalledWith(db3.xEventSongListSong, 502, "hard");

        await expect(eventSongListSaveCommandHandler.execute({
            id: 50,
            ...parentFields,
            songs: [{ id: 999, songId: 7, sortOrder: 0, subtitle: "Forged" }],
            dividers: [],
        }, context)).rejects.toThrow("does not belong to this setlist");
    });
});
