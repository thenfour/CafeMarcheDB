import { gNullValue, TAnyModel } from "@/shared/rootroot";
import { Tooltip, Typography } from "@mui/material";
import React from "react";
import { Permission } from 'shared/permissions';
import { SnackbarContext } from "src/core/components/SnackbarContext";
import * as DB3Client from "src/core/db3/DB3Client";
import * as db3 from "src/core/db3/db3";
import { gIconMap } from "../db3/components/IconMap";
import { DB3EditRowButton, DB3EditRowButtonAPI } from '../db3/components/db3NewObjectDialog';
import { AppContextMarker } from "./AppContext";
import { CMChip, CMChipContainer } from "./CMChip";
import { CMSmallButton, NameValuePair } from './CMCoreComponents2';
import { CMTextInputBase } from './CMTextField';
import { gLightSwatchColors, gSwatchColors } from "./color/palette";
import { useDashboardContext, useFeatureRecorder } from "./dashboardContext/DashboardContext";
import { ActivityFeature } from "./featureReports/activityTracking";
import { Markdown } from "./markdown/Markdown";
import { useLocale } from "src/locale/components/useLocale";
import type { LocalizedMarkdownKey, LocalizedPlainStringKey } from "src/locale/shared/staticLocalizedStringRegistry";
import { customLinkHref } from "src/core/db3/shared/entities/customLink/customLinkUrl";

function CustomLinkUrlPreview({ slug }: { readonly slug: string }) {
    const dashboard = useDashboardContext();
    const bandPublicId = dashboard.memberPresentation.bandPublicId;
    return bandPublicId ? <>{dashboard.getAbsoluteUri(customLinkHref(slug.trim(), bandPublicId, dashboard.portalHosting))}</> : null;
}


const gRedirectTypeColorMap: Record<keyof typeof db3.CustomLinkRedirectType, string> = {
    [db3.CustomLinkRedirectType.Disabled]: gSwatchColors.red,
    [db3.CustomLinkRedirectType.Permanent]: gSwatchColors.citron,
    [db3.CustomLinkRedirectType.Temporary]: gSwatchColors.blue,
    [db3.CustomLinkRedirectType.Client]: gSwatchColors.teal,
    [db3.CustomLinkRedirectType.IntermediatePage]: gSwatchColors.purple,
    [db3.CustomLinkRedirectType.ServeFile]: gSwatchColors.orange,
};

const redirectTypeText: Record<keyof typeof db3.CustomLinkRedirectType, {
    readonly labelKey: LocalizedPlainStringKey;
    readonly descriptionKey: LocalizedMarkdownKey;
}> = {
    Disabled: { labelKey: "db3.customLink.disabled", descriptionKey: "db3.customLink.disabledHelp" },
    Permanent: { labelKey: "db3.customLink.permanent", descriptionKey: "db3.customLink.permanentHelp" },
    Temporary: { labelKey: "db3.customLink.temporary", descriptionKey: "db3.customLink.temporaryHelp" },
    Client: { labelKey: "db3.customLink.client", descriptionKey: "db3.customLink.clientHelp" },
    IntermediatePage: { labelKey: "db3.customLink.intermediate", descriptionKey: "db3.customLink.intermediateHelp" },
    ServeFile: { labelKey: "db3.customLink.serveFile", descriptionKey: "db3.customLink.serveFileHelp" },
};

// DB3 passes the editor's generic row model to this feature specific save path.
const prepareCustomLinkForSave = (row: TAnyModel): TAnyModel | string => {
    if (row.redirectType === db3.CustomLinkRedirectType.ServeFile) {
        if (!row.fileId || row.file?.isDeleted || row.file?.externalURI) {
            return "Choose an uploaded file to serve at this slug.";
        }
        return { ...row, destinationURL: null, forwardQuery: false };
    }
    if (row.redirectType === db3.CustomLinkRedirectType.Disabled) {
        return row;
    }
    if (!row.destinationURL) {
        return "Enter an external URL for this link.";
    }
    return { ...row, fileId: null, file: null };
};

const usesFileTarget = (row: TAnyModel): boolean => row.redirectType === db3.CustomLinkRedirectType.ServeFile
    || (row.redirectType === db3.CustomLinkRedirectType.Disabled && !!row.fileId);

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export interface CustomLinkSlugColumnArgs extends DB3Client.GenericStringColumnArgs {};

export class CustomLinkSlugColumn extends DB3Client.GenericStringColumnClient {
    constructor(args: CustomLinkSlugColumnArgs) {
        super({
            cellWidth: 250,
            columnName: args.columnName,
            fieldCaptionKey: args.fieldCaptionKey,
            fieldDescriptionKey: args.fieldDescriptionKey,
        });
    }

    renderForNewDialog = (params: DB3Client.RenderForNewItemDialogArgs) => this.defaultRenderer({
        validationResult: params.validationResult,
        isReadOnly: false,
        value: <div className='CustomLinkSlugColumnValue'>
            <CMTextInputBase
                aria-label={this.fieldCaption}
                onChange={(e, val) => params.api.setFieldValues({ [this.columnName]: val })}
                autoFocus={params.autoFocus}
                value={typeof params.value === "string" ? params.value : ""}
                className={this.className}
            />
            {typeof params.value === "string" && params.value && <div className='preview'><CustomLinkUrlPreview slug={params.value} /></div>}
        </div>
    });
};





////////////////////////////////////////////////////////////////////////////////////////////////////////////////
interface CustomLinkItemProps {
    item: db3.CustomLinkListClient;
    client: DB3Client.xTableRenderClient<typeof db3.customLinkListView>;
    commands: DB3Client.CrudViewCommandClient;
    readonly: boolean;
};


export const CustomLinkItem = (props: CustomLinkItemProps) => {
    const { showMessage: showSnackbar } = React.useContext(SnackbarContext);
    const recordFeature = useFeatureRecorder();
    const dashboardContext = useDashboardContext();

    const handleSave = (obj: TAnyModel, api: DB3EditRowButtonAPI) => {
        const prepared = prepareCustomLinkForSave(obj);
        if (typeof prepared === "string") {
            showSnackbar({ severity: "error", children: prepared });
            return;
        }
        void recordFeature({
            feature: ActivityFeature.custom_link_update,
            customLinkId: props.item.publicId,
            context: `CustomLinkItem`,
        });
        props.commands.update(prepared, props.item).then(() => {
            showSnackbar({ severity: "success", children: "success" });
            api.closeDialog();
        }).catch(e => {
            console.log(e);
            showSnackbar({ severity: "error", children: "error" });
        });
    };

    const handleDelete = (api: DB3EditRowButtonAPI) => {
        void recordFeature({
            feature: ActivityFeature.custom_link_delete,
            customLinkId: props.item.publicId,
            context: `CustomLinkItem`,
        });
        props.commands.delete(props.item.publicId).then(() => {
            showSnackbar({ children: "delete successful", severity: 'success' });
            api.closeDialog();
        }).catch(err => {
            console.log(err);
            showSnackbar({ children: "delete error", severity: 'error' });
        });
    }

    // The DB3 enum validates persisted redirect types before they reach this view.
    const redirectType = props.item.redirectType as keyof typeof db3.CustomLinkRedirectType;

    // Optional view members represent fields omitted by authorization. Keep
    // those values absent rather than inventing a legacy display/copy fallback.
    const bandPublicId = dashboardContext.memberPresentation.bandPublicId;
    const absoluteLocalURL = props.item.slug === undefined || !bandPublicId
        ? undefined
        : dashboardContext.getAbsoluteUri(customLinkHref(props.item.slug, bandPublicId, dashboardContext.portalHosting));
    const destinationURL = props.item.destinationURL;

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
                    {redirectType === db3.CustomLinkRedirectType.ServeFile ? "Serve uploaded file" : props.item.redirectType}
                </CMChip>
                {!usesFileTarget(props.item) && <CMChip
                    color={props.item.forwardQuery ? gLightSwatchColors.light_green : gLightSwatchColors.light_gold}
                >
                    {props.item.forwardQuery ? "Query forwarding enabled" : "Query forwarding disabled"}
                </CMChip>}
            </CMChipContainer>

            <div className='subtitleLine'>Visited {props.item._count.visits} times</div>
            <div className='subtitleLine'>Created by {props.item.createdByUser?.name} on {props.item.createdAt.toDateString()}</div>

            <Markdown markdown={props.item.description ?? null} />

            <NameValuePair
                isReadOnly={props.readonly}
                name="Slug"
                value={<div className="customURLslugValueRow">
                    <div>{absoluteLocalURL}</div>
                    <div className="flex-spacer"></div>
                    {absoluteLocalURL !== undefined && <Tooltip title={"Copy URL to clipboard. Useful for testing."}>
                        <div><CMSmallButton onClick={() => { void clipboardCopy(absoluteLocalURL) }} >{gIconMap.ContentCopy()}</CMSmallButton></div>
                    </Tooltip>}
                </div>}
            />

            {usesFileTarget(props.item) && <NameValuePair
                isReadOnly={props.readonly}
                name="Uploaded file"
                value={props.item.file?.fileLeafName ?? "No file selected"}
            />}

            {destinationURL && <NameValuePair
                isReadOnly={props.readonly}
                name="External URL"
                value={<div className="customURLslugValueRow">
                    <div>{destinationURL}</div>
                    <div className="flex-spacer"></div>
                    {typeof destinationURL === "string" && <Tooltip title={"Copy URL to clipboard."}>
                        <div><CMSmallButton onClick={() => { void clipboardCopy(destinationURL) }} >{gIconMap.ContentCopy()}</CMSmallButton></div>
                    </Tooltip>}
                </div>}
            />}

            {redirectType === "IntermediatePage" &&
                <Markdown markdown={props.item.intermediateMessage ?? null} />}

        </div>
    </div>;
}

export const CustomLinkList = () => {
    const dashboardContext = useDashboardContext();
    const recordFeature = useFeatureRecorder();
    const { showMessage: showSnackbar } = React.useContext(SnackbarContext);

    const locale = useLocale();
    const getItemInfo = (option: { value: string, label: string }): DB3Client.ConstEnumStringFieldClientItemInfo => {
        if (option.value === gNullValue) {
            return {};
        }
        const text = Object.entries(redirectTypeText).find(([value]) => value === option.value)?.[1];
        if (!text) {
            throw new Error(`Unknown Custom Link behavior: ${option.value}`);
        }
        return {
            color: gRedirectTypeColorMap[option.value],
            label: locale.getPlainString(text.labelKey),
            descriptionKey: text.descriptionKey,
        };
    };

    const tableSpec = DB3Client.defineTableClientSpec({
        view: db3.customLinkListView,
        columns: {
            publicId: DB3Client.publicIdFieldGen(),
            name: columnName => new DB3Client.GenericStringColumnClient({ fieldDescriptionKey: null, columnName, cellWidth: 250, fieldCaptionKey: "db3.fields.name" }),
            description: columnName => new DB3Client.MarkdownStringColumnClient({ fieldDescriptionKey: null, fieldCaptionKey: "db3.fields.description", columnName, cellWidth: 250, visible: true }), // required field but it's distracting to see here.
            slug: columnName => new CustomLinkSlugColumn({ fieldDescriptionKey: null, columnName, fieldCaptionKey: "db3.fields.slug" }),
            redirectType: columnName => {
                const column = new DB3Client.ConstEnumStringFieldClient({
                    columnName,
                    cellWidth: 250,
                    fieldCaptionKey: "db3.fields.linkBehavior",
                    fieldDescriptionKey: "customLink.redirectType.DescriptionMarkdown",
                    getItemInfo,
                });
                const render = column.renderForNewDialog;
                column.renderForNewDialog = params => <>
                    {render(params)}
                    {params.row.redirectType === db3.CustomLinkRedirectType.ServeFile && <Typography variant="body2" color="text.secondary">
                        The file is served at this slug using its existing permissions. HTML runs on this site's origin.
                    </Typography>}
                </>;
                return column;
            },
            destinationURL: columnName => {
                const column = new DB3Client.GenericStringColumnClient({ fieldDescriptionKey: null, columnName, cellWidth: 250, fieldCaptionKey: "db3.fields.externalUrl" });
                const render = column.renderForNewDialog;
                column.renderForNewDialog = params => usesFileTarget(params.row) ? <></> : render(params);
                return column;
            },
            file: columnName => {
                const column = new DB3Client.ForeignSingleFieldClient<NonNullable<db3.CustomLinkListClient["file"]>>({ fieldDescriptionKey: null,
                    columnName,
                    cellWidth: 250,
                    fieldCaptionKey: "db3.fields.uploadedFile",
                    selectionView: db3.customLinkFileSelectionView,
                });
                const render = column.renderForNewDialog;
                column.renderForNewDialog = params => usesFileTarget(params.row) ? render(params) : <></>;
                return column;
            },
            intermediateMessage: columnName => {
                const column = new DB3Client.MarkdownStringColumnClient({ fieldDescriptionKey: null, fieldCaptionKey: "db3.fields.intermediateMessage", columnName, cellWidth: 250, visible: true });
                const render = column.renderForNewDialog;
                column.renderForNewDialog = params => params.row.redirectType === db3.CustomLinkRedirectType.IntermediatePage ? render(params) : <></>;
                return column;
            },
            forwardQuery: columnName => {
                const column = new DB3Client.BoolColumnClient({ fieldDescriptionKey: null, columnName, fieldCaptionKey: "db3.fields.forwardQuery" });
                const render = column.renderForNewDialog;
                column.renderForNewDialog = params => usesFileTarget(params.row) ? <></> : render(params);
                return column;
            },
        },
    });
    const client = DB3Client.useTableRenderContext({
        requestedCaps: DB3Client.xTableClientCaps.Query,
        referenceProvider: dashboardContext.referenceStore,
        tableSpec,
    });
    const commands = DB3Client.useCrudViewCommands({
        view: db3.customLinkEditorView,
        tableClient: client,
    });

    const canEdit = dashboardContext.isAuthorized(Permission.manage_custom_links);

    const newObj = db3.xCustomLink.createNew(dashboardContext.currentUser);

    const handleSaveNew = (obj: TAnyModel, api: DB3EditRowButtonAPI) => {
        const prepared = prepareCustomLinkForSave(obj);
        if (typeof prepared === "string") {
            showSnackbar({ severity: "error", children: prepared });
            return;
        }
        void recordFeature({
            feature: ActivityFeature.custom_link_create,
            context: `CustomLinkList`,
        });
        commands.create(prepared).then(() => {
            showSnackbar({ severity: "success", children: "success" });
            api.closeDialog();
        }).catch(e => {
            console.log(e);
            showSnackbar({ severity: "error", children: "error" });
        });

    };

    const items = client.items;

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
                {items.map(i => <CustomLinkItem
                    key={i.publicId}
                    item={i}
                    client={client}
                    commands={commands}
                    readonly={!canEdit}
                />)}
            </div>
        </AppContextMarker>
    </div>;
};


