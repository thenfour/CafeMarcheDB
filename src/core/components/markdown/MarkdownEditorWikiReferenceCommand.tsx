import { DialogContent, DialogTitle, InputBase } from "@mui/material";
import React from "react";
import { QuickSearchItemMatch, QuickSearchItemTypeSets } from "shared/quickFilter";
import { IsNullOrWhitespace } from "shared/utils";
import { DialogActionsCM, NameValuePair } from "../CMCoreComponents2";
import { ReactiveInputDialog } from "../ReactiveInputDialog";
import { AssociationAutocomplete } from "../setlistPlan/ItemAssociation";
import { MarkdownWikiLinkRegexWithSurroundingWhitespace } from "./CMDBLinkMarkdownPlugin";
import { MarkdownEditorCommand, MarkdownEditorCommandApi, MarkdownTokenContext } from "./MarkdownEditorCommandBase";
import { GetMatchUnderSelection, MarkdownEditorToolbarItem, MuiButtonWithEnterHandler, parseMarkdownReference } from "./MarkdownEditorCommandUtils";

const kCommandId = "WikiReferenceCommand";

function deduceContext(api: MarkdownEditorCommandApi): undefined | MarkdownTokenContext {
    const ret = GetMatchUnderSelection(
        api.controlledTextArea.getText(),
        api.controlledTextArea.selectionStart,
        api.controlledTextArea.selectionEnd,
        MarkdownWikiLinkRegexWithSurroundingWhitespace,
        { trimSurroundingWhitespace: true }
    );
    return ret;
};

const WikiReferenceDialog: React.FC<{ api: MarkdownEditorCommandApi, invocationTrigger: number }> = (props) => {
    const [open, setOpen] = React.useState(false);

    const [wikiSlugQuery, setWikiSlugQuery] = React.useState<string>("");
    const [wikiTitle, setWikiTitle] = React.useState<string>("");
    const [matchingItem, setMatchingItem] = React.useState<QuickSearchItemMatch | null>(null);

    const text = props.api.controlledTextArea.getText();
    const selectedText = text.slice(props.api.controlledTextArea.selectionStart, props.api.controlledTextArea.selectionEnd);
    const parsed = parseMarkdownReference(selectedText);
    const parsedSlug = (parsed.isReference && parsed.slug) || selectedText;
    const parsedCaption = parsed.isReference ? parsed.caption : "";

    React.useEffect(() => {
        setWikiSlugQuery(parsedSlug);
    }, [parsedSlug]);

    React.useEffect(() => {
        setWikiTitle(parsedCaption);
    }, [parsedCaption]);

    let verified = false;
    if (matchingItem) {
        if (matchingItem.canonicalWikiSlug === wikiSlugQuery) {
            verified = true;
        }
    }

    const closeDialog = () => {
        setOpen(false);
        setTimeout(() => {
            props.api.textArea.focus();
        }, 0);
    };

    const invoke = async () => {
        const context = deduceContext(props.api);
        if (context) {
            await props.api.controlledTextArea.setSelectionRange(context.start, context.end);
        }
        setOpen(true);
    };

    const handleOK = async () => {
        if (!IsNullOrWhitespace(wikiSlugQuery)) {
            if (IsNullOrWhitespace(wikiTitle)) {
                await props.api.controlledTextArea.replaceSelectionWithText(`[[${wikiSlugQuery}]]`, { select: "change" });
            }
            else {
                await props.api.controlledTextArea.replaceSelectionWithText(`[[${wikiSlugQuery}|${wikiTitle}]]`, { select: "change" });
            }
        }
        closeDialog();
    };

    React.useEffect(() => {
        if (!props.invocationTrigger) return; // avoid initial trigger
        void invoke();
    }, [props.invocationTrigger]);

    return <MarkdownEditorToolbarItem
        tooltip="Wiki link (ctrl+J)"
        icon={
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><path d="M0 3.75A.75.75 0 0 1 .75 3h7.497c1.566 0 2.945.8 3.751 2.014A4.495 4.495 0 0 1 15.75 3h7.5a.75.75 0 0 1 .75.75v15.063a.752.752 0 0 1-.755.75l-7.682-.052a3 3 0 0 0-2.142.878l-.89.891a.75.75 0 0 1-1.061 0l-.902-.901a2.996 2.996 0 0 0-2.121-.879H.75a.75.75 0 0 1-.75-.75Zm12.75 15.232a4.503 4.503 0 0 1 2.823-.971l6.927.047V4.5h-6.75a3 3 0 0 0-3 3ZM11.247 7.497a3 3 0 0 0-3-2.997H1.5V18h6.947c1.018 0 2.006.346 2.803.98Z"></path></svg>
        }
        onClick={() => {
            setOpen(true);
        }}
    >
        <ReactiveInputDialog open={open} onCancel={closeDialog}>
            <DialogTitle>
                Insert reference to Wiki article
            </DialogTitle>
            <DialogContent>
                <NameValuePair
                    name="Wiki link"
                    value={<>
                        <AssociationAutocomplete
                            disableEscapeHandling={true}
                            allowedItemTypes={QuickSearchItemTypeSets.WikiPages}
                            value={wikiSlugQuery}
                            autofocus={true}
                            onValueChange={(newQuery) => {
                                setWikiSlugQuery(newQuery);
                            }}
                            onSelect={(item) => {
                                setWikiSlugQuery(item?.canonicalWikiSlug ?? "");
                                setMatchingItem(item);
                            }}
                        />
                        {/*

                        this is a nice idea but for the moment it's a bit flakey, not fetching on initial load, and formatting sucks, and possibly being confusing when not verified.
                        
                        {verified ? (<Tooltip title={"This link is valid"} ><span className="markdown-class-verified-wiki">✅</span></Tooltip>) : (
                            <Tooltip title={"I don't know that article (yet!)"} ><span className="markdown-class-verified-wiki">{gIconMap.QuestionMark()}</span></Tooltip>
                        )} */}
                    </>
                    }
                />
                <NameValuePair
                    name="Custom caption (optional)"
                    value={
                        <InputBase
                            type="text"
                            value={wikiTitle}
                            onChange={(e) => {
                                setWikiTitle(e.target.value);
                            }}
                        />
                    }
                />
                <DialogActionsCM>
                    <MuiButtonWithEnterHandler onClick={handleOK}>Ok</MuiButtonWithEnterHandler>
                    <MuiButtonWithEnterHandler onClick={closeDialog}>Cancel</MuiButtonWithEnterHandler>
                </DialogActionsCM>
            </DialogContent>
        </ReactiveInputDialog>
    </MarkdownEditorToolbarItem >;
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export const WikiReferenceCommand: MarkdownEditorCommand = {
    id: kCommandId,
    toolbarItem: WikiReferenceDialog,
    keyboardShortcutCondition: { ctrlKey: true, key: "j" },
    deduceContext,
};
