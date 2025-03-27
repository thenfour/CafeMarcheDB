
import React, { Suspense } from "react";
import { IsNullOrWhitespace } from "shared/utils";
import { useSnackbar } from "src/core/components/SnackbarContext";
import { UpdateWikiPageResultOutcome } from "../wiki/server/wikiServerCore";
import { Markdown } from "./markdown/RichTextEditor";
import { useWikiPageApi, WikiPageApi } from "./markdown/useWikiPageApi";
import { WikiDebugIndicator, WikiPageContentEditor, WikiPageHeader } from "./WikiComponents";
import { AdminContainer } from "./CMCoreComponents";

//////////////////////////////////////////////////
interface WikiStandaloneViewModeProps {
    readonly: boolean;
    onEnterEditMode: () => void;
    wikiPageApi: WikiPageApi,
    renderCreateButton?: (onClick: () => void) => React.ReactNode;
};
const WikiStandaloneViewMode = (props: WikiStandaloneViewModeProps) => {
    return <>
        <WikiPageHeader
            onEnterEditMode={props.onEnterEditMode}
            showNamespace={false}
            showVisiblePermission={false}
            readonly={props.readonly}
            wikiPageApi={props.wikiPageApi}
            renderCreateButton={props.renderCreateButton}
        />
        <div className="content">
            <div className="wikiContentContainer">
                {!IsNullOrWhitespace(props.wikiPageApi.coalescedCurrentPageData.content) &&
                    <Markdown markdown={props.wikiPageApi.coalescedCurrentPageData.content} />}
            </div>
        </div>
    </>;
};

// A standalone control to view / edit a wiki page.
interface WikiStandaloneControlProps {
    canonicalWikiPath: string; // with namespace if applicable
    onUpdated?: () => void;
    readonly?: boolean;
    renderCreateButton?: (onClick: () => void) => React.ReactNode;
};

const WikiStandaloneControlInner = (props: WikiStandaloneControlProps) => {
    const snackbar = useSnackbar();
    const [editing, setEditing] = React.useState<boolean>(false);
    const wikiPageApi = useWikiPageApi({ canonicalWikiPath: props.canonicalWikiPath });

    const handleEnterEditMode = async () => {
        if (editing) return;
        const result = await wikiPageApi.beginEditing();
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
        await wikiPageApi.releaseYourLock();
        setEditing(false);
    };

    return <div className="wikiPage standaloneEditor">
        <AdminContainer>
            <WikiDebugIndicator wikiPageApi={wikiPageApi} />
        </AdminContainer>

        {editing ? <WikiPageContentEditor
            wikiPageApi={wikiPageApi}
            onClose={handleExitEditMode}
            showNamespace={false}
            showVisiblePermission={false}
            showTitle={false}
        /> :
            <WikiStandaloneViewMode
                onEnterEditMode={handleEnterEditMode}
                wikiPageApi={wikiPageApi}
                readonly={props.readonly || false}
                renderCreateButton={props.renderCreateButton}
            />}
    </div>;
};

export const WikiStandaloneControl = (props: WikiStandaloneControlProps) => {
    return <Suspense fallback={<div className="lds-dual-ring"></div>}>
        <WikiStandaloneControlInner {...props} />
    </Suspense>;
};

