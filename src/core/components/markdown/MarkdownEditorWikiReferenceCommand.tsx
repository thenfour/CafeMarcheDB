import { InputBase } from "@mui/material";
import React from "react";
import { QuickSearchItemTypeSets } from "shared/quickFilter";
import { IsNullOrWhitespace } from "shared/utils";
import { useLocale } from "src/locale/components/useLocale";
import { CMDialog } from "../CMDialog";
import { CMButton, NameValuePair } from "../CMCoreComponents2";
import { AssociationAutocomplete } from "../ItemAssociation";
import { MarkdownWikiLinkRegexWithSurroundingWhitespace } from "./CMDBLinkMarkdownPlugin";
import { MarkdownEditorCommand, MarkdownEditorCommandApi, MarkdownTokenContext } from "./MarkdownEditorCommandBase";
import { GetMatchUnderSelection, MarkdownEditorToolbarItem, parseMarkdownReference } from "./MarkdownEditorCommandUtils";

const kCommandId = "WikiReferenceCommand";

function deduceContext(api: MarkdownEditorCommandApi): undefined | MarkdownTokenContext {
    const ret = GetMatchUnderSelection(
        api.controlledTextArea.getText(),
        api.textArea.selectionStart,
        api.textArea.selectionEnd,
        MarkdownWikiLinkRegexWithSurroundingWhitespace,
        { trimSurroundingWhitespace: true }
    );
    return ret;
};

const WikiReferenceDialog: React.FC<{ api: MarkdownEditorCommandApi, invocationTrigger: number }> = (props) => {
    const [open, setOpen] = React.useState(false);
    const locale = useLocale();

    const [wikiSlugQuery, setWikiSlugQuery] = React.useState<string>("");
    const [wikiTitle, setWikiTitle] = React.useState<string>("");

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
        const selectedText = props.api.controlledTextArea.getSelectedText();
        const parsed = parseMarkdownReference(selectedText);
        setWikiSlugQuery(parsed.isReference ? parsed.slug : selectedText);
        setWikiTitle(parsed.caption);
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
        if (!props.invocationTrigger) {
            return;
        }
        void invoke();
    }, [props.invocationTrigger]);

    return <MarkdownEditorToolbarItem
        tooltip={locale.getPlainString("markdown.reference.wikiTooltip")}
        icon={
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><path d="M0 3.75A.75.75 0 0 1 .75 3h7.497c1.566 0 2.945.8 3.751 2.014A4.495 4.495 0 0 1 15.75 3h7.5a.75.75 0 0 1 .75.75v15.063a.752.752 0 0 1-.755.75l-7.682-.052a3 3 0 0 0-2.142.878l-.89.891a.75.75 0 0 1-1.061 0l-.902-.901a2.996 2.996 0 0 0-2.121-.879H.75a.75.75 0 0 1-.75-.75Zm12.75 15.232a4.503 4.503 0 0 1 2.823-.971l6.927.047V4.5h-6.75a3 3 0 0 0-3 3ZM11.247 7.497a3 3 0 0 0-3-2.997H1.5V18h6.947c1.018 0 2.006.346 2.803.98Z"></path></svg>
        }
        onClick={() => { void invoke(); }}
    >
        <CMDialog
            open={open}
            onClose={closeDialog}
            title={locale.getPlainString("markdown.reference.wikiTitle")}
            actions={<>
                <CMButton onClick={() => { void handleOK(); }}>{locale.getPlainString("common.action.ok")}</CMButton>
                <CMButton onClick={closeDialog}>{locale.getPlainString("common.action.cancel")}</CMButton>
            </>}
        >
                <NameValuePair
                    name={locale.getPlainString("markdown.reference.wikiLink")}
                    value={<>
                        <AssociationAutocomplete
                            permissionPolicy="requireAll"
                            searchEnabled={props.api.referenceSearchEnabled && open}
                            disableEscapeHandling={true}
                            allowedItemTypes={QuickSearchItemTypeSets.WikiPages}
                            value={wikiSlugQuery}
                            autofocus={true}
                            placeholder={locale.getPlainString("markdown.reference.search")}
                            onValueChange={(newQuery) => {
                                setWikiSlugQuery(newQuery);
                            }}
                            onSelect={(item) => {
                                setWikiSlugQuery(item?.canonicalWikiSlug ?? "");
                            }}
                        />
                    </>
                    }
                />
                <NameValuePair
                    name={locale.getPlainString("markdown.reference.caption")}
                    value={
                        <InputBase
                            type="text"
                            inputProps={{ "aria-label": locale.getPlainString("markdown.reference.caption") }}
                            value={wikiTitle}
                            onChange={(e) => {
                                setWikiTitle(e.target.value);
                            }}
                        />
                    }
                />
        </CMDialog>
    </MarkdownEditorToolbarItem >;
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export const WikiReferenceCommand: MarkdownEditorCommand = {
    id: kCommandId,
    toolbarItem: WikiReferenceDialog,
    keyboardShortcutCondition: { ctrlKey: true, key: "j" },
    deduceContext,
};
