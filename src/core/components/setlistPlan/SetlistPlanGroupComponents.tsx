import { assert } from "blitz";
import * as ReactSmoothDnd from "react-smooth-dnd";
import { ReactSmoothDndContainer, ReactSmoothDndDraggable } from "src/core/components/CMCoreComponents";
import * as db3 from "../../db3/db3";
import { DB3EditRowButton, DB3EditRowButtonAPI } from "../../db3/components/db3NewObjectDialog";
import { gIconMap } from "../../db3/components/IconMap";
import * as DB3Client from "../../db3/DB3Client";
import { CMSmallButton } from "../CMCoreComponents2";
import { useConfirm } from "../ConfirmationDialog";
import { Markdown } from "../markdown/Markdown";
import { useSnackbar } from "../SnackbarContext";
import { CMSingleSelect } from "../select/CMSelect";
import { CMSelectNullBehavior } from "../select/CMSingleSelectDialog";
import { ColorSwatch } from "../color/ColorSwatch";
import { useDashboardContext } from "../dashboardContext/DashboardContext";
import type { SetlistPlanGroupPublicId } from "shared/publicId";
import reorderSetlistPlans from "../../db3/mutations/reorderSetlistPlans";
import { useMutation } from "@blitzjs/rpc";

interface SetlistPlanGroupSelectProps {
    tableClient: DB3Client.xTableRenderClient<typeof db3.setlistPlanGroupEditorView>
    selectedGroupId?: SetlistPlanGroupPublicId | null;
    onChange: (group: db3.SetlistPlanGroupEditorClient | null) => void;
};

export const SetlistPlanGroupSelect = ({ tableClient, selectedGroupId, onChange }: SetlistPlanGroupSelectProps) => {
    const items = tableClient.items;
    return <CMSingleSelect<SetlistPlanGroupPublicId>
        renderOption={(groupId) => items.find(g => g.publicId === groupId)?.name || "Unknown Group"}
        getOptionInfo={(groupId) => {
            const group = items.find(g => g.publicId === groupId)!;
            return {
                label: group.name,
                value: group.publicId,
                tooltip: group.description,
                color: group.color?.id ?? null,
                id: group.publicId,
            };
        }}
        getOptions={() => items.map(g => g.publicId)}
        value={selectedGroupId || null}
        nullBehavior={CMSelectNullBehavior.AllowNull}
        onChange={groupId => {
            const group = items.find(g => g.publicId === groupId) || null;
            onChange(group);
        }}
    />;
};

export const SetlistPlanGroupClientColumns = DB3Client.makeClientColumnSet({
    publicId: columnName => new DB3Client.GenericStringColumnClient({ columnName, cellWidth: 140 }),
    name: columnName => new DB3Client.GenericStringColumnClient({ columnName, cellWidth: 250 }),
    description: columnName => new DB3Client.MarkdownStringColumnClient({ columnName, cellWidth: 200 }),
    color: columnName => new DB3Client.ColorColumnClient({ columnName, cellWidth: 100 }),
});


interface SetlistPlanGroupListItemProps {
    tableClient: DB3Client.xTableRenderClient<typeof db3.setlistPlanGroupEditorView>
    group: db3.SetlistPlanGroupEditorClient;
};


export const SetlistPlanGroupListItem = (props: SetlistPlanGroupListItemProps) => {
    const confirm = useConfirm();
    const snackbar = useSnackbar();
    const commands = DB3Client.useCrudViewCommands({
        view: db3.setlistPlanGroupEditorView,
        tableClient: props.tableClient,
    });

    const handleSave = async (obj: db3.SetlistPlanGroupEditorClient, api: DB3EditRowButtonAPI) => {
        await snackbar.invokeAsync(async () => {
            await commands.update(obj, props.group);
            api.closeDialog();
        });
    };

    const handleDelete = async () => {
        const confirmed = await confirm({});
        if (!confirmed) return;
        await snackbar.invokeAsync(async () => {
            await commands.delete(props.group.publicId);
        });
    };

    return <div
        style={{
            border: "1px solid #ccc",
            backgroundColor: "#eee",
            margin: "5px 0",
            borderRadius: "3px",
        }}
    >
        <div style={{ display: "flex", alignItems: "center" }}>
            <div className="dragHandle draggable" style={{
                fontSize: "20px",
                padding: "10px",
            }}>
                ☰
            </div>
            <ColorSwatch color={props.group.color} />
            <h3>{props.group.name}</h3>
            <div style={{ flexGrow: 1 }} />
            <CMSmallButton onClick={handleDelete}>{gIconMap.Delete()}</CMSmallButton>
            <DB3EditRowButton
                row={props.group}
                tableRenderClient={props.tableClient}
                label={<>{gIconMap.Edit()}</>}
                onSave={handleSave}
                smallButton
            />
        </div>
        <div style={{ backgroundColor: "#fff", padding: "5px", margin: "6px" }}>
            <Markdown markdown={props.group.description} />
        </div>
        {/* <div>Created <DateValue value={props.group.createdAt} /> by {props.group.createdByUserId}</div> */}
    </div>;
};

interface SetlistPlanGroupListProps {
    tableClient: DB3Client.xTableRenderClient<typeof db3.setlistPlanGroupEditorView>
};

export const SetlistPlanGroupList = (props: SetlistPlanGroupListProps) => {
    const dashboardContext = useDashboardContext();
    const snackbar = useSnackbar();
    const [reorder] = useMutation(reorderSetlistPlans);
    const commands = DB3Client.useCrudViewCommands({
        view: db3.setlistPlanGroupEditorView,
        tableClient: props.tableClient,
    });

    const newObj = props.tableClient.schema.createNew(dashboardContext.currentUser);
    const client = props.tableClient;
    const items = props.tableClient.items;

    const handleSaveNew = async (obj: db3.SetlistPlanGroupEditorClient, api: DB3EditRowButtonAPI) => {
        await snackbar.invokeAsync(async () => {
            await commands.create(obj);
            api.closeDialog();
        });
    };

    const onDrop = async (args: ReactSmoothDnd.DropResult) => {
        // removedIndex is the previous index; the original item to be moved
        // addedIndex is the new index where it should be moved to.
        if (args.addedIndex == null || args.removedIndex == null) throw new Error(`why are these null?`);
        if (args.addedIndex === args.removedIndex) return; // nothing to do
        const movingItem = items[args.removedIndex];
        const newPositionItem = items[args.addedIndex];
        assert(!!movingItem && !!newPositionItem, "moving item not found?");

        await snackbar.invokeAsync(async () => {
            await reorder({
                kind: "group",
                movingPublicId: movingItem.publicId,
                newPositionPublicId: newPositionItem.publicId,
                scopePublicIds: items.map(item => item.publicId),
            });
            client.refetch();
        });
    };

    return <div className="SetlistPlanGroupList">
        <h2>Setlist Plan Groups</h2>
        <DB3EditRowButton
            onSave={handleSaveNew}
            row={newObj}
            tableRenderClient={props.tableClient}
            label={<>{gIconMap.Add()} New group</>}
        />

        <div>
            <ReactSmoothDndContainer
                dragHandleSelector=".dragHandle"
                lockAxis="y"
                onDrop={onDrop}
            >
                {props.tableClient.items.map((group) => (
                    <ReactSmoothDndDraggable key={group.publicId}>
                        <SetlistPlanGroupListItem key={group.publicId} tableClient={props.tableClient} group={group} />
                    </ReactSmoothDndDraggable>
                ))}
            </ReactSmoothDndContainer>
        </div>
    </div>;
};

