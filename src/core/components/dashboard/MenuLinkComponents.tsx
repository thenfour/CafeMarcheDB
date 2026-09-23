import { assert } from "blitz";
import React from "react";
import * as ReactSmoothDnd from "react-smooth-dnd";
import { DynamicMenuLinkType } from "shared/dynMenuTypes";
import { Permission } from 'shared/permissions';
import { slugify, TAnyModel } from "shared/rootroot";
import { ReactSmoothDndContainer, ReactSmoothDndDraggable } from "src/core/components/CMCoreComponents";
import { SnackbarContext } from "src/core/components/SnackbarContext";
import * as DB3Client from "src/core/db3/DB3Client";
import * as db3 from "src/core/db3/db3";
import { API } from "../../db3/clientAPI";
import { gIconMap, RenderMuiIcon } from "../../db3/components/IconMap";
import { DB3EditRowButton, type DB3EditRowButtonAPI } from '../../db3/components/db3NewObjectDialog';
import { AppContextMarker } from "../AppContext";
import { KeyValueDisplay } from '../CMCoreComponents2';
import { CMLink } from "../CMLink";
import { CMTextInputBase, type CMTextInputBaseProps } from "../CMTextField";
import { VisibilityValue } from "../VisibilityControl";
import { useDashboardContext, useFeatureRecorder } from "../dashboardContext/DashboardContext";
import { ActivityFeature } from "../featureReports/activityTracking";


////////////////////////////////////////////////////////////////////////////////////////////////////////////////
interface MenuLinkItemProps {
    item: db3.MenuLinkListClient;
    client: DB3Client.xTableRenderClient<typeof db3.menuLinkListView>;
    commands: DB3Client.CrudViewCommandClient;
    readonly: boolean;
};


export const MenuLinkItem = (props: MenuLinkItemProps) => {
    const { showMessage: showSnackbar } = React.useContext(SnackbarContext);
    const dashboardContext = useDashboardContext();
    const recordFeature = useFeatureRecorder();

    const handleSave = (obj: TAnyModel, api: DB3EditRowButtonAPI) => {
        void recordFeature({
            feature: ActivityFeature.menu_link_update,
            menuLinkId: props.item.id,
            context: "MenuLinkItem",
        });
        props.commands.update(obj, props.item).then(() => {
            showSnackbar({ severity: "success", children: "success" });
            dashboardContext.refetchDashboardData();
            api.closeDialog();
        }).catch(e => {
            console.log(e);
            showSnackbar({ severity: "error", children: "error" });
        });
    };

    const handleDelete = (api: DB3EditRowButtonAPI) => {
        void recordFeature({
            feature: ActivityFeature.menu_link_delete,
            menuLinkId: props.item.id,
            context: "MenuLinkItem",
        });
        props.commands.delete(props.item.id).then(() => {
            showSnackbar({ children: "delete successful", severity: 'success' });
            api.closeDialog();
        }).catch(err => {
            console.log(err);
            showSnackbar({ children: "delete error", severity: 'error' });
        }).finally(() => {
            dashboardContext.refetchDashboardData();
        });
    }

    const loggable = {
        "groupName": props.item.groupName,
        "linkType": props.item.linkType,
        "externalURI": (props.item.linkType as keyof typeof DynamicMenuLinkType) === "ExternalURL" ? props.item.externalURI : undefined,
        "wikiSlug": (props.item.linkType as keyof typeof DynamicMenuLinkType) === "Wiki" ? props.item.wikiSlug : undefined,
        "Created by": `${props.item.createdByUser?.name} on ${props.item.createdAt.toDateString()} at ${props.item.createdAt.toTimeString()}`,
    };

    return <div className='MenuLink EventDetail contentSection event'>

        <div className="header dragHandle draggable">
            ☰ Order: {props.item.sortOrder}

        </div>

        <div className='content'>

            <div className='titleLine'>
                <div className="titleText">
                    {RenderMuiIcon(props.item.iconName)} {props.item.caption}
                </div>
                <div className='flex-spacer'></div>

                <VisibilityValue permissionId={props.item.visiblePermissionId} variant="minimal" />

                {!props.readonly && <DB3EditRowButton
                    onSave={handleSave}
                    row={props.item}
                    tableRenderClient={props.client}
                    onDelete={handleDelete}
                />}
            </div>
            {/* <div className='subtitleLine'>Created by {props.item.createdByUser?.name} on {props.item.createdAt.toDateString()}</div> */}

            <KeyValueDisplay data={loggable} />

            {
                ((props.item.linkType as keyof typeof DynamicMenuLinkType) === "ExternalURL") &&
                <a href={props.item.externalURI || ""} target="_blank" rel="noreferrer" className="menuLinkTestLink">
                    <div>Test external link</div>
                    {gIconMap.Launch()}
                </a>
            }

            {
                ((props.item.linkType as keyof typeof DynamicMenuLinkType) === "Wiki") &&
                <CMLink href={`/backstage/wiki/${slugify(props.item.wikiSlug || "")}`} target="_blank" rel="noreferrer" className="menuLinkTestLink wikiCMLink">
                    <div>Test wiki link</div>
                    {gIconMap.Launch()}
                </CMLink>
            }
        </div>
    </div>;
}



//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// this is basically TextInputWithSearchProps but with different formatting.
export interface WikiSlugInputWithSearchProps extends CMTextInputBaseProps {
    columnName: string;
    schema: db3.xTable;
    allowSearch: boolean;
};
export const WikiSlugInputWithSearch = (props: WikiSlugInputWithSearchProps) => {
    const searchQuery = props.value || "";


    // legacy because of columnName being runtime so correct type cannot be known.
    const songsClient = DB3Client.useLegacyTableRenderContext({
        tableSpec: DB3Client.defineLegacyDynamicTableClientSpec({
            table: props.schema,
            columns: [
                new DB3Client.PKColumnClient({ columnName: "id" }),
                new DB3Client.GenericStringColumnClient({ columnName: props.columnName, cellWidth: 120 }),
            ],
        }),
        filterModel: {
            quickFilterValues: [searchQuery],
        },
        paginationModel: {
            page: 0,
            pageSize: 1,
        },
        requestedCaps: DB3Client.xTableClientCaps.PaginatedQuery,
    });

    const items = songsClient.items;
    const hasMatch = items.length > 0;
    const item = items[0];
    const matchValue = (item && (item[props.columnName] as string)) || "";

    return <div className="searchableValueContainer">
        <CMTextInputBase {...props} />
        <div className="searchableValueResult">
            {matchValue === props.value ?
                (<div>✅</div>)
                : (((props.value || "").length > 1) && (<>
                    <div className="existingMatchLabel">No matching existing page found; best match: </div>
                    <div className="existingMatchValue">{matchValue}</div>
                </>))
            }
        </div>
    </div>;
};




//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// here we just want to have a column which allows checking if an object of similar name already exists
export interface SearchableWikiSlugColumnArgs extends DB3Client.GenericStringColumnArgs {
};

export class SearchableWikiSlugColumnClient extends DB3Client.GenericStringColumnClient {
    constructor(args: SearchableWikiSlugColumnArgs) {
        super(args);
    }
    renderForNewDialog = (params: DB3Client.RenderForNewItemDialogArgs) => this.defaultRenderer({
        validationResult: params.validationResult,
        isReadOnly: false,
        value: <WikiSlugInputWithSearch
            onChange={(e, val) => params.api.setFieldValues({ [this.columnName]: val })}
            autoFocus={params.autoFocus}
            value={params.value as string}
            className={this.className}

            allowSearch={!params.validationResult || !!params.validationResult.success}
            columnName={"slug"}
            schema={db3.xWikiPage}
        />
    });
};






export const MenuLinkList = () => {
    const { showMessage: showSnackbar } = React.useContext(SnackbarContext);
    const updateSortOrderMutation = API.other.updateGenericSortOrderMutation.useToken();
    const dashboardContext = useDashboardContext();
    const recordFeature = useFeatureRecorder();

    const tableSpec = DB3Client.defineTableClientSpec({
        view: db3.menuLinkListView,
        columns: {
            id: columnName => new DB3Client.PKColumnClient({ columnName }),

            applicationPage: columnName => new DB3Client.GenericStringColumnClient({ columnName, cellWidth: 250, fieldCaption: "Section name" }),
            groupName: columnName => new DB3Client.GenericStringColumnClient({ columnName, cellWidth: 250, fieldCaption: "Group name" }),
            caption: columnName => new DB3Client.GenericStringColumnClient({ columnName, cellWidth: 250, fieldCaption: "Item text", className: "titleText" }),
            iconName: columnName => new DB3Client.IconFieldClient({ columnName, cellWidth: 120, fieldCaption: "Icon" }),

            linkType: columnName => new DB3Client.ConstEnumStringFieldClient({ columnName, cellWidth: 120, fieldCaption: "Type" }),
            externalURI: columnName => new DB3Client.GenericStringColumnClient({ columnName, cellWidth: 250, fieldCaption: "External URL" }),
            wikiSlug: columnName => new SearchableWikiSlugColumnClient({ columnName, cellWidth: 250 }),

            visiblePermission: DB3Client.foreignRefFieldGen({
                selectionView: db3.permissionVisibilityView,
            }),

            groupCssClass: columnName => new DB3Client.GenericStringColumnClient({ columnName, cellWidth: 250, fieldCaption: "Group CSS class" }),
            itemCssClass: columnName => new DB3Client.GenericStringColumnClient({ columnName, cellWidth: 250, fieldCaption: "Item CSS class" }),
        },
    });
    const client = DB3Client.useTableRenderContext({
        requestedCaps: DB3Client.xTableClientCaps.Query,
        referenceProvider: dashboardContext.referenceStore,
        tableSpec,
    });
    const commands = DB3Client.useCrudViewCommands({
        view: db3.menuLinkEditorView,
        tableClient: client,
    });

    const canEdit = dashboardContext.isAuthorized(Permission.customize_menu);

    const newObj = db3.xMenuLink.createNew(dashboardContext.currentUser) as db3.MenuLinkPayload;
    newObj.iconName = "Link" as keyof typeof gIconMap;
    newObj.linkType = DynamicMenuLinkType.Wiki;
    newObj.visiblePermission = dashboardContext.getDefaultVisibilityPermission();
    newObj.visiblePermissionId = newObj.visiblePermission?.id;

    const handleSaveNew = (obj: TAnyModel, api: DB3EditRowButtonAPI) => {
        void recordFeature({
            feature: ActivityFeature.menu_link_create,
            context: "MenuLinkList",
        });
        commands.create(obj).then(() => {
            showSnackbar({ severity: "success", children: "success" });
            dashboardContext.refetchDashboardData();
            api.closeDialog();
        }).catch(e => {
            console.log(e);
            showSnackbar({ severity: "error", children: "error" });
        });

    };

    const items = client.items;

    const onDrop = (args: ReactSmoothDnd.DropResult) => {
        // removedIndex is the previous index; the original item to be moved
        // addedIndex is the new index where it should be moved to.
        if (args.addedIndex == null || args.removedIndex == null) throw new Error(`why are these null?`);
        if (args.addedIndex === args.removedIndex) return; // nothing to do
        const movingItem = items[args.removedIndex];
        const newPositionItem = items[args.addedIndex];
        assert(!!movingItem && !!newPositionItem, "moving item not found?");

        void recordFeature({
            feature: ActivityFeature.menu_link_reorder,
            context: "MenuLinkList",
            menuLinkId: movingItem.id,
        });

        updateSortOrderMutation.invoke({
            tableID: db3.xMenuLink.tableID,
            tableName: db3.xMenuLink.tableName,
            movingItemId: movingItem.id,
            newPositionItemId: newPositionItem.id,
            scopeRowIds: items.map(item => item.id),
        }).then(() => {
            showSnackbar({ severity: "success", children: "reorder successful" });
            dashboardContext.refetchDashboardData();
            client.refetch();
        }).catch((e) => {
            console.log(e);
            showSnackbar({ severity: "error", children: "reorder error; see console" });
        });
    };

    return <div>
        <AppContextMarker name="MenuLinkList">
            {canEdit &&
                <DB3EditRowButton
                    onSave={handleSaveNew}
                    row={newObj}
                    tableRenderClient={client}
                    label={<>{gIconMap.Add()} New menu item</>}
                />}

            <div className='EventDashboard'>
                <ReactSmoothDndContainer
                    dragHandleSelector=".dragHandle"
                    lockAxis="y"
                    onDrop={onDrop}
                >
                    {items.map(i =>
                        <ReactSmoothDndDraggable key={i.id}>
                            <MenuLinkItem
                                key={i.id}
                                item={i}
                                client={client}
                                commands={commands}
                                readonly={!canEdit}
                            />
                        </ReactSmoothDndDraggable>
                    )}
                </ReactSmoothDndContainer>
            </div>
        </AppContextMarker>
    </div>;
};


