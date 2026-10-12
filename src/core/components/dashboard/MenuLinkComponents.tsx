import { assert } from "blitz";
import React from "react";
import * as ReactSmoothDnd from "react-smooth-dnd";
import { DynamicMenuLinkType } from "shared/dynMenuTypes";
import { Permission } from 'shared/permissions';
import { TAnyModel } from "shared/rootroot";
import { ReactSmoothDndContainer, ReactSmoothDndDraggable } from "src/core/components/CMCoreComponents";
import { SnackbarContext } from "src/core/components/SnackbarContext";
import * as DB3Client from "src/core/db3/DB3Client";
import * as db3 from "src/core/db3/db3";
import { gIconMap, RenderMuiIcon } from "../../db3/components/IconMap";
import { DB3EditRowButton, type DB3EditRowButtonAPI } from '../../db3/components/db3NewObjectDialog';
import { AppContextMarker } from "../AppContext";
import { KeyValueDisplay } from '../CMCoreComponents2';
import { CMLink } from "../CMLink";
import { VisibilityValue } from "../VisibilityControl";
import { useDashboardContext, useFeatureRecorder } from "../dashboardContext/DashboardContext";
import { ActivityFeature } from "../featureReports/activityTracking";
import { WikiSlugInputWithSearch } from "../wiki/WikiSlugInputWithSearch";
import { LocalizedStringColumnClient } from "src/core/db3/components/DB3CatalogFields";
import { localizedText } from "src/core/db3/shared/columnTypes/localizedString";
import { withMemberPresentation } from "../user/bandMemberLinks";
import { wikiMakeRelativeURI } from "src/core/wiki/shared/wikiUtils";


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
            menuLinkId: props.item.publicId,
            context: "MenuLinkItem",
        });
        props.commands.update(obj, props.item).then(async () => {
            showSnackbar({ severity: "success", children: "success" });
            await dashboardContext.refetchDashboardData();
            api.closeDialog();
        }).catch(e => {
            console.log(e);
            showSnackbar({ severity: "error", children: "error" });
        });
    };

    const handleDelete = (api: DB3EditRowButtonAPI) => {
        void recordFeature({
            feature: ActivityFeature.menu_link_delete,
            menuLinkId: props.item.publicId,
            context: "MenuLinkItem",
        });
        props.commands.delete(props.item.publicId).then(() => {
            showSnackbar({ children: "delete successful", severity: 'success' });
            api.closeDialog();
        }).finally(() => dashboardContext.refetchDashboardData()).catch(err => {
            console.log(err);
            showSnackbar({ children: "delete error", severity: 'error' });
        });
    }

    const loggable = {
        "groupName": props.item.groupName,
        "linkType": props.item.linkType,
        "externalURI": (props.item.linkType as keyof typeof DynamicMenuLinkType) === "ExternalURL" ? props.item.externalURI : undefined,
        "wikiSlug": (props.item.linkType as keyof typeof DynamicMenuLinkType) === "Wiki" ? props.item.wikiSlug : undefined,
        "Created by": props.item.createdAt
            ? `${props.item.createdByUser?.name} on ${props.item.createdAt.toDateString()} at ${props.item.createdAt.toTimeString()}`
            : undefined,
    };

    return <div className='MenuLink EventDetail contentSection event'>

        <div className="header dragHandle draggable">
            ☰ Order: {props.item.sortOrder}

        </div>

        <div className='content'>

            <div className='titleLine'>
                <div className="titleText">
                    {RenderMuiIcon(props.item.iconName)} {localizedText(props.item.caption)}
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
                <CMLink href={withMemberPresentation(wikiMakeRelativeURI(props.item.wikiSlug || ""), dashboardContext.memberPresentation)} target="_blank" rel="noreferrer" className="menuLinkTestLink wikiCMLink">
                    <div>Test wiki link</div>
                    {gIconMap.Launch()}
                </CMLink>
            }
        </div>
    </div>;
}



//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// this is basically TextInputWithSearchProps but with different formatting.
export { WikiSlugInputWithSearch } from "../wiki/WikiSlugInputWithSearch";
export type { WikiSlugInputWithSearchProps } from "../wiki/WikiSlugInputWithSearch";




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
            aria-label={this.fieldCaption}
            onChange={(e, val) => params.api.setFieldValues({ [this.columnName]: val })}
            autoFocus={params.autoFocus}
            // This column is bound to the MenuLink editor's string-valued wikiSlug.
            value={params.value as string}
            className={this.className}

            allowSearch={!params.validationResult || !!params.validationResult.success}
        />
    });
};






export const MenuLinkList = () => {
    const { showMessage: showSnackbar } = React.useContext(SnackbarContext);
    const reorderCommand = DB3Client.useDB3Command(db3.reorderMenuLinksCommand);
    const dashboardContext = useDashboardContext();
    const recordFeature = useFeatureRecorder();

    const tableSpec = DB3Client.defineTableClientSpec({
        view: db3.menuLinkListView,
        columns: {
            publicId: DB3Client.publicIdFieldGen(),

            applicationPage: columnName => new DB3Client.GenericStringColumnClient({ fieldDescriptionKey: null, columnName, cellWidth: 250, fieldCaptionKey: "db3.fields.sectionName" }),
            groupName: columnName => new DB3Client.GenericStringColumnClient({ fieldDescriptionKey: "menuLink.groupName.DescriptionMarkdown", columnName, cellWidth: 250, fieldCaptionKey: "db3.fields.groupName" }),
            caption: columnName => new LocalizedStringColumnClient({
                columnName,
                fieldCaptionKey: "db3.fields.menuItemText",
            }),
            iconName: columnName => new DB3Client.IconFieldClient({ fieldDescriptionKey: "menuLink.iconName.DescriptionMarkdown", columnName, cellWidth: 120, fieldCaptionKey: "db3.fields.icon" }),

            linkType: columnName => new DB3Client.ConstEnumStringFieldClient({ fieldDescriptionKey: "menuLink.linkType.DescriptionMarkdown", columnName, cellWidth: 120, fieldCaptionKey: "db3.fields.type" }),
            externalURI: columnName => new DB3Client.GenericStringColumnClient({ fieldDescriptionKey: "menuLink.externalURI.DescriptionMarkdown", columnName, cellWidth: 250, fieldCaptionKey: "db3.fields.externalUrl" }),
            wikiSlug: columnName => new SearchableWikiSlugColumnClient({ fieldDescriptionKey: "menuLink.wikiSlug.DescriptionMarkdown", fieldCaptionKey: "db3.fields.wikiSlug", columnName, cellWidth: 250 }),

            visiblePermission: DB3Client.foreignRefFieldGen({ fieldDescriptionKey: "menuLink.visiblePermission.DescriptionMarkdown", fieldCaptionKey: "db3.fields.visibility",
                selectionView: db3.permissionVisibilityView,
            }),

            groupCssClass: columnName => new DB3Client.GenericStringColumnClient({ fieldDescriptionKey: "menuLink.groupCssClass.DescriptionMarkdown", columnName, cellWidth: 250, fieldCaptionKey: "db3.fields.groupCssClass" }),
            itemCssClass: columnName => new DB3Client.GenericStringColumnClient({ fieldDescriptionKey: "menuLink.itemCssClass.DescriptionMarkdown", columnName, cellWidth: 250, fieldCaptionKey: "db3.fields.itemCssClass" }),
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

    // xTable.createNew still exposes its legacy generic model; this editor is
    // explicitly bound to the named MenuLink view's client contract.
    const newObj = db3.xMenuLink.createNew(dashboardContext.currentUser) as db3.ClientOf<typeof db3.menuLinkEditorView>;
    // iconName is persisted from the registered icon-key vocabulary.
    newObj.iconName = "Link" as keyof typeof gIconMap;
    newObj.linkType = DynamicMenuLinkType.ExternalURL;
    const defaultVisibilityPermission = dashboardContext.getDefaultVisibilityPermission();
    newObj.visiblePermission = defaultVisibilityPermission;
    newObj.visiblePermissionId = db3.xPermission.getIdentity(defaultVisibilityPermission);

    const handleSaveNew = (obj: TAnyModel, api: DB3EditRowButtonAPI) => {
        void recordFeature({
            feature: ActivityFeature.menu_link_create,
            context: "MenuLinkList",
        });
        commands.create(obj).then(async () => {
            showSnackbar({ severity: "success", children: "success" });
            await dashboardContext.refetchDashboardData();
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
        if (args.addedIndex == null || args.removedIndex == null) {
            return;
        }
        if (args.addedIndex === args.removedIndex) {
            return;
        }
        const movingItem = items[args.removedIndex];
        const newPositionItem = items[args.addedIndex];
        assert(!!movingItem && !!newPositionItem, "moving item not found?");

        void recordFeature({
            feature: ActivityFeature.menu_link_reorder,
            context: "MenuLinkList",
            menuLinkId: movingItem.publicId,
        });

        reorderCommand.invoke({
            movingItemId: movingItem.publicId,
            newPositionItemId: newPositionItem.publicId,
            scopeRowIds: items.map(item => item.publicId),
        }).then(async () => {
            showSnackbar({ severity: "success", children: "reorder successful" });
            await dashboardContext.refetchDashboardData();
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
                        <ReactSmoothDndDraggable key={i.publicId}>
                            <MenuLinkItem
                                key={i.publicId}
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
