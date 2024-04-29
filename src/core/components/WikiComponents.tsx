
import { useMutation } from "@blitzjs/rpc";
import { Button, Tab, Tabs } from "@mui/material";
import React from "react";
import { Permission } from "shared/permissions";
import { unslugify } from "shared/rootroot";
import { useAuthorization } from "src/auth/hooks/useAuthorization";
import { SnackbarContext } from "src/core/components/SnackbarContext";
import * as db3 from "src/core/db3/db3";
import { API } from "../db3/clientAPI";
import { gIconMap } from "../db3/components/IconSelectDialog";
import updateWikiPage from "../db3/mutations/updateWikiPage";
import { CustomTabPanel, TabA11yProps } from "./CMCoreComponents";
import { NameValuePair } from "./CMCoreComponents2";
import { CMTextInputBase } from "./CMTextField";
import { Markdown, MarkdownEditor } from "./RichTextEditor";
import { VisibilityControl, VisibilityControlValue, VisibilityValue } from "./VisibilityControl";






//////////////////////////////////////////////////
interface WikiPageContentEditorValues {
    name: string,
    content: string;
    visibilityPermission: VisibilityControlValue;
};
interface WikiPageContentEditorProps {
    onSave: (value: WikiPageContentEditorValues) => Promise<boolean>;
    onCancel: () => void;
    onClose: () => void;
    initialValue: WikiPageContentEditorValues;
};


export const WikiPageContentEditor = (props: WikiPageContentEditorProps) => {
    const [name, setName] = React.useState<string>(props.initialValue.name);
    const [content, setContent] = React.useState<string>(props.initialValue.content);
    const [visibility, setVisibility] = React.useState<VisibilityControlValue>(props.initialValue.visibilityPermission);
    const [tab, setTab] = React.useState(0);

    const handleChangeTab = (event: React.SyntheticEvent, newValue: number) => {
        setTab(newValue);
    };

    const handleSave = async () => {
        const success = await props.onSave({
            content,
            name,
            visibilityPermission: visibility,
        });
        return success;
    };

    const handleSaveAndClose = async () => {
        const success = await handleSave();
        if (!success) return;
        props.onClose();
    };

    const handleVisibilityChange = (v: VisibilityControlValue) => {
        setVisibility(v);
    };

    const hasEdits = (props.initialValue.name !== name) || (content !== props.initialValue.content) || (visibility?.id !== props.initialValue.visibilityPermission?.id);

    return <>
        <div className="header">
            <Button onClick={props.onCancel}>{gIconMap.Cancel()}{hasEdits ? "Cancel" : "Close editor"}</Button>
            {hasEdits && <Button onClick={async () => { await handleSave() }} >{gIconMap.Save()} Save</Button>}
            {hasEdits && <Button onClick={async () => { await handleSaveAndClose() }}>{gIconMap.Done()} save & close</Button>}
        </div>
        <div className="content">

            <VisibilityControl onChange={handleVisibilityChange} value={visibility} />

            <NameValuePair
                name="Title"
                value={
                    <CMTextInputBase onChange={(e, v) => setName(v)} value={name} className="wikiTitle" />
                }
            />

            <div className="wikiMarkdownEditorContainer">

                <Tabs
                    value={tab}
                    onChange={handleChangeTab}
                    variant="scrollable"
                    scrollButtons="auto"
                >
                    <Tab label="Edit" {...TabA11yProps("wikiEdit", 0)} />
                    <Tab label="Preview" {...TabA11yProps("wikiEdit", 1)} />
                </Tabs>

                <CustomTabPanel tabPanelID='wikiEdit' value={tab} index={0}>
                    <div className='tabContent editTab'>
                        <MarkdownEditor onValueChanged={(v) => setContent(v)} value={content} autoFocus={true} />
                    </div>
                </CustomTabPanel>

                <CustomTabPanel tabPanelID='wikiEdit' value={tab} index={1}>
                    <div className='tabContent previewTab'>
                        <Markdown markdown={content} />
                    </div>
                </CustomTabPanel>

            </div>
        </div>

    </>;
};



//////////////////////////////////////////////////
interface WikiPageViewModeProps {
    value: db3.WikiPageRevisionPayload;
    slug: string;
    onEnterEditMode: () => void;
};
export const WikiPageViewMode = ({ value, ...props }: WikiPageViewModeProps) => {
    const authorizedForEdit = useAuthorization("WikiPageControl", Permission.edit_wiki_pages);
    const isExisting = value.id > 0;

    return <>
        <div className="header">
            <div className="flex-spacer"></div>
            {isExisting && authorizedForEdit && <Button onClick={() => props.onEnterEditMode()}>{gIconMap.Edit()} Edit</Button>}
            {!isExisting && authorizedForEdit && <Button onClick={() => props.onEnterEditMode()}>{gIconMap.AutoAwesome()} Create</Button>}
            <VisibilityValue permission={value.wikiPage.visiblePermission as any} variant="minimal" />
        </div>
        <div className="content">
            <div className="wikiTitle">
                {value.name}
            </div>

            <div className="wikiContentContainer">
                {value.content ? <Markdown markdown={value.content} /> : <div className="unknownPage">This page dosen't exist (yet!)</div>}
            </div>

            <div className="wikiPageFooterStats">
                Last edited by {value.createdByUser?.name || "(unknown)"} on {value.createdAt.toLocaleDateString()} at {value.createdAt.toLocaleTimeString()}
            </div>
        </div>
    </>;
};



//////////////////////////////////////////////////
interface WikiPageControlProps {
    value: db3.WikiPageRevisionPayload | null;
    slug: string;
    onUpdated: () => void;
};
export const WikiPageControl = (props: WikiPageControlProps) => {

    const [editing, setEditing] = React.useState<boolean>(false);
    const [updateWikiPageMutation, updateWikiPageMutationExtra] = useMutation(updateWikiPage);
    //const dashboardContext = React.useContext(DashboardContext);
    const { showMessage: showSnackbar } = React.useContext(SnackbarContext);
    const defaultVisibilityPerm = API.users.getDefaultVisibilityPermission();

    let valueN: null | db3.WikiPageRevisionPayload = props.value;
    if (!props.value) {
        valueN = {
            content: "",
            createdAt: new Date(),
            createdByUser: null,
            createdByUserId: null,
            id: -1,
            name: unslugify(props.slug),
            wikiPageId: -1,
            wikiPage: {
                slug: props.slug,
                visiblePermissionId: defaultVisibilityPerm.id,
                visiblePermission: defaultVisibilityPerm,
                //visiblePermissionId: API.users.getDefaultVisibilityPermission().id,
                id: -1,
            }
        };
    }
    let value = valueN!;

    const handleSave = async (value: WikiPageContentEditorValues) => {
        try {
            const x = await updateWikiPageMutation({
                slug: props.slug,
                content: value.content,
                name: value.name,
                visiblePermissionId: value.visibilityPermission?.id,
            });
            showSnackbar({ severity: "success", children: "success" });
            props.onUpdated();
            return true;
        } catch (e) {
            showSnackbar({ severity: "error", children: "error" });
            return false;
        }
    };

    return <div className="wikiPage contentSection">

        {editing ? <WikiPageContentEditor
            initialValue={{
                content: value.content,
                name: value.name,
                visibilityPermission: value.wikiPage.visiblePermission as any,
            }}
            onSave={handleSave}
            onCancel={() => setEditing(false)}
            onClose={() => setEditing(false)}
        /> :
            <WikiPageViewMode onEnterEditMode={() => setEditing(true)} slug={props.slug} value={value} />}
    </div>;
};
