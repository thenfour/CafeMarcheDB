import { Button, DialogContent, DialogTitle, InputBase } from "@mui/material";
import React from "react";
import { IsNullOrWhitespace, isValidURL } from "shared/utils";
import { DialogActionsCM, NameValuePair } from "../CMCoreComponents2";
import { ReactiveInputDialog } from "../ReactiveInputDialog";
import { MarkdownEditorCommand, MarkdownEditorCommandApi } from "./MarkdownEditorCommandBase";
import { GetMatchUnderSelection, MarkdownEditorToolbarItem } from "./MarkdownEditorCommandUtils";


const kCommandId = "MarkdownHyperlinkCommand";


interface ParsedMarkdownLink {
    isLink: boolean;
    linkHref: string;
    linkCaption: string;
}

const urlPattern = /^(https?:\/\/[^\s/$.?#].[^\s]*)$/i;
const markdownHyperlinkPattern = /^\[([^\]]+)\]\(([^)]+)\)$/;

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

        setOpen(false);
    };

    return (
        <MarkdownEditorToolbarItem
            tooltip="Insert link (ctrl+K)"
            icon={
                <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" className="octicon octicon-link Button-visual">
                    <path d="m7.775 3.275 1.25-1.25a3.5 3.5 0 1 1 4.95 4.95l-2.5 2.5a3.5 3.5 0 0 1-4.95 0 .751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018 1.998 1.998 0 0 0 2.83 0l2.5-2.5a2.002 2.002 0 0 0-2.83-2.83l-1.25 1.25a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042Zm-4.69 9.64a1.998 1.998 0 0 0 2.83 0l1.25-1.25a.751.751 0 0 1 1.042.018.751.751 0 0 1 .018 1.042l-1.25 1.25a3.5 3.5 0 1 1-4.95-4.95l2.5-2.5a3.5 3.5 0 0 1 4.95 0 .751.751 0 0 1-.018 1.042.751.751 0 0 1-1.042.018 1.998 1.998 0 0 0-2.83 0l-2.5 2.5a1.998 1.998 0 0 0 0 2.83Z"></path>
                </svg>

            }
            onClick={() => {
                setOpen(true);
            }}
        >
            <ReactiveInputDialog open={open} onCancel={() => setOpen(false)}>
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
                        <Button onClick={() => setOpen(false)}>Cancel</Button>
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
    deduceContext: (api) => {
        let ret = GetMatchUnderSelection(api.controlledTextArea.getText(), api.controlledTextArea.selectionStart, api.controlledTextArea.selectionEnd, markdownHyperlinkPattern);
        if (ret) return ret;
        ret = GetMatchUnderSelection(api.controlledTextArea.getText(), api.controlledTextArea.selectionStart, api.controlledTextArea.selectionEnd, urlPattern);
        return ret;
    }
};
