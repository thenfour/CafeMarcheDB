import { Button, DialogContent, DialogTitle, InputBase } from "@mui/material";
import React from "react";
import { IsNullOrWhitespace, isValidURL } from "shared/utils";
import { DialogActionsCM, NameValuePair } from "../CMCoreComponents2";
import { ReactiveInputDialog } from "../ReactiveInputDialog";
import { MarkdownEditorCommand, MarkdownEditorCommandApi, MarkdownTokenContext } from "./MarkdownEditorCommandBase";
import { GetMatchUnderSelection, MarkdownEditorToolbarItem } from "./MarkdownEditorCommandUtils";


const kCommandId = "MarkdownHyperlinkCommand";


interface ParsedMarkdownLink {
    isLink: boolean;
    linkHref: string;
    linkCaption: string;
}

const markdownHyperlinkPattern = /^\[([^\]]+)\]\(([^)]+)\)/;
const markdownHyperlinkPatternWithSurroundingWhitespace = /\s*^\[([^\]]+)\]\(([^)]+)\)\s*/g;

// regex pattern to match URLs (of any protocol - http, https, sftp, et al, and possibly relative URLs)
// const urlPattern = /(?:[a-zA-Z][a-zA-Z0-9+\-.]*:\/\/\S+|\/\S+)/;
// const urlPatternWithSurroundingWhitespace = /\s*(?:[a-zA-Z][a-zA-Z0-9+\-.]*:\/\/\S+|\/\S+)\s*/g;
// while it's tempting to use regex for every supported url type, relative included, it can be too aggressive in matching.
// for example [[special/announcements]] will match as a URL of "/announcements]]".
// simplest to just support raw http/https URLs for context deduction.
// https://stackoverflow.com/a/6927878/402169
const urlPattern = /\b((?:[a-z][\w-]+:(?:\/{1,3}|[a-z0-9%])|www\d{0,3}[.]|[a-z0-9.\-]+[.][a-z]{2,4}\/)(?:[^\s()<>]+|\(([^\s()<>]+|(\([^\s()<>]+\)))*\))+(?:\(([^\s()<>]+|(\([^\s()<>]+\)))*\)|[^\s`!()\[\]{};:'".,<>?«»“”‘’]))/gi;
const urlPatternWithSurroundingWhitespace = /\s*\b((?:[a-z][\w-]+:(?:\/{1,3}|[a-z0-9%])|www\d{0,3}[.]|[a-z0-9.\-]+[.][a-z]{2,4}\/)(?:[^\s()<>]+|\(([^\s()<>]+|(\([^\s()<>]+\)))*\))+(?:\(([^\s()<>]+|(\([^\s()<>]+\)))*\)|[^\s`!()\[\]{};:'".,<>?«»“”‘’]))\s*/gi;

/**
 * Checks if `text` is in the form [caption](url).
 * Returns { isLink: true, linkHref, linkCaption } if so,
 * or { isLink: false, ... } otherwise.
 */
export function parseMarkdownLink(text: string): ParsedMarkdownLink {
    if (isValidURL(text)) {
        return {
            isLink: true,
            linkHref: text,
            linkCaption: "",
        };
    }

    // Regex: ^ start, \[ capture text until ] \], \( capture url until ) \), $ end
    const pattern = markdownHyperlinkPattern;
    const match = text.match(pattern);

    if (!match) {
        return {
            isLink: false,
            linkHref: "",
            linkCaption: "",
        };
    }

    return {
        isLink: true,
        linkCaption: match[1] ?? "",
        linkHref: match[2] ?? "",
    };
}

function deduceContext(api: MarkdownEditorCommandApi): undefined | MarkdownTokenContext {
    let ret = GetMatchUnderSelection(
        api.controlledTextArea.getText(),
        api.controlledTextArea.selectionStart,
        api.controlledTextArea.selectionEnd,
        markdownHyperlinkPatternWithSurroundingWhitespace,
        { trimSurroundingWhitespace: true }
    );
    if (ret) return ret;
    ret = GetMatchUnderSelection(
        api.controlledTextArea.getText(),
        api.controlledTextArea.selectionStart,
        api.controlledTextArea.selectionEnd,
        urlPatternWithSurroundingWhitespace,
        { trimSurroundingWhitespace: true }
    );
    return ret;
}


// Toolbar item + dialog for inserting or editing a Markdown link: [caption](href).
// todo: upon invoke, detect the link under the caret.
// if so, adjust selection first to edit it.
export const InsertLinkDialog: React.FC<{ api: MarkdownEditorCommandApi }> = (props) => {
    // Dialog state
    const [open, setOpen] = React.useState(false);

    // For the link
    const [linkHref, setLinkHref] = React.useState("");
    const [linkCaption, setLinkCaption] = React.useState("");

    // On each render, parse the selected text in case user has a link selected
    const text = props.api.controlledTextArea.getText();
    const { selectionStart, selectionEnd } = props.api.controlledTextArea;
    const selectedText = text.slice(selectionStart, selectionEnd);
    const parsed = parseMarkdownLink(selectedText);
    const defaultHref = parsed.isLink ? parsed.linkHref : "";
    const defaultCaption = parsed.isLink ? parsed.linkCaption : selectedText;

    React.useEffect(() => {
        setLinkHref(defaultHref);
    }, [defaultHref]);

    React.useEffect(() => {
        setLinkCaption(defaultCaption);
    }, [defaultCaption]);

    const closeDialog = () => {
        setOpen(false);
        setTimeout(() => {
            props.api.textArea.focus();
        }, 0);
    };

    const handleOK = async () => {
        // Example rules:
        // - If there's no href, do nothing or insert a placeholder
        // - If there's no caption, we can default to the href, or just keep it empty
        if (!IsNullOrWhitespace(linkHref)) {
            if (IsNullOrWhitespace(linkCaption)) {
                // rely on linkify
                await props.api.controlledTextArea.replaceSelectionWithText(linkHref, { select: "change" });

            } else {
                const insertion = `[${linkCaption}](${linkHref})`;
                await props.api.controlledTextArea.replaceSelectionWithText(insertion, { select: "change" });
            }
        }

        closeDialog();
    };

    const invoke = async () => {
        const context = deduceContext(props.api);
        if (context) {
            await props.api.controlledTextArea.setSelectionRange(context.start, context.end);
        }
        setOpen(true);
    };

    React.useEffect(() => {
        if (!props.api.invocationTriggerMap[kCommandId]) return; // avoid initial trigger
        void invoke();
    }, [props.api.invocationTriggerMap[kCommandId]]);

    return (
        <MarkdownEditorToolbarItem
            tooltip="Insert link (ctrl+K)"
            icon={
                <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" className="octicon octicon-link Button-visual">
                    <path d="m7.775 3.275 1.25-1.25a3.5 3.5 0 1 1 4.95 4.95l-2.5 2.5a3.5 3.5 0 0 1-4.95 0 .751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018 1.998 1.998 0 0 0 2.83 0l2.5-2.5a2.002 2.002 0 0 0-2.83-2.83l-1.25 1.25a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042Zm-4.69 9.64a1.998 1.998 0 0 0 2.83 0l1.25-1.25a.751.751 0 0 1 1.042.018.751.751 0 0 1 .018 1.042l-1.25 1.25a3.5 3.5 0 1 1-4.95-4.95l2.5-2.5a3.5 3.5 0 0 1 4.95 0 .751.751 0 0 1-.018 1.042.751.751 0 0 1-1.042.018 1.998 1.998 0 0 0-2.83 0l-2.5 2.5a1.998 1.998 0 0 0 0 2.83Z"></path>
                </svg>

            }
            onClick={invoke}
        >
            <ReactiveInputDialog open={open} onCancel={closeDialog}>
                <DialogTitle>Insert a hyperlink</DialogTitle>
                <DialogContent>
                    <NameValuePair
                        name="Link URL"
                        value={
                            <InputBase
                                type="text"
                                placeholder="https://example.com"
                                value={linkHref}
                                autoFocus={true}
                                onChange={(e) => setLinkHref(e.target.value)}
                            />
                        }
                    />
                    <NameValuePair
                        name="Caption"
                        value={
                            <InputBase
                                type="text"
                                placeholder="Clickable text"
                                value={linkCaption}
                                onChange={(e) => setLinkCaption(e.target.value)}
                            />
                        }
                    />
                    <DialogActionsCM>
                        <Button onClick={handleOK}>Ok</Button>
                        <Button onClick={closeDialog}>Cancel</Button>
                    </DialogActionsCM>
                </DialogContent>
            </ReactiveInputDialog>
        </MarkdownEditorToolbarItem>
    );
};




////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export const MarkdownHyperlinkCommand: MarkdownEditorCommand = {
    id: kCommandId,
    toolbarItem: InsertLinkDialog,
    keyboardShortcutCondition: { ctrlKey: true, key: "k" },
    deduceContext,
};
