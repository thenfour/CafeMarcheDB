import { Button, DialogContent, DialogTitle, InputBase } from "@mui/material";
import React from "react";
import { IsNullOrWhitespace, isValidURL } from "shared/utils";
import { DialogActionsCM, NameValuePair } from "../CMCoreComponents2";
import { ReactiveInputDialog } from "../ReactiveInputDialog";
import { MarkdownEditorCommand, MarkdownEditorCommandApi } from "./MarkdownEditorCommandBase";
import { MarkdownEditorToolbarItem } from "./MarkdownEditorCommandUtils";


interface RegionBounds {
    refStart: number; // the index where [[ begins
    refEnd: number;   // the index right after ]] ends
}

/**
 * Finds the reference (if any) that fully contains the given selection range.
 * Returns null if there's no reference containing the full selection.
 */
export function findRegionBoundsForSelection(
    text: string,
    selectionStart: number,
    selectionEnd: number
): RegionBounds | null {
    // This regex looks for [[...]] blocks, capturing everything from "[[" up to the matching "]]".
    // It doesn't attempt to parse pipe chars, etc. — just identifies the bracketed segment.
    // If you want the stricter pattern that excludes extra ']', you could do something like: /\[\[[^\]]*?\]\]/g
    const pattern = /\[\[[^\]]*?\]\]/g;

    let match: RegExpExecArray | null;

    while ((match = pattern.exec(text)) !== null) {
        // match.index is where "[[" starts
        const refStart = match.index;
        const refEnd = refStart + match[0].length; // index right after the entire "[[...]]"

        // Check if the entire selection falls within this reference:
        if (selectionStart >= refStart && selectionEnd <= refEnd) {
            // Found a reference that fully contains the selection
            return { refStart, refEnd };
        }
    }

    // No match found that fully contains the selection
    return null;
}



interface ParsedMarkdownLink {
    isLink: boolean;
    linkHref: string;
    linkCaption: string;
}

/**
 * Checks if `text` is in the form [caption](url).
 * Returns { isLink: true, linkHref, linkCaption } if so,
 * or { isLink: false, ... } otherwise.
 */
export function parseMarkdownLink(text: string): ParsedMarkdownLink {
    // Regex: ^ start, \[ capture text until ] \], \( capture url until ) \), $ end
    const pattern = /^\[([^\]]*)\]\(([^)]*)\)$/;
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


/**
 * Toolbar item + dialog for inserting or editing a Markdown link: [caption](href).
 */
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
    const isURL = isValidURL(selectedText);
    const parsed = parseMarkdownLink(selectedText);
    const defaultHref = parsed.isLink ? parsed.linkHref : (isURL ? selectedText : "");
    const defaultCaption = parsed.isLink ? parsed.linkCaption : (isURL ? "" : selectedText);

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
    id: "MarkdownHyperlinkCommand",
    toolbarItem: InsertLinkDialog,
    keyboardShortcutCondition: { ctrlKey: true, key: "k" },
};
