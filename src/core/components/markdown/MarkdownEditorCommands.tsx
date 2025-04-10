import { EmojiSymbols, FormatIndentDecrease, FormatIndentIncrease, FormatQuote, FormatStrikethrough, Redo, Undo } from "@mui/icons-material";
import { Tooltip } from "@mui/material";
import React from "react";
import { IsNullOrWhitespace } from "shared/utils";
import { KeyValueTable } from "../CMCoreComponents2";
import { MarkdownEditorCommand } from "./MarkdownEditorCommandBase";
import { CMHighlightIcon, InsertSpecialCharacterToolItemWithDropdown, SurroundTextCommandSpec, SurroundTextToolItemWithDropdown } from "./MarkdownEditorCommandUtils";
import { MarkdownHyperlinkCommand } from "./MarkdownEditorHyperlinkCommand";
import { MarkdownEditorMentionCommand } from "./MarkdownEditorMentionCommand";
import { WikiReferenceCommand } from "./MarkdownEditorWikiReferenceCommand";

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
const BoldCommand: MarkdownEditorCommand = {
    id: "bold",
    toolbarTooltip: "Bold (Ctrl+B)",
    toolbarIcon: <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" className="octicon octicon-bold Button-visual">
        <path d="M4 2h4.5a3.501 3.501 0 0 1 2.852 5.53A3.499 3.499 0 0 1 9.5 14H4a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1Zm1 7v3h4.5a1.5 1.5 0 0 0 0-3Zm3.5-2a1.5 1.5 0 0 0 0-3H5v3Z"></path>
    </svg>,
    invoke: async (args) => {
        await args.api.controlledTextArea.toggleSurroundingSelectionWithText("**", "**", "bold text");
    },
    keyboardShortcutCondition: { ctrlKey: true, key: "B" },
};


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
const ItalicCommand: MarkdownEditorCommand = {
    id: "italic",
    toolbarTooltip: "Italic (Ctrl+I)",
    toolbarIcon:
        <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" className="octicon octicon-italic Button-visual">
            <path d="M6 2.75A.75.75 0 0 1 6.75 2h6.5a.75.75 0 0 1 0 1.5h-2.505l-3.858 9H9.25a.75.75 0 0 1 0 1.5h-6.5a.75.75 0 0 1 0-1.5h2.505l3.858-9H6.75A.75.75 0 0 1 6 2.75Z"></path>
        </svg>
    ,
    invoke: async (args) => {
        await args.api.controlledTextArea.toggleSurroundingSelectionWithText("*", "*", "italic text");
    },
    keyboardShortcutCondition: { ctrlKey: true, key: "I" },
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
const StrikethroughCommand: MarkdownEditorCommand = {
    id: "StrikethroughCommand",
    toolbarTooltip: "Strikethrough (ctrl+shift+S)",
    toolbarIcon: <FormatStrikethrough />
    ,
    invoke: async (args) => {
        await args.api.controlledTextArea.toggleSurroundingSelectionWithText("~~", "~~", "strikethrough text");
    },
    keyboardShortcutCondition: { ctrlKey: true, shiftKey: true, key: "S" },
};


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// todo: on invoke, detect the existing state, select the text, and pre-select the menu item
const gHighlightCommands: SurroundTextCommandSpec[] = [
    {
        prefix: "{{highlight:",
        suffix: "}}",
        textIfNoSelection: "highlighted text",
        menuItemLabel: <span className='markdown-class-highlight'>Highlight yellow</span>,
    },
    {
        prefix: "{{highlightred:",
        suffix: "}}",
        textIfNoSelection: "highlighted text",
        menuItemLabel: <span className='markdown-class-highlightred'>Highlight red</span>,
    },
    {
        prefix: "{{highlightgreen:",
        suffix: "}}",
        textIfNoSelection: "highlighted text",
        menuItemLabel: <span className='markdown-class-highlightgreen'>Highlight green</span>,
    },
    {
        prefix: "{{highlightblue:",
        suffix: "}}",
        textIfNoSelection: "highlighted text",
        menuItemLabel: <span className='markdown-class-highlightblue'>Highlight blue</span>,
    },
];

const HighlightCommand: MarkdownEditorCommand = {
    id: "highlight",
    toolbarItem: (props) => <SurroundTextToolItemWithDropdown
        {...props}
        commands={gHighlightCommands}
        icon={<CMHighlightIcon />}
        tooltip="Highlight"
    />,
};


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// todo: on invoke, detect the existing state, select the text, and pre-select the menu item
const gCharacterSizeCommands = [
    {
        prefix: "{{smaller:",
        suffix: "}}",
        textIfNoSelection: "smaller text",
        menuItemLabel: <span className='markdown-class-smaller'>Smaller text</span>,
    },
    {
        prefix: "{{small:",
        suffix: "}}",
        textIfNoSelection: "small text",
        menuItemLabel: <span className='markdown-class-small'>Small text</span>,
    },
    {
        prefix: "{{big:",
        suffix: "}}",
        textIfNoSelection: "big text",
        menuItemLabel: <span className='markdown-class-big'>Big text</span>,
    },
    {
        prefix: "{{bigger:",
        suffix: "}}",
        textIfNoSelection: "bigger text",
        menuItemLabel: <span className='markdown-class-bigger'>Bigger text</span>,
    },
];

const CharacterSizeCommand: MarkdownEditorCommand = {
    id: "characterSize",
    toolbarItem: (props) => <SurroundTextToolItemWithDropdown
        {...props}
        commands={gCharacterSizeCommands}
        icon={<span className='markdown-class-character-size svg-like'><span className="small">A</span><span className="big">A</span></span>}
        tooltip="Character size"
    />,
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// todo: on invoke, detect existing attachment.
// if existing, select & show dialog. if not, show file picker dialog.
const FileAttachCommand: MarkdownEditorCommand = {
    id: "fileAttach",
    toolbarTooltip: "File attach",
    toolbarIcon:
        <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" className="octicon octicon-paperclip Button-visual">
            <path d="M12.212 3.02a1.753 1.753 0 0 0-2.478.003l-5.83 5.83a3.007 3.007 0 0 0-.88 2.127c0 .795.315 1.551.88 2.116.567.567 1.333.89 2.126.89.79 0 1.548-.321 2.116-.89l5.48-5.48a.75.75 0 0 1 1.061 1.06l-5.48 5.48a4.492 4.492 0 0 1-3.177 1.33c-1.2 0-2.345-.487-3.187-1.33a4.483 4.483 0 0 1-1.32-3.177c0-1.195.475-2.341 1.32-3.186l5.83-5.83a3.25 3.25 0 0 1 5.553 2.297c0 .863-.343 1.691-.953 2.301L7.439 12.39c-.375.377-.884.59-1.416.593a1.998 1.998 0 0 1-1.412-.593 1.992 1.992 0 0 1 0-2.828l5.48-5.48a.751.751 0 0 1 1.042.018.751.751 0 0 1 .018 1.042l-5.48 5.48a.492.492 0 0 0 0 .707.499.499 0 0 0 .352.154.51.51 0 0 0 .356-.154l5.833-5.827a1.755 1.755 0 0 0 0-2.481Z"></path>
        </svg>
    ,
    invoke: async (args) => {
        args.api.nativeFileInputRef.click();
    },
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
const UnorderedListCommand: MarkdownEditorCommand = {
    id: "UnorderedList",
    toolbarTooltip: "Unordered list",
    toolbarIcon:
        <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" className="octicon octicon-list-unordered Button-visual">
            <path d="M5.75 2.5h8.5a.75.75 0 0 1 0 1.5h-8.5a.75.75 0 0 1 0-1.5Zm0 5h8.5a.75.75 0 0 1 0 1.5h-8.5a.75.75 0 0 1 0-1.5Zm0 5h8.5a.75.75 0 0 1 0 1.5h-8.5a.75.75 0 0 1 0-1.5ZM2 14a1 1 0 1 1 0-2 1 1 0 0 1 0 2Zm1-6a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM2 4a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z"></path>
        </svg>
    ,
    invoke: async (args) => {
        await args.api.controlledTextArea.transformSelectedLines((line, index) => {
            return `- ${line}`;
        });
    },
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
const OrderedListCommand: MarkdownEditorCommand = {
    id: "OrderedListCommand",
    toolbarTooltip: "Ordered list",
    toolbarIcon:
        <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" className="octicon octicon-list-ordered Button-visual">
            <path d="M5 3.25a.75.75 0 0 1 .75-.75h8.5a.75.75 0 0 1 0 1.5h-8.5A.75.75 0 0 1 5 3.25Zm0 5a.75.75 0 0 1 .75-.75h8.5a.75.75 0 0 1 0 1.5h-8.5A.75.75 0 0 1 5 8.25Zm0 5a.75.75 0 0 1 .75-.75h8.5a.75.75 0 0 1 0 1.5h-8.5a.75.75 0 0 1-.75-.75ZM.924 10.32a.5.5 0 0 1-.851-.525l.001-.001.001-.002.002-.004.007-.011c.097-.144.215-.273.348-.384.228-.19.588-.392 1.068-.392.468 0 .858.181 1.126.484.259.294.377.673.377 1.038 0 .987-.686 1.495-1.156 1.845l-.047.035c-.303.225-.522.4-.654.597h1.357a.5.5 0 0 1 0 1H.5a.5.5 0 0 1-.5-.5c0-1.005.692-1.52 1.167-1.875l.035-.025c.531-.396.8-.625.8-1.078a.57.57 0 0 0-.128-.376C1.806 10.068 1.695 10 1.5 10a.658.658 0 0 0-.429.163.835.835 0 0 0-.144.153ZM2.003 2.5V6h.503a.5.5 0 0 1 0 1H.5a.5.5 0 0 1 0-1h.503V3.308l-.28.14a.5.5 0 0 1-.446-.895l1.003-.5a.5.5 0 0 1 .723.447Z"></path>
        </svg>
    ,
    invoke: async (args) => {
        await args.api.controlledTextArea.transformSelectedLines((line, index) => {
            //if (IsNullOrWhitespace(line)) return line;
            return `${index + 1}. ${line}`;
        });
    },
};




////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
const IndentCommand: MarkdownEditorCommand = {
    id: "IndentCommand",
    toolbarTooltip: "Indent (ctrl+])",
    toolbarIcon: <FormatIndentIncrease />
    ,
    invoke: async (args) => {
        await args.api.controlledTextArea.transformSelectedLines((line) => {
            if (IsNullOrWhitespace(line)) return line;
            return `  ${line}`;
        });
    },
    keyboardShortcutCondition: { ctrlKey: true, key: "]" },
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
const DecreaseIndentCommand: MarkdownEditorCommand = {
    id: "DecreaseIndentCommand",
    toolbarTooltip: "Decrease Indent (ctrl+[)",
    toolbarIcon: <FormatIndentDecrease />
    ,
    invoke: async (args) => {
        await args.api.controlledTextArea.transformSelectedLines((line) => {
            if (line.startsWith("  ")) {
                return line.slice(2); // remove 2 spaces
            }
            return line;
        });
    },
    keyboardShortcutCondition: { ctrlKey: true, key: "[" },
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
const SaveProgressCommand: MarkdownEditorCommand = {
    id: "SaveProgressCommand",
    invoke: async (args) => {
        await args.api.saveProgress();
    },
    keyboardShortcutCondition: { ctrlKey: true, key: "enter" },
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
const gSpecialCharacters = [
    { category: 'Musical Symbols', symbols: ['♪', '♫', '♩', '♬', '♭', '♮', '♯', '𝄞', '𝄢', '𝄡'] },
    { category: 'Arrows', symbols: ['→', '←', '↑', '↓', '↔', '↕', '⇒', '⇐', '⇑', '⇓', '⇔', '⇕'] },
    { category: 'Miscellaneous', symbols: ['©', '®', '™', '✓', '✗', '★', '☆', '♠', '♣', '♥', '♦', '☀', '☁', '☂', '☃', '☎', '✉', '✂', '✍', '✏'] },
];

const SpecialCharactersCommand: MarkdownEditorCommand = {
    id: "SpecialCharactersCommand",
    toolbarItem: (props) => <InsertSpecialCharacterToolItemWithDropdown
        {...props}
        categoriesAndCharacters={gSpecialCharacters}
        icon={<EmojiSymbols />}
        tooltip="Insert special character"
    />,
};


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// todo: detect the existing state, select the text, and pre-select the menu item
const EncloseCommand: MarkdownEditorCommand = {
    id: "enclose",
    toolbarIcon: <span key={19} className='svg-like markdown-enclosed-icon'>A</span>,
    toolbarTooltip: "Enclose",
    invoke: async (args) => {
        await args.api.controlledTextArea.surroundSelectionWithText("{{enclosed:", "}}", "A");
    },
};


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// todo: make it like character size: detect the existing state, select the text, and pre-select the menu item
const Heading1Command: MarkdownEditorCommand = {
    id: "Heading1Command",
    toolbarTooltip: "Heading 1 (ctrl+H)",
    toolbarIcon: <span className='svg-like markdown-heading-icon'>H1</span>,
    invoke: async (args) => {
        await args.api.controlledTextArea.transformSelectedLines((line) => {
            if (IsNullOrWhitespace(line)) return line;
            if (line.startsWith("# ")) return line.slice(2); // remove heading
            return `# ${line}`;
        });
    },
    keyboardShortcutCondition: { ctrlKey: true, key: "h" },
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
const QuoteCommand: MarkdownEditorCommand = {
    id: "QuoteCommand",
    toolbarTooltip: "Quote (ctrl+Q)",
    toolbarIcon:
        <FormatQuote />
    // <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" className="octicon octicon-quote Button-visual">
    //     <path d="M1.75 2.5h10.5a.75.75 0 0 1 0 1.5H1.75a.75.75 0 0 1 0-1.5Zm4 5h8.5a.75.75 0 0 1 0 1.5h-8.5a.75.75 0 0 1 0-1.5Zm0 5h8.5a.75.75 0 0 1 0 1.5h-8.5a.75.75 0 0 1 0-1.5ZM2.5 7.75v6a.75.75 0 0 1-1.5 0v-6a.75.75 0 0 1 1.5 0Z"></path>
    // </svg>
    ,
    invoke: async (args) => {
        await args.api.controlledTextArea.transformSelectedLines((line) => {
            if (IsNullOrWhitespace(line)) return line;
            if (line.startsWith("> ")) return line.slice(2); // remove
            return `> ${line}`;
        });
    },
    keyboardShortcutCondition: { ctrlKey: true, key: "q" },
};



////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
const CodeCommand: MarkdownEditorCommand = {
    id: "CodeCommand",
    toolbarTooltip: "Code/preformatted",
    toolbarIcon: <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" className="octicon octicon-code Button-visual">
        <path d="m11.28 3.22 4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.749.749 0 0 1-1.275-.326.749.749 0 0 1 .215-.734L13.94 8l-3.72-3.72a.749.749 0 0 1 .326-1.275.749.749 0 0 1 .734.215Zm-6.56 0a.751.751 0 0 1 1.042.018.751.751 0 0 1 .018 1.042L2.06 8l3.72 3.72a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215L.47 8.53a.75.75 0 0 1 0-1.06Z"></path>
    </svg>
    ,
    invoke: async (args) => {
        // if multi line selection, add ``` lines surrounding the selected lines.
        // if single line selection, add ` to the start and end of the selection.
        if (args.api.controlledTextArea.isLineBasedSelection()) {
            await args.api.controlledTextArea.transformSelectedLines((line, lineIndex, allSelectedLines) => {
                if (lineIndex === 0) {
                    return `\`\`\`\n${line}`;
                }
                if (lineIndex === allSelectedLines.length - 1) {
                    return `${line}\n\`\`\``;
                }
                return line;
            });
        } else {
            await args.api.controlledTextArea.surroundSelectionWithText("`", "`", "code text");
        }
    },
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
const MarkdownInspectCommand: MarkdownEditorCommand = {
    id: "MarkdownInspectCommand",
    isEnabled: (api) => {
        return api.dashboardContext.isShowingAdminControls;
    },
    toolbarItem: (props) => {
        const [_, setRefreshTrigger] = React.useState(0);
        React.useEffect(() => {
            const handleKeyDown = () => {
                setTimeout(() => {
                    setRefreshTrigger((prev) => prev + 1);
                }, 0); // wait for the next event loop to get the latest selection
            };
            const textArea = props.api.textArea;
            if (textArea) textArea.addEventListener("keydown", handleKeyDown);
            return () => {
                if (textArea) textArea.removeEventListener("keydown", handleKeyDown);
            };
        }, [props.api.textArea]);
        // return <div style={{fontFamily:}}>pos: {props.api.controlledTextArea.selectionStart}</div>
        return <KeyValueTable data={{
            "sel": `${props.api.controlledTextArea.selectionStart}-${props.api.controlledTextArea.selectionEnd} (len: ${props.api.controlledTextArea.selectionEnd - props.api.controlledTextArea.selectionStart})`,
            "selectedText: ": props.api.controlledTextArea.getText(),
            "isLineBasedSelection": props.api.controlledTextArea.isLineBasedSelection(),
            "List info at caret": `${props.api.controlledTextArea.getListAtCaretInfo().isListItem ? "IsList" : "NotList"} (prefix: ${props.api.controlledTextArea.getListAtCaretInfo().prefix})`,
            // todo: 
            // - parse wiki reference   [[abcd/xyzw]] [[abcd/xyzw|aoeu]]
            // - parse mention          [[song:126|The Way We Were]] 
            // - parse hyperlink        https://github.com/thenfour/CafeMarcheDB/issues/436
            //                          [snthch](https://github.com/thenfour/CafeMarcheDB/issues/436)
            // - parse file attachment  [AnnualReport2017.pdf](/api/files/download/HJtQXslPVK.pdf)
            // - parse image            ![25_.jpg](/api/files/download/OB7Lzhk23h.jpg){{highlightgreen:highlighted text}}

            // with the goal of:
            // 1. detect & parse the contextual objects (there may be multiple, especially in the case of for example lists or tables, and we want to show the correct menus for each relevant object under the cursor)
            // 2. allow tool commands to operate on more than just the selection, but specify the parsed info.
            // probably for #2 we just start by setting the selection, then manipulating it. that avoids complexity of requiring changes across render boundaries / setTimeout stuff to set new selection etc..
        }} />
    },
    keyboardShortcutCondition: { ctrlKey: true, key: "t" },
};



////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
const UndoCommand: MarkdownEditorCommand = {
    id: "undo",
    toolbarItem: (props) => {
        return <Tooltip title={"Undo (Ctrl+Z)"} disableInteractive>
            <div className={`toolItem ${props.api.controlledTextArea.undoManagerApi.canUndo ? "interactable" : ""}`} onClick={props.api.controlledTextArea.undoManagerApi.canUndo ? async () => {
                await props.api.controlledTextArea.undoManagerApi.undo();
            } : undefined}>
                <Undo />
            </div>
        </Tooltip>
    },
    invoke: async (args) => {
        await args.api.controlledTextArea.undoManagerApi.undo();
    },
    keyboardShortcutCondition: { ctrlKey: true, key: "Z" },
};


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
const RedoCommand: MarkdownEditorCommand = {
    id: "redo",
    //toolbarTooltip: "Redo (Ctrl+Y)",
    //toolbarIcon: <Redo /> //<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><path d="M14.72 2.22a.75.75 0 0 1 1.06 0l6.25 6.25a.75.75 0 0 1 0 1.06l-6.25 6.25a.75.75 0 1 1-1.06-1.06l4.97-4.97H8.25c-.797 0-2.008.245-3 .959-.952.686-1.75 1.835-1.75 3.791s.798 3.105 1.75 3.791c.992.714 2.203.959 3 .959h3a.75.75 0 0 1 0 1.5h-3c-1.037 0-2.575-.305-3.876-1.241C3.035 18.545 2 16.944 2 14.5c0-2.444 1.035-4.045 2.374-5.009C5.675 8.555 7.214 8.25 8.25 8.25h11.44l-4.97-4.97a.75.75 0 0 1 0-1.06Z"></path></svg>
    //,

    toolbarItem: (props) => {
        return <Tooltip title={"Redo (Ctrl+Y)"} disableInteractive>
            <div className={`toolItem ${props.api.controlledTextArea.undoManagerApi.canRedo ? "interactable" : ""}`} onClick={props.api.controlledTextArea.undoManagerApi.canRedo ? async () => {
                await props.api.controlledTextArea.undoManagerApi.redo();
            } : undefined}>
                <Redo />
            </div>
        </Tooltip>
    },


    invoke: async (args) => {
        await args.api.controlledTextArea.undoManagerApi.redo();
    },
    // isEnabled(api) {
    //     return api.controlledTextArea.undoManagerApi.canRedo;
    // },
    keyboardShortcutCondition: { ctrlKey: true, key: "Y" },
};


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export const gMarkdownEditorCommandGroups: MarkdownEditorCommand[][] = [
    // MarkdownInspectCommand
    [UndoCommand, RedoCommand],
    [BoldCommand, ItalicCommand, StrikethroughCommand, EncloseCommand, HighlightCommand],
    [UnorderedListCommand, OrderedListCommand, DecreaseIndentCommand, IndentCommand],
    [Heading1Command, QuoteCommand, CodeCommand, CharacterSizeCommand],
    [SpecialCharactersCommand],
    [FileAttachCommand,
        WikiReferenceCommand,
        MarkdownEditorMentionCommand,
        MarkdownHyperlinkCommand,
        SaveProgressCommand],

];

