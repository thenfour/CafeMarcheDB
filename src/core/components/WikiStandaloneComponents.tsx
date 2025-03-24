
import { useMutation, useQuery } from "@blitzjs/rpc";
import { Button, ListItemIcon, MenuItem } from "@mui/material";
import React, { Suspense } from "react";
import { Permission } from "shared/permissions";
import { IsNullOrWhitespace } from "shared/utils";
import { SnackbarContext, useSnackbar } from "src/core/components/SnackbarContext";
import { WikiPageData, wikiParseCanonicalWikiPath, WikiPath } from "src/core/db3/shared/wikiUtils";
import { getAbsoluteUrl } from "../db3/clientAPILL";
import { gIconMap } from "../db3/components/IconMap";
import updateWikiPage from "../db3/mutations/updateWikiPage";
import getWikiPage from "../db3/queries/getWikiPage";
import { DotMenu } from "./CMCoreComponents2";
import { useDashboardContext } from "./DashboardContext";
import { Markdown } from "./markdown/RichTextEditor";
import { Markdown3Editor } from "./MarkdownControl3";
import UnsavedChangesHandler from "./UnsavedChangesHandler";
//import { VisibilityControlValue } from "./VisibilityControl";



//////////////////////////////////////////////////
interface WikiPageContentEditorValues {
    //title: string,
    content: string;
    // visibilityPermissionId: number | null;//: VisibilityControlValue;
};
interface WikiStandaloneContentEditorProps {
    onSave: (value: WikiPageContentEditorValues) => Promise<boolean>;
    onCancel: () => void;
    onClose: () => void;
    initialValue: WikiPageContentEditorValues;
    wikiPageData: WikiPageData,
    wikiPath: WikiPath;
};


export const WikiStandaloneContentEditor = (props: WikiStandaloneContentEditorProps) => {
    //const [title, setTitle] = React.useState<string>(props.initialValue.title);
    const [content, setContent] = React.useState<string>(props.initialValue.content);
    //const [visibilityPermissionId, setVisibilityPermissionId] = React.useState<number | null>(props.initialValue.visibilityPermissionId);

    const handleSave = async () => {
        const success = await props.onSave({
            content,
            //title,
            //visibilityPermissionId,
        });
        return success;
    };

    const handleSaveAndClose = async () => {
        const success = await handleSave();
        if (!success) return;
        props.onClose();
    };

    // const handleVisibilityChange = (v: VisibilityControlValue) => {
    //     setVisibilityPermissionId(v?.id || null);
    // };

    //const hasEdits = (props.initialValue.title !== title) || (content !== props.initialValue.content) || (visibilityPermissionId !== props.initialValue.visibilityPermissionId);
    const hasEdits = (content !== props.initialValue.content);

    return <>
        <div className="content">

            {/* <VisibilityControl onChange={handleVisibilityChange} value={visibilityPermissionId} /> */}
            <UnsavedChangesHandler isDirty={hasEdits} />

            {/* <NameValuePair
                name="Title"
                value={
                    <WikiTitleControl wikiPath={props.wikiPath} wikiPageData={props.wikiPageData} isEditing={true} onChange={setTitle} potentiallyEditedTitle={title} />
                }
            /> */}

            <div className="wikiMarkdownEditorContainer">

                <div className='tabContent editTab'>
                    <Markdown3Editor
                        onChange={(v) => setContent(v)}
                        value={content}
                        autoFocus={true}
                        minHeight={600}
                    />
                </div>

            </div>

            <div className="actionButtonsRow">
                <div className={`freeButton cancelButton`} onClick={props.onCancel}>{hasEdits ? "Cancel" : "Close"}</div>
                <div className={`saveButton saveProgressButton ${hasEdits ? "freeButton changed" : "unchanged"}`} onClick={hasEdits ? async () => { await handleSave() } : undefined}>Save progress</div>
                <div className={`saveButton saveAndCloseButton ${hasEdits ? "freeButton changed" : "unchanged"}`} onClick={hasEdits ? async () => { await handleSaveAndClose() } : undefined}>{gIconMap.CheckCircleOutline()}Save & close</div>
            </div>
        </div>

    </>;
};


//////////////////////////////////////////////////
interface WikiStandaloneViewModeProps {
    onEnterEditMode: () => void;
    wikiPageData: WikiPageData,
    wikiPath: WikiPath,
};
const WikiStandaloneViewMode = (props: WikiStandaloneViewModeProps) => {
    const dashboardContext = useDashboardContext();
    const authorizedForEdit = dashboardContext.isAuthorized(Permission.manage_events);
    const snackbar = useSnackbar();
    const endMenuItemRef = React.useRef<() => void>(() => { });

    return <>
        <div className="header">
            {/* {!IsNullOrWhitespace(props.wikiPath.namespace) &&
                <div className="wikiNamespace">
                    <span>{props.wikiPath.namespace}/</span>
                </div>
            } */}
            <div className="flex-spacer"></div>
            {props.wikiPageData.isExisting && authorizedForEdit && <Button onClick={() => props.onEnterEditMode()}>{gIconMap.Edit()} Edit</Button>}
            {!props.wikiPageData.isExisting && authorizedForEdit && <Button onClick={() => props.onEnterEditMode()}>{gIconMap.AutoAwesome()} Create</Button>}
            {/* <VisibilityValue permissionId={props.wikiPageData.wikiPage.visiblePermissionId} variant="minimal" /> */}
            <DotMenu setCloseMenuProc={(proc) => endMenuItemRef.current = proc}>
                <MenuItem onClick={async () => {
                    await snackbar.invokeAsync(async () => navigator.clipboard.writeText(getAbsoluteUrl(props.wikiPath.uriRelativeToHost)), "Copied link to clipboard");
                    endMenuItemRef.current();
                }}>
                    <ListItemIcon>
                        {gIconMap.Link()}
                    </ListItemIcon>
                    Copy Link to wiki page
                </MenuItem>
            </DotMenu>
        </div>
        <div className="content">
            {/* <div className="wikiTitle">
                <WikiTitleControl wikiPath={props.wikiPath} wikiPageData={props.wikiPageData} isEditing={false} potentiallyEditedTitle={props.wikiPageData.latestRevision.name} />

                {props.wikiPageData.specialWikiNamespace === "EventDescription" && <div className="wikiPageSpecialNamespaceSubtitle wikiPageEventDescription">
                    This is the description for <EventTextLink event={props.wikiPageData.eventContext!} />
                </div>}

            </div>
 */}
            <div className="wikiContentContainer">
                {IsNullOrWhitespace(props.wikiPageData.latestRevision.content) ? <div className="unknownPage">This page dosen't exist (yet!)</div> : <Markdown markdown={props.wikiPageData.latestRevision.content} />}
            </div>

            {/* <div className="wikiPageFooterStats">
                Last edited by {props.wikiPageData.latestRevision.createdByUser?.name || "(unknown)"} on {props.wikiPageData.latestRevision.createdAt.toLocaleDateString()} at {props.wikiPageData.latestRevision.createdAt.toLocaleTimeString()}
            </div> */}
        </div>
    </>;
};







// A standalone control to view / edit a wiki page.
interface WikiStandaloneControlProps {
    canonicalWikiPath: string; // with namespace if applicable
    onUpdated?: () => void;
    readonly?: boolean;
};

const WikiStandaloneControlInner = (props: WikiStandaloneControlProps) => {
    const [editing, setEditing] = React.useState<boolean>(false);
    const [updateWikiPageMutation] = useMutation(updateWikiPage);
    const { showMessage: showSnackbar } = React.useContext(SnackbarContext);
    const wikiPath = wikiParseCanonicalWikiPath(props.canonicalWikiPath);

    const [wikiPageData, wikiPageDataExtra] = useQuery(getWikiPage, {
        slug: props.canonicalWikiPath,
    });

    const handleSave = async (value: WikiPageContentEditorValues) => {
        try {
            const x = await updateWikiPageMutation({
                slug: props.canonicalWikiPath,
                content: value.content,
                name: wikiPageData.latestRevision.name,
                visiblePermissionId: wikiPageData.wikiPage.visiblePermissionId,
            });
            showSnackbar({ severity: "success", children: "success" });
            wikiPageDataExtra.refetch();
            props.onUpdated && props.onUpdated();
            return true;
        } catch (e) {
            showSnackbar({ severity: "error", children: "error" });
            return false;
        }
    };

    return <div className="wikiPage">

        {editing ? <WikiStandaloneContentEditor
            initialValue={{
                content: wikiPageData.latestRevision.content,
                //title: wikiPageData.latestRevision.name,
                //visibilityPermissionId: wikiPageData.wikiPage.visiblePermissionId,
            }}
            onSave={handleSave}
            wikiPageData={wikiPageData}
            wikiPath={wikiPath}
            onCancel={() => setEditing(false)}
            onClose={() => setEditing(false)}
        /> :
            <WikiStandaloneViewMode
                onEnterEditMode={() => setEditing(true)}
                wikiPageData={wikiPageData}
                wikiPath={wikiPath}
            />}
    </div>;
};

export const WikiStandaloneControl = (props: WikiStandaloneControlProps) => {
    return <Suspense fallback={<div className="lds-dual-ring"></div>}>
        <WikiStandaloneControlInner {...props} />
    </Suspense>;
};

