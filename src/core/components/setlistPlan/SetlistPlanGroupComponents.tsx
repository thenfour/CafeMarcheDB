import { assert } from "blitz";
import * as ReactSmoothDnd from "react-smooth-dnd";
import { ReactSmoothDndContainer, ReactSmoothDndDraggable } from "src/core/components/CMCoreComponents";
import { API } from "../../db3/clientAPI";
import { DB3EditRowButton, DB3EditRowButtonAPI } from "../../db3/components/db3NewObjectDialog";
import { gIconMap } from "../../db3/components/IconMap";
import * as DB3Client from "../../db3/DB3Client";
import { SetlistPlanGroupPayload } from "../../db3/shared/schema/setlistPlan";
import { CMSmallButton } from "../CMCoreComponents2";
import { useConfirm } from "../ConfirmationDialog";
import { Markdown } from "../markdown/Markdown";
import { useSnackbar } from "../SnackbarContext";
import { CMSingleSelect } from "../select/CMSelect";
import { CMSelectNullBehavior } from "../select/CMSingleSelectDialog";
import { ColorSwatch } from "../color/ColorSwatch";
import { useDashboardContext } from "../dashboardContext/DashboardContext";

interface SetlistPlanGroupSelectProps {
    tableClient: DB3Client.xTableRenderClient<SetlistPlanGroupPayload>
    selectedGroupId?: number | null;
    onChange: (group: SetlistPlanGroupPayload | null) => void;
};

export const SetlistPlanGroupSelect = ({ tableClient, selectedGroupId, onChange }: SetlistPlanGroupSelectProps) => {
    const items = tableClient.items;
    return <CMSingleSelect<number>
        renderOption={(groupId) => items.find(g => g.id === groupId)?.name || "Unknown Group"}
        getOptionInfo={(groupId) => {
            const group = items.find(g => g.id === groupId)!;
            return {
                label: group.name,
                value: group.id,
                tooltip: group.description,
                color: group.color,
                id: group.id,
            };
        }}
        getOptions={() => items.map(g => g.id)}
        value={selectedGroupId || null}
        nullBehavior={CMSelectNullBehavior.AllowNull}
        onChange={groupId => {
            const group = items.find(g => g.id === groupId) || null;
            onChange(group);
        }}
    />;
};

export const SetlistPlanGroupClientColumns = {
    id: new DB3Client.PKColumnClient({ columnName: "id" }),
    name: new DB3Client.GenericStringColumnClient({ columnName: "name", cellWidth: 250 }),
    description: new DB3Client.MarkdownStringColumnClient({ columnName: "description", cellWidth: 200 }),
    color: new DB3Client.ColorColumnClient({ columnName: "color", cellWidth: 100 }),
};


interface SetlistPlanGroupListItemProps {
    tableClient: DB3Client.xTableRenderClient<SetlistPlanGroupPayload>
    group: SetlistPlanGroupPayload;
};


export const SetlistPlanGroupListItem = (props: SetlistPlanGroupListItemProps) => {
    const dashboardContext = useDashboardContext();
    const confirm = useConfirm();
    const snackbar = useSnackbar();

    const handleSave = async (obj: SetlistPlanGroupPayload, api: DB3EditRowButtonAPI) => {
        await snackbar.invokeAsync(async () => {
            await props.tableClient.doUpdateMutation(obj);
            props.tableClient.refetch();
            api.closeDialog();
        });
    };

    const handleDelete = async () => {
        const confirmed = await confirm({});
        if (!confirmed) return;
        await snackbar.invokeAsync(async () => {
            await props.tableClient.doDeleteMutation(props.group.id, "softWhenPossible");
            props.tableClient.refetch();
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
    tableClient: DB3Client.xTableRenderClient<SetlistPlanGroupPayload>
};

export const SetlistPlanGroupList = (props: SetlistPlanGroupListProps) => {
    const dashboardContext = useDashboardContext();
    const snackbar = useSnackbar();
    const updateSortOrderMutation = API.other.updateGenericSortOrderMutation.useToken();

    const newObj = props.tableClient.schema.createNew(dashboardContext.userClientIntention);
    const client = props.tableClient;
    const items = props.tableClient.items;

    const handleSaveNew = async (obj: SetlistPlanGroupPayload, api: DB3EditRowButtonAPI) => {
        await snackbar.invokeAsync(async () => {
            await props.tableClient.doInsertMutation(obj);
            props.tableClient.refetch();
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
            await updateSortOrderMutation.invoke({
                tableID: client.schema.tableID,
                tableName: client.schema.tableName,
                movingItemId: movingItem.id,
                newPositionItemId: newPositionItem.id,
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
                    <ReactSmoothDndDraggable key={group.id}>
                        <SetlistPlanGroupListItem key={group.id} tableClient={props.tableClient} group={group} />
                    </ReactSmoothDndDraggable>
                ))}
            </ReactSmoothDndContainer>
        </div>
    </div>;
};

