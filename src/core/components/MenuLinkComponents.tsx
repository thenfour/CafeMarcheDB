import React from "react";
import * as ReactSmoothDnd from "react-smooth-dnd";
import { DynamicMenuLinkType } from "shared/dynMenuTypes";
import { Permission } from 'shared/permissions';
import { useAuthorization } from 'src/auth/hooks/useAuthorization';
import { useCurrentUser } from 'src/auth/hooks/useCurrentUser';
import { ReactSmoothDndContainer, ReactSmoothDndDraggable } from "src/core/components/CMCoreComponents";
import { SnackbarContext } from "src/core/components/SnackbarContext";
import * as DB3Client from "src/core/db3/DB3Client";
import * as db3 from "src/core/db3/db3";
import { API } from "../db3/clientAPI";
import { RenderMuiIcon, gIconMap } from '../db3/components/IconSelectDialog';
import { DB3EditRowButton, DB3EditRowButtonAPI } from '../db3/components/db3NewObjectDialog';
import { TAnyModel } from "../db3/shared/apiTypes";
import { KeyValueDisplay, NameValuePair } from './CMCoreComponents2';
import { VisibilityValue } from "./VisibilityControl";
import { assert } from "blitz";
import { slugify } from "shared/rootroot";
import { TextInputWithSearch } from "./SearchableNameColumnClient";
import { CMTextInputBase, CMTextInputBaseProps } from "./CMTextField";


////////////////////////////////////////////////////////////////////////////////////////////////////////////////
interface MenuLinkItemProps {
    item: db3.MenuLinkPayload;
    client: DB3Client.xTableRenderClient;
    readonly: boolean;
};


export const MenuLinkItem = (props: MenuLinkItemProps) => {
    const { showMessage: showSnackbar } = React.useContext(SnackbarContext);

    const handleSave = (obj: TAnyModel, api: DB3EditRowButtonAPI) => {
        props.client.doUpdateMutation(obj).then(async (ret) => {
            showSnackbar({ severity: "success", children: "success" });
            props.client.refetch();
            api.closeDialog();
        }).catch(e => {
            console.log(e);
            showSnackbar({ severity: "error", children: "error" });
        });
    };

    const handleDelete = (api: DB3EditRowButtonAPI) => {
        props.client.doDeleteMutation(props.item.id, 'softWhenPossible').then(() => {
            showSnackbar({ children: "delete successful", severity: 'success' });
            api.closeDialog();
        }).catch(err => {
            console.log(err);
            showSnackbar({ children: "delete error", severity: 'error' });
        }).finally(props.client.refetch);
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

                <VisibilityValue permission={props.item.visiblePermission as any} variant="minimal" />

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
                <a href={`/backstage/wiki/${slugify(props.item.wikiSlug || "")}`} target="_blank" rel="noreferrer" className="menuLinkTestLink wikiCMLink">
                    <div>Test wiki link</div>
                    {gIconMap.Launch()}
                </a>
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

    const clientIntention: db3.xTableClientUsageContext = { intention: "user", mode: 'primary' };
    const [currentUser] = useCurrentUser();
    clientIntention.currentUser = currentUser!;

    const songsClient = DB3Client.useTableRenderContext({
        tableSpec: new DB3Client.xTableClientSpec({
            table: props.schema,
            columns: [
                new DB3Client.PKColumnClient({ columnName: "id" }),
                new DB3Client.GenericStringColumnClient({ columnName: props.columnName, cellWidth: 120 }),
            ],
        }),
        filterModel: {
            quickFilterValues: [searchQuery],
            items: [],
        },
        paginationModel: {
            page: 0,
            pageSize: 1,
        },
        requestedCaps: DB3Client.xTableClientCaps.PaginatedQuery,
        clientIntention,
    });

    const items = songsClient.items as db3.SongPayload_Verbose[];
    const hasMatch = items.length > 0;
    const item = items[0];
    const matchValue = item && item[props.columnName];

    return <div className="searchableValueContainer">
        <CMTextInputBase {...props} />
        <div className="searchableValueResult">
            {matchValue === props.value ? (<div>✅</div>) :
                (<><div className="existingMatchLabel">No matching existing page found; best match: </div>
                    <div className="existingMatchValue">{matchValue}</div></>)}
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

    const [user] = useCurrentUser()!;
    const clientIntention: db3.xTableClientUsageContext = { intention: 'user', mode: 'primary', currentUser: user };

    const client = DB3Client.useTableRenderContext({
        requestedCaps: DB3Client.xTableClientCaps.Query | DB3Client.xTableClientCaps.Mutation,
        clientIntention,
        tableSpec: new DB3Client.xTableClientSpec({
            table: db3.xMenuLink,
            columns: [
                new DB3Client.PKColumnClient({ columnName: "id" }),
                //new DB3Client.GenericIntegerColumnClient({ columnName: "sortOrder", cellWidth: 80 }),

                new DB3Client.GenericStringColumnClient({ columnName: "groupName", cellWidth: 250, fieldCaption: "Group name" }),
                new DB3Client.GenericStringColumnClient({ columnName: "caption", cellWidth: 250, fieldCaption: "Item text", className: "titleText" }),
                new DB3Client.IconFieldClient({ columnName: "iconName", cellWidth: 120, fieldCaption: "Icon" }),

                //new DB3Client.ConstEnumStringFieldClient({ columnName: "realm", cellWidth: 120 }),
                new DB3Client.ConstEnumStringFieldClient({ columnName: "linkType", cellWidth: 120, fieldCaption: "Type" }),
                //new DB3Client.ConstEnumStringFieldClient({ columnName: "applicationPage", cellWidth: 120 }),
                new DB3Client.GenericStringColumnClient({ columnName: "externalURI", cellWidth: 250, fieldCaption: "External URL" }),
                new SearchableWikiSlugColumnClient({ columnName: "wikiSlug", cellWidth: 250 }),

                //new DB3Client.ForeignSingleFieldClient({ columnName: "createdByUser", cellWidth: 120, }),
                new DB3Client.ForeignSingleFieldClient({ columnName: "visiblePermission", cellWidth: 120, }),

                new DB3Client.GenericStringColumnClient({ columnName: "groupCssClass", cellWidth: 250, fieldCaption: "Group CSS class" }),
                new DB3Client.GenericStringColumnClient({ columnName: "itemCssClass", cellWidth: 250, fieldCaption: "Item CSS class" }),


            ],
        }),
    });

    const canEdit = useAuthorization("MenuLink management page", Permission.customize_menu);

    const newObj = db3.xMenuLink.createNew(clientIntention) as db3.MenuLinkPayload;
    newObj.iconName = "Link" as keyof typeof gIconMap;
    newObj.linkType = DynamicMenuLinkType.Wiki;
    newObj.visiblePermission = API.users.getDefaultVisibilityPermission();

    const handleSaveNew = (obj: TAnyModel, api: DB3EditRowButtonAPI) => {
        client.doInsertMutation(obj).then(async (ret) => {
            showSnackbar({ severity: "success", children: "success" });
            client.refetch();
            api.closeDialog();
        }).catch(e => {
            console.log(e);
            showSnackbar({ severity: "error", children: "error" });
        });

    };

    const items = client.items as db3.MenuLinkPayload[];

    const onDrop = (args: ReactSmoothDnd.DropResult) => {
        // removedIndex is the previous index; the original item to be moved
        // addedIndex is the new index where it should be moved to.
        if (args.addedIndex == null || args.removedIndex == null) throw new Error(`why are these null?`);
        const movingItem = items[args.removedIndex];
        const newPositionItem = items[args.addedIndex];
        assert(!!movingItem && !!newPositionItem, "moving item not found?");

        updateSortOrderMutation.invoke({
            tableID: db3.xMenuLink.tableID,
            tableName: db3.xMenuLink.tableName,
            movingItemId: movingItem.id,
            newPositionItemId: newPositionItem.id,
        }).then(() => {
            showSnackbar({ severity: "success", children: "reorder successful" });
            client.refetch();
        }).catch((e) => {
            console.log(e);
            showSnackbar({ severity: "error", children: "reorder error; see console" });
        });
    };

    return <div>
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
                        <MenuLinkItem key={i.id} item={i} client={client} readonly={!canEdit} />
                    </ReactSmoothDndDraggable>
                )}
            </ReactSmoothDndContainer>
        </div>
    </div>;
};


