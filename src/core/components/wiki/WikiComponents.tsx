
import { useMutation } from "@blitzjs/rpc";
import { History, LockOpen } from "@mui/icons-material";
import { Button, ListItemIcon, MenuItem } from "@mui/material";
import { useRouter } from "next/router";
import React from "react";
import { Permission } from "shared/permissions";
import { IsNullOrWhitespace } from "shared/utils";
import { useSnackbar } from "src/core/components/SnackbarContext";
import { getAbsoluteUrl } from "../../db3/clientAPILL";
import { gIconMap } from "../../db3/components/IconMap";
import * as db3 from "../../db3/db3";
import * as DB3Client from "../../db3/DB3Client";
import wikiPageSetVisibility from "../../wiki/mutations/wikiPageSetVisibility";
import { getFileUploadContext, UpdateWikiPageResultOutcome, WikiPath } from "../../wiki/shared/wikiUtils";
import { EventTextLink } from "../CMCoreComponents";
import { AdminContainer, AdminInspectObject, DotMenu, KeyValueTable, NameValuePair } from "../CMCoreComponents2";
import { CMMultiSelect, CMSelectDisplayStyle, CMSingleSelect } from "../select/CMSelect";
import { CMSelectNullBehavior } from "../select/CMSingleSelectDialog";
import { CMTextInputBase } from "../CMTextField";
import { DashboardContext, useClientTelemetryEvent, useDashboardContext, useFeatureRecorder } from "../DashboardContext";
import { ActivityFeature } from "../featureReports/activityTracking";
import { Markdown } from "../markdown/Markdown";
import { Markdown3Editor } from "../markdown/MarkdownControl3";
import { useWikiPageApi, WikiPageApi } from "../markdown/useWikiPageApi";
import UnsavedChangesHandler from "../UnsavedChangesHandler";
import { VisibilityValue } from "../VisibilityControl";
import { AgeRelativeToNow } from "../DateTime/RelativeTimeComponents";
import { AppContextMarker } from "../AppContext";


//////////////////////////////////////////////////
// - special namespaces like "EventDescription" don't allow changing titles; they are auto-generated.
// - otherwise the title comes from the database field.
// - otherwise the title comes from the slug.
interface WikiTitleControlProps {
    wikiPageApi: WikiPageApi,
    isEditing: boolean;
    potentiallyEditedTitle: string;
    onChange?: (v: string) => void;
};

const WikiTitleViewer = (props: WikiTitleControlProps) => {
    return <a
        href={getAbsoluteUrl(props.wikiPageApi.wikiPath.uriRelativeToHost)}
        rel="noreferrer">
        <span className="WikiTitleView">
            {props.potentiallyEditedTitle}
        </span>
    </a>;
};

const WikiTitleEditor = (props: WikiTitleControlProps) => {
    return <CMTextInputBase onChange={(e, v) => {
        props.onChange!(v);
    }} value={props.potentiallyEditedTitle} className="wikiTitle" />;
};

const WikiTitleControl = (props: WikiTitleControlProps) => {
    const titleIsEditable = props.wikiPageApi.currentPageData ? props.wikiPageApi.currentPageData.titleIsEditable : true;
    return props.isEditing && titleIsEditable ? <WikiTitleEditor {...props} /> : <WikiTitleViewer {...props} />;
};




//////////////////////////////////////////////////
interface WikiPageTagsControlProps {
    wikiPageApi: WikiPageApi,
    readonly: boolean;
    refetch?: () => void; // optional callback to call after updating tags
};

export const WikiPageTagsControl = (props: WikiPageTagsControlProps) => {
    const dashboardContext = useDashboardContext();
    const snackbar = useSnackbar();
    const featureRecorder = useClientTelemetryEvent();
    const wikiPageId = props.wikiPageApi.currentPageData?.wikiPage?.id
    if (!wikiPageId) return null;

    const tableClient = DB3Client.useTableRenderContext<db3.WikiPagePayload>({
        clientIntention: dashboardContext.userClientIntention,
        requestedCaps: DB3Client.xTableClientCaps.Query | DB3Client.xTableClientCaps.Mutation,
        tableSpec: new DB3Client.xTableClientSpec({
            table: db3.xWikiPage,
            columns: [
                new DB3Client.TagsFieldClient<db3.WikiPageTagAssignmentPayload>({ columnName: "tags", cellWidth: 150, allowDeleteFromCell: false, fieldCaption: "Tags" }),
            ],
        }),
        filterModel: {
            items: [],
            pks: [wikiPageId],
        }
    });

    const wikiPageRecord = tableClient.items[0];
    if (!wikiPageRecord) return null;
    const tagsCollection = wikiPageRecord.tags.map(t => t.tag);

    return <CMMultiSelect
        className="noSelectedOutline"
        value={tagsCollection}
        readonly={props.readonly}
        displayStyle={CMSelectDisplayStyle.SelectedWithDialog}
        getOptionInfo={(tag) => ({
            id: tag.id,
            color: tag.color,
            name: tag.text,
            tooltip: tag.description,
        })}
        getOptions={() => dashboardContext.wikiPageTag.items}
        renderOption={tag => tag.text}
        onChange={async (newTags) => {
            await snackbar.invokeAsync(async () => {
                void featureRecorder({
                    feature: ActivityFeature.wiki_page_tag_update,
                    context: "WikiPageTagsControl",
                });
                await tableClient.doUpdateMutation({
                    id: wikiPageId,
                    tags: newTags.map(t => ({
                        id: -1,
                        tagId: t.id,
                        tag: t,
                        wikiPageId: wikiPageId,
                    })) satisfies db3.WikiPageTagAssignmentPayload[],
                });
                if (props.refetch) props.refetch();
            });
        }}
    />;
};


// //////////////////////////////////////////////////
interface WikiPageContentEditorProps {
    onClose: () => void;
    wikiPageApi: WikiPageApi,
    showNamespace?: boolean;
    showVisiblePermission?: boolean;
    showTitle?: boolean;
    showTags?: boolean;
};


export const WikiPageContentEditor = ({ showNamespace = true, showVisiblePermission = true, showTitle = true, showTags = true, ...props }: WikiPageContentEditorProps) => {
    const [title, setTitle] = React.useState<string>(props.wikiPageApi.coalescedCurrentPageData.title);
    const [content, setContent] = React.useState<string>(props.wikiPageApi.coalescedCurrentPageData.content);
    const snackbar = useSnackbar();

    const handleSave = async () => {
        //console.log(`Saving wiki page ${props.wikiPageApi.wikiPath.canonicalWikiPath} with title ${title} and content ${content}`);
        const result = await props.wikiPageApi.saveProgress({
            revisionData: {
                content,
                name: title,
            }
        });
        //console.log(` => outcome ${result.outcome}`);
        //console.log(result);
        switch (result.outcome) {
            case UpdateWikiPageResultOutcome.success:
                return true;
            case UpdateWikiPageResultOutcome.lockConflict:
                snackbar.showError("Unable to save: page is locked by another user");
                break;
            case UpdateWikiPageResultOutcome.revisionConflict:
                snackbar.showError("Unable to save: page has been updated since you loaded it");
                break;
            default:
                snackbar.showError("Unable to save: unknown error");
                break;
        }
        return true;
    };

    const handleSaveAndClose = async () => {
        const success = await handleSave();
        if (!success) return;
        props.onClose();
    };

    // while you're active, auto-renew your edit lock
    React.useEffect(() => {
        props.wikiPageApi.renewYourLockThrottled();
    }, [title, content]);

    const titleChanged = title !== props.wikiPageApi.coalescedCurrentPageData.title;
    const contentChanged = content !== props.wikiPageApi.coalescedCurrentPageData.content;
    const hasEdits = titleChanged || contentChanged;

    return <>
        <WikiPageHeader readonly={true} wikiPageApi={props.wikiPageApi} onEnterEditMode={() => { }} showNamespace={showNamespace} showVisiblePermission={showVisiblePermission} />

        <div className="content">
            <UnsavedChangesHandler isDirty={hasEdits} />

            {showTitle &&
                <NameValuePair
                    name="Title"
                    value={
                        <WikiTitleControl isEditing={true} onChange={setTitle} potentiallyEditedTitle={title} wikiPageApi={props.wikiPageApi} />
                    }
                />}

            {showTags &&
                <NameValuePair
                    name="Tags"
                    value={
                        <WikiPageTagsControl readonly={false} wikiPageApi={props.wikiPageApi} refetch={props.wikiPageApi.refetch} />
                    }
                />}

            <div className="wikiMarkdownEditorContainer">

                <div className='tabContent editTab'>
                    <Markdown3Editor
                        wikiPageApi={props.wikiPageApi}
                        onChange={(v) => setContent(v)}
                        value={content}
                        autoFocus={true}
                        nominalHeight={600}
                        showActionButtons={true}
                        hasEdits={hasEdits}
                        handleCancel={props.onClose}
                        handleSave={handleSave}
                        handleSaveAndClose={handleSaveAndClose}
                        uploadFileContext={getFileUploadContext(props.wikiPageApi.basePage?.id, props.wikiPageApi.wikiPath)}
                    />
                </div>

            </div>

        </div>

    </>;
};

//////////////////////////////////////////////////
interface WikiPageVisibilityControlProps {
    wikiPageApi: WikiPageApi,
    readonly: boolean;
    onUpdateComplete: () => void;
};
const WikiPageVisibilityControl = (props: WikiPageVisibilityControlProps) => {
    const dashboardContext = useDashboardContext();
    const snackbar = useSnackbar();
    const [wikiPageSetVisibilityMutation] = useMutation(wikiPageSetVisibility);
    const recordFeature = useFeatureRecorder();

    return <CMSingleSelect<number | null>
        displayStyle={CMSelectDisplayStyle.SelectedWithDialog}
        renderOption={(v) => {
            return <VisibilityValue permissionId={v} variant="verbose" />;
        }}
        renderNullOption={() => <VisibilityValue permissionId={null} variant="verbose" />}
        value={props.wikiPageApi.coalescedCurrentPageData.visiblePermissionId}
        nullBehavior={CMSelectNullBehavior.AllowNull}
        onChange={async (v) => {
            void recordFeature({
                feature: ActivityFeature.wiki_change_visibility,
                wikiPageId: props.wikiPageApi.currentPageData?.wikiPage?.id,
            });
            await snackbar.invokeAsync(async () => {
                await wikiPageSetVisibilityMutation({
                    canonicalWikiPath: props.wikiPageApi.wikiPath.canonicalWikiPath,
                    visiblePermissionId: v,
                })
            }, "Visibility updated");
            props.onUpdateComplete();
        }}
        getOptions={() => dashboardContext.getVisibilityPermissions().map(p => p.id)}
        getOptionInfo={(permissionId: number) => {
            return {
                id: permissionId,
                name: `pid:${permissionId}`,
            }
        }}
    />;
};

//////////////////////////////////////////////////
interface WikiPageViewModeProps {
    readonly: boolean;
    showNamespace?: boolean;
    showVisiblePermission?: boolean;
    onEnterEditMode: () => void;
    wikiPageApi: WikiPageApi,
    renderCreateButton?: (onClick: () => void) => React.ReactNode;
};
//////////////////////////////////////////////////
export const WikiPageHeader = ({ showNamespace = true, showVisiblePermission = true, ...props }: WikiPageViewModeProps) => {
    const dashboardContext = React.useContext(DashboardContext);
    const authorizedForEdit = !props.readonly && dashboardContext.isAuthorized(Permission.edit_wiki_pages);
    const snackbar = useSnackbar();
    const router = useRouter();
    const endMenuItemRef = React.useRef<() => void>(() => { });

    const pageData = props.wikiPageApi.currentPageData;

    const pageExists = !!(pageData?.isExisting && pageData.wikiPage?.currentRevision);
    const showEditButton = authorizedForEdit && pageExists;
    const showCreateButton = authorizedForEdit && !pageExists;

    const renderCreateButton = props.renderCreateButton || ((onClick) => <Button onClick={onClick}>{gIconMap.AutoAwesome()} Create this page</Button>);

    const menuItems = [
        showVisiblePermission &&
        <MenuItem key={"vis"}>
            <WikiPageVisibilityControl readonly={props.readonly} wikiPageApi={props.wikiPageApi} onUpdateComplete={() => {
                props.wikiPageApi.refetch();
                endMenuItemRef.current();
            }} />
        </MenuItem>,
        pageExists && dashboardContext.isAuthorized(Permission.view_wiki_page_revisions) &&
        <MenuItem key={"copylink"} onClick={async () => {
            await snackbar.invokeAsync(async () => navigator.clipboard.writeText(getAbsoluteUrl(props.wikiPageApi.wikiPath.uriRelativeToHost)), "Copied link to clipboard");
            endMenuItemRef.current();
        }}>
            <ListItemIcon>
                {gIconMap.Share()}
            </ListItemIcon>
            Copy link to wiki page
        </MenuItem>,
        pageExists && dashboardContext.isAuthorized(Permission.view_wiki_page_revisions) &&
        <MenuItem key={"viewhistory"} onClick={async () => {
            void router.push(`/backstage/wikiPageHistory?path=${props.wikiPageApi.wikiPath.canonicalWikiPath}`);
            endMenuItemRef.current();
        }}>
            <ListItemIcon>
                <History />
            </ListItemIcon>
            View revision history
        </MenuItem>,
        props.wikiPageApi.lockStatus.isLockedInThisContext &&
        <MenuItem key={"releaselock"} onClick={async () => {
            await snackbar.invokeAsync(async () => props.wikiPageApi.releaseYourLock(), "Lock cleared");
            endMenuItemRef.current();
        }}>
            <ListItemIcon>
                {<LockOpen />}
            </ListItemIcon>
            Clear your lock
        </MenuItem>
        ,
        dashboardContext.isAuthorized(Permission.admin_wiki_pages) && props.wikiPageApi.lockStatus.isLocked &&
        <MenuItem key={"releaselockadmin"} onClick={async () => {
            await snackbar.invokeAsync(async () => props.wikiPageApi.adminClearLock(), "Lock cleared");
            endMenuItemRef.current();
        }}>
            <ListItemIcon>
                {<LockOpen />}
            </ListItemIcon>
            Clear Lock (admin)
        </MenuItem>

    ];

    return <div className="header">
        {showNamespace && !IsNullOrWhitespace(props.wikiPageApi.wikiPath.namespace) &&
            <div className="wikiNamespace">
                <span>{props.wikiPageApi.wikiPath.namespace}/</span>
            </div>
        }
        {showCreateButton && renderCreateButton(() => props.onEnterEditMode())}

        <div className="flex-spacer">&nbsp;</div>

        {showEditButton && <Button onClick={() => props.onEnterEditMode()}>{gIconMap.Edit()} Edit</Button>}

        {/* only show if the page is created, because otherwise the permission id is always null and this value is meaningless. */}
        {!showCreateButton && showVisiblePermission &&
            <VisibilityValue permissionId={pageData?.wikiPage?.visiblePermissionId} variant="minimal" />
        }

        {menuItems.some(m => !!m) &&
            <DotMenu setCloseMenuProc={(proc) => endMenuItemRef.current = proc}>
                {menuItems}
            </DotMenu>
        }
    </div>
};

export const WikiPageViewMode = (props: WikiPageViewModeProps) => {
    const pageData = props.wikiPageApi.currentPageData;
    const page = pageData?.wikiPage;

    return <>
        <WikiPageHeader {...props} />
        <div className="content">
            <div className="wikiTitle">
                <WikiTitleControl wikiPageApi={props.wikiPageApi} isEditing={false} potentiallyEditedTitle={props.wikiPageApi.coalescedCurrentPageData.title} />
                <WikiPageTagsControl wikiPageApi={props.wikiPageApi} readonly={true} refetch={props.wikiPageApi.refetch} />

                {pageData?.specialWikiNamespace === "EventDescription" && <div className="wikiPageSpecialNamespaceSubtitle wikiPageEventDescription">
                    This is the description for <EventTextLink event={pageData.eventContext!} />
                </div>}
            </div>

            <div className="wikiContentContainer">
                {IsNullOrWhitespace(props.wikiPageApi.coalescedCurrentPageData.content) ? <div className="unknownPage">This page dosen't exist (yet!)</div> : <Markdown markdown={props.wikiPageApi.coalescedCurrentPageData.content} />}
            </div>

            {page?.currentRevision && <div className="wikiPageFooterStats">
                Last edited by {page.currentRevision.createdByUser?.name || "(unknown)"} on {page.currentRevision.createdAt.toLocaleDateString()} at {page.currentRevision.createdAt.toLocaleTimeString()}
            </div>}
        </div>
    </>;
};

//////////////////////////////////////////////////
export const WikiDebugIndicator = ({ wikiPageApi }: { wikiPageApi: WikiPageApi }) => {
    const page = wikiPageApi.currentPageData?.wikiPage;
    if (!page) return <div className="wikiLockIndicator">no page.</div>;

    return <div className="wikiLockIndicator">
        <KeyValueTable data={{
            "page id": `${wikiPageApi.currentPageData?.wikiPage?.id || "-"} ${wikiPageApi.wikiPath.canonicalWikiPath}`,
            "Page Locked by": page.lockedByUser?.name || "-",
            "Page Lock ID": page.lockId || "-",
            "Page Locked since": page.lockAcquiredAt ? page.lockAcquiredAt.toLocaleString() : "-",
            "Page Lock Expires at": page.lockExpiresAt ? <>{page.lockExpiresAt.toLocaleString()} <AgeRelativeToNow value={page.lockExpiresAt} /></> : "-",
            "Page last edit ping at": page.lastEditPingAt ? <>{page.lastEditPingAt.toLocaleString()} <AgeRelativeToNow value={page.lastEditPingAt} /></> : "-",
            "Your base revision id": wikiPageApi.basePage?.currentRevision?.id || "-",
            "Your lock ID": wikiPageApi.yourLockId || "-",
            "current revision id": wikiPageApi.currentPageData?.wikiPage?.currentRevision?.id || "-",
            "API object": <AdminInspectObject src={wikiPageApi} />,
        }} />
    </div>
};

//////////////////////////////////////////////////
export const WikiLockIndicator = ({ wikiPageApi }: { wikiPageApi: WikiPageApi }) => {
    const page = wikiPageApi.currentPageData?.wikiPage;
    if (!page) return <div className="wikiLockIndicator">no page.</div>;

    return <div className="wikiLockIndicator">
        <KeyValueTable data={{
            "Locked by": page.lockedByUser?.name || "-",
            "Lock ID": page.lockId || "-",
        }} />
    </div>
};

//////////////////////////////////////////////////
interface WikiPageControlProps {
    wikiPath: WikiPath,
};
export const WikiPageControl = (props: WikiPageControlProps) => {
    const [editing, setEditing] = React.useState<boolean>(false);
    const snackbar = useSnackbar();

    const wikiPageApi = useWikiPageApi({
        canonicalWikiPath: props.wikiPath.canonicalWikiPath,
    });

    const handleEnterEditMode = async () => {
        if (editing) return;
        const result = await wikiPageApi.beginEditing();
        switch (result.outcome) {
            case UpdateWikiPageResultOutcome.success:
                setEditing(true);
                break;
            case UpdateWikiPageResultOutcome.lockConflict:
                snackbar.showError("Unable to edit: The article is being edited by another user");
                break;
            case UpdateWikiPageResultOutcome.revisionConflict:
                snackbar.showError("Unable to edit: There is a newer version of the article; please refresh the page.");
                break;
            default:
                snackbar.showError("Unable to edit: unknown error");
                break;
        }
    };

    const handleExitEditMode = async () => {
        if (!editing) return;
        await wikiPageApi.releaseYourLock();
        setEditing(false);
    };

    return <div className="wikiPage contentSection">
        <AppContextMarker wikiPageId={wikiPageApi.currentPageData?.wikiPage?.id}>
            <AdminContainer>
                <WikiDebugIndicator wikiPageApi={wikiPageApi} />
            </AdminContainer>

            {editing ? <WikiPageContentEditor
                wikiPageApi={wikiPageApi}
                onClose={handleExitEditMode}
            /> :
                <WikiPageViewMode
                    onEnterEditMode={handleEnterEditMode}
                    wikiPageApi={wikiPageApi}
                    readonly={false}
                />}
        </AppContextMarker>
    </div>;
};
