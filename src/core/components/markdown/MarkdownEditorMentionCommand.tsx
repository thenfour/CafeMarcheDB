import { Button, DialogContent, DialogTitle, InputBase } from "@mui/material";
import React from "react";
import { QuickSearchItemMatch, QuickSearchItemTypeSets } from "shared/quickFilter";
import { IsNullOrWhitespace } from "shared/utils";
import { DialogActionsCM, NameValuePair } from "../CMCoreComponents2";
import { ReactiveInputDialog } from "../ReactiveInputDialog";
import { AssociationAutocomplete, AssociationValue } from "../setlistPlan/ItemAssociation";
import { MarkdownEditorCommand, MarkdownEditorCommandApi } from "./MarkdownEditorCommandBase";
import { MarkdownEditorToolbarItem, ParsedMarkdownReference, parseMarkdownReference } from "./MarkdownEditorCommandUtils";

interface ParsedMarkdownMention {
    isMention: boolean;
    type: string;
    id: number;
    parsedRef: ParsedMarkdownReference;
};

const parseMarkdownMention = (text: string): ParsedMarkdownMention => {
    const parsedRef = parseMarkdownReference(text);
    const fallbackReturnValue: ParsedMarkdownMention = {
        isMention: false,
        type: "",
        id: -1,
        parsedRef: parsedRef,
    };
    if (!parsedRef.isReference) {
        return fallbackReturnValue;
    }

    // now parse the slug, which is of the form "type:id"
    const slug = parsedRef.slug.trim();
    const parts = slug.split(":");
    if (parts.length !== 2) {
        return fallbackReturnValue;
    }
    const type = parts[0]!.trim();
    const id = parseInt(parts[1]!.trim(), 10);
    if (isNaN(id)) {
        return fallbackReturnValue;
    }
    return {
        isMention: true,
        type: type,
        id: id,
        parsedRef: parsedRef,
    };
};

const MarkdownEditorMentionDialog: React.FC<{ api: MarkdownEditorCommandApi }> = (props) => {
    const [open, setOpen] = React.useState(false);

    const incomingParsedMention = (() => {
        const text = props.api.controlledTextArea.getText();
        const selectedText = text.slice(props.api.controlledTextArea.selectionStart, props.api.controlledTextArea.selectionEnd);
        return parseMarkdownMention(selectedText);
    })();

    const defaultQueryText = incomingParsedMention.isMention ? `${incomingParsedMention.type}:${incomingParsedMention.id}` : incomingParsedMention.parsedRef.slug;

    const [queryText, setQueryText] = React.useState<string>(defaultQueryText); // unlike the wiki editor, this doesnt end up in the output link.
    React.useEffect(() => {
        setQueryText(defaultQueryText);
    }, [defaultQueryText]);

    const [matchingItem, setMatchingItem] = React.useState<QuickSearchItemMatch | null>(null);

    const [customCaption, setCustomCaption] = React.useState<string>(incomingParsedMention.parsedRef.caption);
    React.useEffect(() => {
        setCustomCaption(incomingParsedMention.parsedRef.caption);
    }, [incomingParsedMention.parsedRef.caption]);
    React.useEffect(() => {
        if (matchingItem) {
            setCustomCaption(matchingItem?.name);
        }
    }, [matchingItem]);

    const handleOK = async () => {
        if (matchingItem) {
            const path = `${matchingItem.itemType}:${matchingItem.id}`;
            const itemCaption = IsNullOrWhitespace(customCaption) ? matchingItem.name : customCaption;
            if (IsNullOrWhitespace(itemCaption)) {
                await props.api.controlledTextArea.replaceSelectionWithText(`[[${path}]]`, { select: "change" });
            }
            else {
                await props.api.controlledTextArea.replaceSelectionWithText(`[[${path}|${itemCaption}]]`, { select: "change" });
            }

        }
        setOpen(false);
    };

    return <MarkdownEditorToolbarItem
        tooltip="Link to song / event (ctrl+M)"
        icon={
            <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" className="octicon octicon-mention Button-visual">
                <path d="M4.75 2.37a6.501 6.501 0 0 0 6.5 11.26.75.75 0 0 1 .75 1.298A7.999 7.999 0 0 1 .989 4.148 8 8 0 0 1 16 7.75v1.5a2.75 2.75 0 0 1-5.072 1.475 3.999 3.999 0 0 1-6.65-4.19A4 4 0 0 1 12 8v1.25a1.25 1.25 0 0 0 2.5 0V7.867a6.5 6.5 0 0 0-9.75-5.496ZM10.5 8a2.5 2.5 0 1 0-5 0 2.5 2.5 0 0 0 5 0Z"></path>
            </svg>
        }
        onClick={() => {
            setOpen(true);
        }}
    >
        <ReactiveInputDialog open={open} onCancel={() => setOpen(false)}>
            <DialogTitle>
                Insert reference to songs, events, etc...
            </DialogTitle>
            <DialogContent>
                <NameValuePair
                    name="Item"
                    value={<>
                        <AssociationAutocomplete
                            allowedItemTypes={QuickSearchItemTypeSets.ForMarkdownReference}
                            value={queryText}
                            autofocus={true}
                            onValueChange={(newQuery) => {
                                setQueryText(newQuery);
                            }}
                            onSelect={(item) => {
                                setMatchingItem(item);
                                setCustomCaption(item?.name ?? "");
                            }}
                        />
                        {matchingItem && <AssociationValue value={matchingItem} />}
                    </>
                    }
                />
                <NameValuePair
                    name="Custom caption (optional)"
                    value={
                        <InputBase
                            type="text"
                            value={customCaption}
                            onChange={(e) => {
                                setCustomCaption(e.target.value);
                            }}
                        />
                    }
                />
                <DialogActionsCM>
                    <Button onClick={handleOK}>Ok</Button>
                    <Button onClick={() => {
                        setOpen(false);
                    }}>Cancel</Button>
                </DialogActionsCM>
            </DialogContent>
        </ReactiveInputDialog>
    </MarkdownEditorToolbarItem >;
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export const MarkdownEditorMentionCommand: MarkdownEditorCommand = {
    id: "MarkdownEditorMentionCommand",
    toolbarItem: MarkdownEditorMentionDialog,
    keyboardShortcutCondition: { ctrlKey: true, key: "m" },
};
