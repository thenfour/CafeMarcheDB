
import { useMutation } from "@blitzjs/rpc";
import { LockOpen } from "@mui/icons-material";
import { Button, ListItemIcon, MenuItem } from "@mui/material";
import React from "react";
import { Permission } from "shared/permissions";
import { IsNullOrWhitespace } from "shared/utils";
import { useSnackbar } from "src/core/components/SnackbarContext";
import { getAbsoluteUrl } from "../db3/clientAPILL";
import { gIconMap } from "../db3/components/IconMap";
import wikiPageSetVisibility from "../wiki/mutations/wikiPageSetVisibility";
import { UpdateWikiPageResultOutcome } from "../wiki/server/wikiServerCore";
import { AdminContainer, AdminInspectObject, EventTextLink } from "./CMCoreComponents";
import { DotMenu, KeyValueTable, NameValuePair } from "./CMCoreComponents2";
import { CMSelectDisplayStyle, CMSingleSelect } from "./CMSelect";
import { CMSelectNullBehavior } from "./CMSingleSelectDialog";
import { CMTextInputBase } from "./CMTextField";
import { DashboardContext, useDashboardContext } from "./DashboardContext";
import { Markdown3Editor } from "./markdown/MarkdownControl3";
import { Markdown } from "./markdown/RichTextEditor";
import { WikiPageApi } from "./markdown/useWikiPageApi";
import { AgeRelativeToNow } from "./RelativeTimeComponents";
import UnsavedChangesHandler from "./UnsavedChangesHandler";
import { VisibilityValue } from "./VisibilityControl";


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


// //////////////////////////////////////////////////
interface WikiPageContentEditorProps {
    onClose: () => void;
    wikiPageApi: WikiPageApi,
    showNamespace?: boolean;
    showVisiblePermission?: boolean;
    showTitle?: boolean;
};


export const WikiPageContentEditor = ({ showNamespace = true, showVisiblePermission = true, showTitle = true, ...props }: WikiPageContentEditorProps) => {
    const [title, setTitle] = React.useState<string>(props.wikiPageApi.coalescedCurrentPageData.title);
    const [content, setContent] = React.useState<string>(props.wikiPageApi.coalescedCurrentPageData.content);
    const snackbar = useSnackbar();

    const handleSave = async () => {
        const result = await props.wikiPageApi.saveProgress({
            revisionData: {
                content,
                name: title,
            }
        });
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

    return <CMSingleSelect<number | null>
        displayStyle={CMSelectDisplayStyle.SelectedWithDialog}
        renderOption={(v) => {
            return <VisibilityValue permissionId={v} variant="verbose" />;
        }}
        renderNullOption={() => <VisibilityValue permissionId={null} variant="verbose" />}
        value={props.wikiPageApi.coalescedCurrentPageData.visiblePermissionId}
        nullBehavior={CMSelectNullBehavior.AllowNull}
        onChange={async (v) => {
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
};
//////////////////////////////////////////////////
export const WikiPageHeader = ({ showNamespace = true, showVisiblePermission = true, ...props }: WikiPageViewModeProps) => {
    const dashboardContext = React.useContext(DashboardContext);
    const authorizedForEdit = !props.readonly && dashboardContext.isAuthorized(Permission.edit_wiki_pages);
    const snackbar = useSnackbar();
    const endMenuItemRef = React.useRef<() => void>(() => { });

    const pageData = props.wikiPageApi.currentPageData;

    const showEditButton = authorizedForEdit && pageData?.isExisting;
    const showCreateButton = authorizedForEdit && !(pageData?.isExisting);

    return <div className="header">
        {showNamespace && !IsNullOrWhitespace(props.wikiPageApi.wikiPath.namespace) &&
            <div className="wikiNamespace">
                <span>{props.wikiPageApi.wikiPath.namespace}/</span>
            </div>
        }
        <div className="flex-spacer"></div>
        {showEditButton && <Button onClick={() => props.onEnterEditMode()}>{gIconMap.Edit()} Edit</Button>}
        {showCreateButton && <Button onClick={() => props.onEnterEditMode()}>{gIconMap.AutoAwesome()} Create</Button>}
        <DotMenu setCloseMenuProc={(proc) => endMenuItemRef.current = proc}>
            {showVisiblePermission &&
                <MenuItem>
                    <WikiPageVisibilityControl readonly={props.readonly} wikiPageApi={props.wikiPageApi} onUpdateComplete={() => {
                        props.wikiPageApi.refetch();
                        endMenuItemRef.current();
                    }} />
                </MenuItem>
            }
            <MenuItem onClick={async () => {
                await snackbar.invokeAsync(async () => navigator.clipboard.writeText(getAbsoluteUrl(props.wikiPageApi.wikiPath.uriRelativeToHost)), "Copied link to clipboard");
                endMenuItemRef.current();
            }}>
                <ListItemIcon>
                    {gIconMap.Link()}
                </ListItemIcon>
                Copy Link
            </MenuItem>

            <MenuItem onClick={async () => {
                await snackbar.invokeAsync(async () => props.wikiPageApi.releaseYourLock(), "Lock cleared");
                endMenuItemRef.current();
            }}>
                <ListItemIcon>
                    {<LockOpen />}
                </ListItemIcon>
                Clear your lock
            </MenuItem>

            {dashboardContext.isAuthorized(Permission.admin_wiki_pages) &&
                <MenuItem onClick={async () => {
                    await snackbar.invokeAsync(async () => props.wikiPageApi.adminClearLock(), "Lock cleared");
                    endMenuItemRef.current();
                }}>
                    <ListItemIcon>
                        {<LockOpen />}
                    </ListItemIcon>
                    Clear Lock (admin)
                </MenuItem>
            }
        </DotMenu>
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
    wikiPageApi: WikiPageApi,
};
export const WikiPageControl = (props: WikiPageControlProps) => {
    const [editing, setEditing] = React.useState<boolean>(false);
    const snackbar = useSnackbar();

    const handleEnterEditMode = async () => {
        if (editing) return;
        const result = await props.wikiPageApi.beginEditing();
        switch (result.outcome) {
            case UpdateWikiPageResultOutcome.success:
                setEditing(true);
                break;
            case UpdateWikiPageResultOutcome.lockConflict:
                snackbar.showError("Unable to edit: page is locked by another user");
                break;
            case UpdateWikiPageResultOutcome.revisionConflict:
                snackbar.showError("Unable to edit: page has been updated since you loaded it");
                break;
            default:
                snackbar.showError("Unable to edit: unknown error");
                break;
        }
    };

    const handleExitEditMode = async () => {
        if (!editing) return;
        await props.wikiPageApi.releaseYourLock();
        setEditing(false);
    };

    return <div className="wikiPage contentSection">
        <AdminContainer>
            <WikiDebugIndicator wikiPageApi={props.wikiPageApi} />
        </AdminContainer>

        {editing ? <WikiPageContentEditor
            wikiPageApi={props.wikiPageApi}
            onClose={handleExitEditMode}
        /> :
            <WikiPageViewMode
                onEnterEditMode={handleEnterEditMode}
                wikiPageApi={props.wikiPageApi}
                readonly={false}
            />}
    </div>;
};
