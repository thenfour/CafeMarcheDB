import { Tooltip } from "@mui/material";
import React from "react";
import { gLightSwatchColors, gSwatchColors } from "shared/color";
import { Permission } from 'shared/permissions';
import { SnackbarContext } from "src/core/components/SnackbarContext";
import * as DB3Client from "src/core/db3/DB3Client";
import * as db3 from "src/core/db3/db3";
import { getAbsoluteUrl } from '../db3/clientAPILL';
import { gIconMap } from "../db3/components/IconMap";
import { DB3EditRowButton, DB3EditRowButtonAPI } from '../db3/components/db3NewObjectDialog';
import { ActivityFeature } from "./featureReports/activityTracking";
import { TAnyModel, gNullValue } from "../db3/shared/apiTypes";
import { AppContextMarker } from "./AppContext";
import { CMChip, CMChipContainer } from "./CMChip";
import { CMSmallButton, NameValuePair } from './CMCoreComponents2';
import { CMTextInputBase } from './CMTextField';
import { DashboardContext, useFeatureRecorder } from "./DashboardContext";
import { Markdown } from "./markdown/Markdown";


const gRedirectTypeColorMap: Record<keyof typeof db3.CustomLinkRedirectType, string> = {
    [db3.CustomLinkRedirectType.Disabled]: gSwatchColors.red,
    [db3.CustomLinkRedirectType.Permanent]: gSwatchColors.citron,
    [db3.CustomLinkRedirectType.Temporary]: gSwatchColors.blue,
    [db3.CustomLinkRedirectType.Client]: gSwatchColors.teal,
    [db3.CustomLinkRedirectType.IntermediatePage]: gSwatchColors.purple,
};


//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export interface CustomLinkSlugColumnArgs {
    columnName: string;
    fieldCaption?: string;
};

export class CustomLinkSlugColumn extends DB3Client.GenericStringColumnClient {
    constructor(args: CustomLinkSlugColumnArgs) {
        super({
            cellWidth: 250,
            columnName: args.columnName,
            fieldCaption: args.fieldCaption,
        });
    }

    renderForNewDialog = (params: DB3Client.RenderForNewItemDialogArgs) => this.defaultRenderer({
        validationResult: params.validationResult,
        isReadOnly: false,
        value: <div className='CustomLinkSlugColumnValue'>
            <CMTextInputBase
                onChange={(e, val) => params.api.setFieldValues({ [this.columnName]: val })}
                autoFocus={params.autoFocus}
                value={params.value as string}
                className={this.className}
            />
            <>{params.value && <div className='preview'>{getAbsoluteUrl(((params.value as string) || "").trim())}</div>}</>
        </div>
    });
};





////////////////////////////////////////////////////////////////////////////////////////////////////////////////
interface CustomLinkItemProps {
    item: db3.CustomLinkPayload;
    client: DB3Client.xTableRenderClient;
    readonly: boolean;
};


export const CustomLinkItem = (props: CustomLinkItemProps) => {
    const { showMessage: showSnackbar } = React.useContext(SnackbarContext);
    const recordFeature = useFeatureRecorder();

    const handleSave = (obj: TAnyModel, api: DB3EditRowButtonAPI) => {
        void recordFeature({
            feature: ActivityFeature.custom_link_update,
            customLinkId: props.item.id,
            context: `CustomLinkItem`,
        });
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
        void recordFeature({
            feature: ActivityFeature.custom_link_delete,
            customLinkId: props.item.id,
            context: `CustomLinkItem`,
        });
        props.client.doDeleteMutation(props.item.id, 'softWhenPossible').then(() => {
            showSnackbar({ children: "delete successful", severity: 'success' });
            api.closeDialog();
        }).catch(err => {
            console.log(err);
            showSnackbar({ children: "delete error", severity: 'error' });
        }).finally(props.client.refetch);
    }

    const redirectType: keyof typeof db3.CustomLinkRedirectType = props.item.redirectType as any;

    const absoluteLocalURL = getAbsoluteUrl(props.item.slug);

    const clipboardCopy = async (text: string) => {
        await navigator.clipboard.writeText(text);
        showSnackbar({ severity: "success", children: `Copied ${text.length} characters to clipboard` });
    };

    return <div className='CustomLink EventDetail contentSection event'>
        <div className='content'>

            <div className='titleLine'>
                <div className="titleText">
                    {props.item.name}
                </div>
                <div className='flex-spacer'></div>
                {!props.readonly && <DB3EditRowButton
                    onSave={handleSave}
                    row={props.item}
                    tableRenderClient={props.client}
                    onDelete={handleDelete}
                />}
            </div>
            <CMChipContainer>
                <CMChip
                    color={gRedirectTypeColorMap[redirectType]}
                    shape="rectangle"
                >
                    {props.item.redirectType}
                </CMChip>
                <CMChip
                    color={props.item.forwardQuery ? gLightSwatchColors.light_green : gLightSwatchColors.light_gold}
                >
                    {props.item.forwardQuery ? "Query forwarding enabled" : "Query forwarding disabled"}
                </CMChip>
            </CMChipContainer>

            <div className='subtitleLine'>Visited {props.item._count.visits} times</div>
            <div className='subtitleLine'>Created by {props.item.createdByUser?.name} on {props.item.createdAt.toDateString()}</div>

            <Markdown markdown={props.item.description} />

            <NameValuePair
                isReadOnly={props.readonly}
                name="Slug"
                value={<div className="customURLslugValueRow">
                    <div>{absoluteLocalURL}</div>
                    <div className="flex-spacer"></div>
                    <Tooltip title={"Copy URL to clipboard. Useful for testing."}>
                        <div><CMSmallButton onClick={() => { void clipboardCopy(absoluteLocalURL) }} >{gIconMap.ContentCopy()}</CMSmallButton></div>
                    </Tooltip>
                </div>}
            />

            <NameValuePair
                isReadOnly={props.readonly}
                name="External URL"
                value={<div className="customURLslugValueRow">
                    <div>{props.item.destinationURL}</div>
                    <div className="flex-spacer"></div>
                    <Tooltip title={"Copy URL to clipboard."}>
                        <div><CMSmallButton onClick={() => { void clipboardCopy(props.item.destinationURL) }} >{gIconMap.ContentCopy()}</CMSmallButton></div>
                    </Tooltip>
                </div>}
            />

            {redirectType === "IntermediatePage" &&
                <Markdown markdown={props.item.intermediateMessage} />}

        </div>
    </div>;
}

export const CustomLinkList = () => {
    const dashboardContext = React.useContext(DashboardContext);
    const recordFeature = useFeatureRecorder();
    const { showMessage: showSnackbar } = React.useContext(SnackbarContext);

    const getItemInfo = (option: { value: string, label: string }): DB3Client.ConstEnumStringFieldClientItemInfo => {
        if (option.value === gNullValue) return {};
        return {
            color: gRedirectTypeColorMap[option.value],
            descriptionMarkdownSettingKey: `CustomLinkRedirectTypeDescriptionMarkdown_${option.value}`,
        };
    };

    const client = DB3Client.useTableRenderContext({
        requestedCaps: DB3Client.xTableClientCaps.Query | DB3Client.xTableClientCaps.Mutation,
        clientIntention: dashboardContext.userClientIntention,
        tableSpec: new DB3Client.xTableClientSpec({
            table: db3.xCustomLink,
            columns: [
                new DB3Client.PKColumnClient({ columnName: "id" }),
                new DB3Client.GenericStringColumnClient({ columnName: "name", cellWidth: 250, fieldCaption: "Name" }),
                new DB3Client.MarkdownStringColumnClient({ columnName: "description", cellWidth: 250, visible: true }), // required field but it's distracting to see here.
                new CustomLinkSlugColumn({ columnName: "slug", fieldCaption: "Slug" }),
                new DB3Client.GenericStringColumnClient({ columnName: "destinationURL", cellWidth: 250, fieldCaption: "External URL" }),
                new DB3Client.ConstEnumStringFieldClient({ columnName: "redirectType", cellWidth: 250, getItemInfo }),
                new DB3Client.MarkdownStringColumnClient({ columnName: "intermediateMessage", cellWidth: 250, visible: true }),
                new DB3Client.BoolColumnClient({ columnName: "forwardQuery", fieldCaption: "Forward URL parameters?" }),
            ],
        }),
    });

    const canEdit = dashboardContext.isAuthorized(Permission.manage_custom_links);

    const newObj = db3.xCustomLink.createNew(dashboardContext.userClientIntention);

    const handleSaveNew = (obj: TAnyModel, api: DB3EditRowButtonAPI) => {
        void recordFeature({
            feature: ActivityFeature.custom_link_create,
            context: `CustomLinkList`,
        });
        client.doInsertMutation(obj).then(async (ret) => {
            showSnackbar({ severity: "success", children: "success" });
            client.refetch();
            api.closeDialog();
        }).catch(e => {
            console.log(e);
            showSnackbar({ severity: "error", children: "error" });
        });

    };

    const items = client.items as db3.CustomLinkPayload[];

    return <div>
        <AppContextMarker name="CustomLinkList">
            {canEdit &&
                <DB3EditRowButton
                    onSave={handleSaveNew}
                    row={newObj}
                    tableRenderClient={client}
                    label={<>{gIconMap.Add()} New custom link</>}
                />}

            <div className='EventDashboard'>
                {items.map(i => <CustomLinkItem key={i.id} item={i} client={client} readonly={!canEdit} />)}
            </div>
        </AppContextMarker>
    </div>;
};


