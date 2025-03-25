// why can't i get this right?
// we need effectively an edit field combining the MarkdownEditor and Markdown controls as a preview.
// "view" vs. "edit" modes, "save / close" etc should not be there yet.
// file wrapper included.
// think github's issue description editor.
import EmojiSymbolsIcon from '@mui/icons-material/EmojiSymbols';
import FormatIndentDecreaseIcon from '@mui/icons-material/FormatIndentDecrease';
import FormatIndentIncreaseIcon from '@mui/icons-material/FormatIndentIncrease';
import FormatUnderlinedIcon from '@mui/icons-material/FormatUnderlined';
import StrikethroughSIcon from '@mui/icons-material/StrikethroughS';
import { Collapse, Menu, MenuItem, Tooltip } from "@mui/material";
import React from "react";
import { IsNullOrWhitespace } from 'shared/utils';
import { gIconMap } from '../../db3/components/IconMap';
import { Markdown, MarkdownEditor } from "./RichTextEditor";
import { Pre } from '../CMCoreComponents2';

//////////////////////////////////////////////////
interface SpecialCharacterDropdownProps {
    anchorEl: HTMLElement | null;
    onSelect: (character: string) => void;
    onClose: () => void;
}

const specialCharacters = [
    {
        category: 'Formats', symbols: [
            '{{big:this text is big}}',
            '{{bigger:this text is bigger}}',
            '{{highlight:this text is yellow}}',
            '{{highlightred:this text is red}}',
            '{{highlightgreen:this text is green}}',
            '{{highlightblue:this text is blue}}',
        ], display: [
            <span key={1} className='markdown-class-big'>Big text</span>,
            <span key={2} className='markdown-class-bigger'>Bigger text</span>,
            <span key={3} className='markdown-class-highlight'>Highlight yellow</span>,
            <span key={4} className='markdown-class-highlightred'>Highlight red</span>,
            <span key={5} className='markdown-class-highlightgreen'>Highlight green</span>,
            <span key={6} className='markdown-class-highlightblue'>Highlight blue</span>,
        ]
    },
    { category: 'Musical Symbols', symbols: ['♪', '♫', '♩', '♬', '♭', '♮', '♯', '𝄞', '𝄢', '𝄡'], display: undefined },
    //{ category: 'Rehearsal marks', symbols: ['Ⓐ', 'Ⓑ', 'Ⓒ', 'Ⓓ', 'Ⓔ', 'Ⓕ', 'Ⓖ', 'Ⓗ', 'Ⓘ', 'Ⓙ', 'Ⓚ', 'Ⓛ', 'Ⓜ', 'Ⓝ', 'Ⓞ', 'Ⓟ', 'Ⓠ', 'Ⓡ', 'Ⓢ', 'Ⓣ', 'Ⓤ', 'Ⓥ', 'Ⓦ', 'Ⓧ', 'Ⓨ', 'Ⓩ', '⓪', '①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨'] },
    //{ category: 'Math Symbols', symbols: ['∞', '√', '∑', 'π', '∆', '≈', '≠', '≤', '≥', '∫', '∂', '∇', '∈', '∉', '∪', '∩', '⊂', '⊃', '⊆', '⊇'] },
    //{ category: 'Currency Symbols', symbols: ['$', '€', '£', '¥', '₩', '₽', '₹', '₺', '₿'] },
    //{ category: 'Rehearsal marks', symbols: ['🄰', '🄱', '🄲', '🄳', '🄴', '🄵', '🄶', '🄷', '🄸', '🄹', '🄺', '🄻', '🄼', '🄽', '🄾', '🄿', '🅀', '🅁', '🅂', '🅃', '🅄', '🅅', '🅆', '🅇', '🅈', '🅉', '🅊', '🅋', '🅌', '🅍', '🅎', '🅏', '🅐', '🅑', '🅒', '🅓', '🅔', '🅕', '🅖', '🅗', '🅘', '🅙', '🅚', '🅛', '🅜', '🅝', '🅞', '🅟', '🅠', '🅡', '🅢', '🅣', '🅤', '🅥', '🅦', '🅧', '🅨', '🅩'] },
    //{ category: 'Rehearsal marks', symbols: ['{{enclosed:A}}'], display:["A"] },
    {
        category: 'Rehearsal marks', symbols: [
            '{{enclosed:A}}', '{{enclosed:B}}', '{{enclosed:C}}', '{{enclosed:D}}', '{{enclosed:E}}', '{{enclosed:F}}', '{{enclosed:G}}', '{{enclosed:1}}', '{{enclosed:2}}', '{{enclosed:3}}'],
        display: [
            <span key={19} className='markdown-class-enclosed'>A</span>,
            <span key={10} className='markdown-class-enclosed'>B</span>,
            <span key={11} className='markdown-class-enclosed'>C</span>,
            <span key={12} className='markdown-class-enclosed'>D</span>,
            <span key={13} className='markdown-class-enclosed'>E</span>,
            <span key={14} className='markdown-class-enclosed'>F</span>,
            <span key={15} className='markdown-class-enclosed'>G</span>,
            <span key={16} className='markdown-class-enclosed'>1</span>,
            <span key={17} className='markdown-class-enclosed'>2</span>,
            <span key={20} className='markdown-class-enclosed'>3</span>,
        ]
    },
    { category: 'Arrows', symbols: ['→', '←', '↑', '↓', '↔', '↕', '⇒', '⇐', '⇑', '⇓', '⇔', '⇕'], display: undefined },
    { category: 'Miscellaneous', symbols: ['©', '®', '™', '✓', '✗', '★', '☆', '♠', '♣', '♥', '♦', '☀', '☁', '☂', '☃', '☎', '✉', '✂', '✍', '✏'], display: undefined },
];

const SpecialCharacterDropdown: React.FC<SpecialCharacterDropdownProps> = ({ anchorEl, onSelect, onClose }) => {

    return <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={onClose} className='markdown'>
        {specialCharacters.map((category) => (
            <div key={category.category}>
                <MenuItem disabled dense>{category.category}</MenuItem>
                {category.symbols.map((symbol, i) => (
                    <MenuItem key={i} onClick={() => onSelect(symbol)} dense>
                        {category.display ? category.display[i] : symbol}
                    </MenuItem>
                ))}
            </div>
        ))}
    </Menu>;
};




//////////////////////////////////////////////////
interface Markdown3EditorProps {
    readonly?: boolean;
    value: string;
    autoFocus?: boolean;
    //beginInPreview?: boolean;
    nominalHeight: number;
    onChange: (v: string) => void;
    onSave?: () => void;
};

type M3Tab = "write" | "preview" | "sidebyside";

// style
// links
// images
// lists
// tables
// attachments
//type M3TipsTab = "Style" | "Links" | "Images" | "Lists" | "Tables" | "Attachments";
//const M3TipsTabValues = ["Style", "Links", "Images", "Lists", "Tables", "Attachments"];

const M3TipsTabValues = [
    "Character",
    "Paragraph",
    "Lists",
    "Tables",
    "Links",
    "Images",
    "Attachments",
    "Music notation",
] as const;

// 2. Derive a type from that array
type M3TipsTab = (typeof M3TipsTabValues)[number];

export const Markdown3Editor = ({ readonly = false, autoFocus = false, ...props }: Markdown3EditorProps) => {
    const [tab, setTab] = React.useState<M3Tab>("sidebyside");
    const [popoverAnchorEl, setPopoverAnchorEl] = React.useState<null | HTMLElement>(null);
    const [showFormattingTips, setShowFormattingTips] = React.useState<boolean>(false);
    const [tipsTab, setTipsTab] = React.useState<M3TipsTab | null>(null);

    const [headingTrig, setHeadingTrig] = React.useState<number>(0);
    const [boldTrig, setBoldTrig] = React.useState<number>(0);
    const [italicTrig, setItalicTrig] = React.useState<number>(0);
    const [quoteTrig, setQuoteTrig] = React.useState<number>(0);
    const [codeTrig, setCodeTrig] = React.useState<number>(0);
    const [linkTrig, setLinkTrig] = React.useState<number>(0);
    const [orderedListTrig, setOrderedListTrig] = React.useState<number>(0);
    const [unorderedListTrig, setUnorderedListTrig] = React.useState<number>(0);
    const [attachFilesTrig, setAttachFilesTrig] = React.useState<number>(0);
    const [mentionTrig, setMentionTrig] = React.useState<number>(0);
    const [referenceTrig, setReferenceTrig] = React.useState<number>(0);
    const [indentTrig, setIndentTrig] = React.useState<number>(0);
    const [outdentTrig, setOutdentTrig] = React.useState<number>(0);
    const [underlineTrig, setUnderlineTrig] = React.useState<number>(0);
    const [strikethroughTrig, setStrikethroughTrig] = React.useState<number>(0);
    const [abcjsTrig, setAbcjsTrig] = React.useState<number>(0);
    const [specialCharacterMenuOpen, setSpecialCharacterMenuOpen] = React.useState<boolean>(false);
    const [specialCharacterTrig, setSpecialCharacterTrig] = React.useState<number>(0);
    const [specialCharacter, setSpecialCharacter] = React.useState<string>("");
    const [specialCharacterMenuAnchorEl, setSpecialCharacterMenuAnchorEl] = React.useState<null | HTMLElement>(null);

    // when coming back from preview mode to 
    const [refocusTrig, setRefocusTrig] = React.useState<number>(0);

    const changeTab = (newTab: M3Tab) => {
        // avoid retriggering on remount
        setHeadingTrig(0);
        setBoldTrig(0);
        setItalicTrig(0);
        setQuoteTrig(0);
        setCodeTrig(0);
        setLinkTrig(0);
        setOrderedListTrig(0);
        setUnorderedListTrig(0);
        setAbcjsTrig(0);
        setAttachFilesTrig(0);
        setMentionTrig(0);
        setReferenceTrig(0);
        setIndentTrig(0);
        setOutdentTrig(0);
        setUnderlineTrig(0);
        setStrikethroughTrig(0);
        setSpecialCharacterTrig(0);
        setSpecialCharacterMenuOpen(false);

        setTab(newTab);
    };

    const editorIsVisible = tab === "write" || tab === "sidebyside";

    React.useEffect(() => {

        if (editorIsVisible) {
            //console.log(`refocus + 1 => ${refocusTrig + 1}`);
            setRefocusTrig(refocusTrig + 1); // tell the textarea to focus again.
        }

    }, [tab]);

    // React.useEffect(() => {
    //     const handleKeyDown = (event) => {
    //         // Check for the 'Ctrl+Shift+P'
    //         if (event.ctrlKey && event.shiftKey && event.key.toUpperCase() === 'P') {
    //             event.preventDefault();  // Prevent default to avoid any browser shortcut conflict
    //             changeTab((tab === "preview") ? "write" : "preview");  // Toggle between edit and preview mode
    //         }
    //     };

    //     document.addEventListener('keydown', handleKeyDown);

    //     return () => {
    //         document.removeEventListener('keydown', handleKeyDown);
    //     };
    // }, [tab]); // Empty dependency array indicates this effect runs once on mount and cleanup on unmount

    const toolItems = {
        heading: <Tooltip title={"Heading (ctrl+H)"} disableInteractive>
            <div className="toolItem heading" onClick={() => setHeadingTrig(headingTrig + 1)}>
                <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" className="octicon octicon-heading Button-visual">
                    <path d="M3.75 2a.75.75 0 0 1 .75.75V7h7V2.75a.75.75 0 0 1 1.5 0v10.5a.75.75 0 0 1-1.5 0V8.5h-7v4.75a.75.75 0 0 1-1.5 0V2.75A.75.75 0 0 1 3.75 2Z"></path>
                </svg>
            </div>
        </Tooltip>,
        bold: <Tooltip title={"Bold (ctrl+B)"} disableInteractive>
            <div className="toolItem bold" onClick={() => setBoldTrig(boldTrig + 1)}>
                <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" className="octicon octicon-bold Button-visual">
                    <path d="M4 2h4.5a3.501 3.501 0 0 1 2.852 5.53A3.499 3.499 0 0 1 9.5 14H4a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1Zm1 7v3h4.5a1.5 1.5 0 0 0 0-3Zm3.5-2a1.5 1.5 0 0 0 0-3H5v3Z"></path>
                </svg>
            </div>
        </Tooltip>,
        italic: <Tooltip title={"Italic (ctrl+I)"} disableInteractive>
            <div className="toolItem italic" onClick={() => setItalicTrig(italicTrig + 1)}>
                <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" className="octicon octicon-italic Button-visual">
                    <path d="M6 2.75A.75.75 0 0 1 6.75 2h6.5a.75.75 0 0 1 0 1.5h-2.505l-3.858 9H9.25a.75.75 0 0 1 0 1.5h-6.5a.75.75 0 0 1 0-1.5h2.505l3.858-9H6.75A.75.75 0 0 1 6 2.75Z"></path>
                </svg>
            </div>
        </Tooltip>,
        quote: <Tooltip title={"Quote (ctrl+shift+Q)"} disableInteractive>
            <div className="toolItem quote" onClick={() => setQuoteTrig(quoteTrig + 1)}>
                <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" className="octicon octicon-quote Button-visual">
                    <path d="M1.75 2.5h10.5a.75.75 0 0 1 0 1.5H1.75a.75.75 0 0 1 0-1.5Zm4 5h8.5a.75.75 0 0 1 0 1.5h-8.5a.75.75 0 0 1 0-1.5Zm0 5h8.5a.75.75 0 0 1 0 1.5h-8.5a.75.75 0 0 1 0-1.5ZM2.5 7.75v6a.75.75 0 0 1-1.5 0v-6a.75.75 0 0 1 1.5 0Z"></path>
                </svg>
            </div>
        </Tooltip>,
        code: <Tooltip title={"Code (ctrl+shift+C)"} disableInteractive>
            <div className="toolItem code" onClick={() => setCodeTrig(codeTrig + 1)}>
                <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" className="octicon octicon-code Button-visual">
                    <path d="m11.28 3.22 4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.749.749 0 0 1-1.275-.326.749.749 0 0 1 .215-.734L13.94 8l-3.72-3.72a.749.749 0 0 1 .326-1.275.749.749 0 0 1 .734.215Zm-6.56 0a.751.751 0 0 1 1.042.018.751.751 0 0 1 .018 1.042L2.06 8l3.72 3.72a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215L.47 8.53a.75.75 0 0 1 0-1.06Z"></path>
                </svg>
            </div>
        </Tooltip>,
        link: <Tooltip title={"Link (ctrl+K)"} disableInteractive>
            <div className="toolItem link" onClick={() => setLinkTrig(linkTrig + 1)}>
                <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" className="octicon octicon-link Button-visual">
                    <path d="m7.775 3.275 1.25-1.25a3.5 3.5 0 1 1 4.95 4.95l-2.5 2.5a3.5 3.5 0 0 1-4.95 0 .751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018 1.998 1.998 0 0 0 2.83 0l2.5-2.5a2.002 2.002 0 0 0-2.83-2.83l-1.25 1.25a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042Zm-4.69 9.64a1.998 1.998 0 0 0 2.83 0l1.25-1.25a.751.751 0 0 1 1.042.018.751.751 0 0 1 .018 1.042l-1.25 1.25a3.5 3.5 0 1 1-4.95-4.95l2.5-2.5a3.5 3.5 0 0 1 4.95 0 .751.751 0 0 1-.018 1.042.751.751 0 0 1-1.042.018 1.998 1.998 0 0 0-2.83 0l-2.5 2.5a1.998 1.998 0 0 0 0 2.83Z"></path>
                </svg>
            </div>
        </Tooltip>,
        orderedList: <Tooltip title={"Ordered list (ctrl+shift+O)"} disableInteractive>
            <div className="toolItem orderedList" onClick={() => setOrderedListTrig(orderedListTrig + 1)}>
                <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" className="octicon octicon-list-ordered Button-visual">
                    <path d="M5 3.25a.75.75 0 0 1 .75-.75h8.5a.75.75 0 0 1 0 1.5h-8.5A.75.75 0 0 1 5 3.25Zm0 5a.75.75 0 0 1 .75-.75h8.5a.75.75 0 0 1 0 1.5h-8.5A.75.75 0 0 1 5 8.25Zm0 5a.75.75 0 0 1 .75-.75h8.5a.75.75 0 0 1 0 1.5h-8.5a.75.75 0 0 1-.75-.75ZM.924 10.32a.5.5 0 0 1-.851-.525l.001-.001.001-.002.002-.004.007-.011c.097-.144.215-.273.348-.384.228-.19.588-.392 1.068-.392.468 0 .858.181 1.126.484.259.294.377.673.377 1.038 0 .987-.686 1.495-1.156 1.845l-.047.035c-.303.225-.522.4-.654.597h1.357a.5.5 0 0 1 0 1H.5a.5.5 0 0 1-.5-.5c0-1.005.692-1.52 1.167-1.875l.035-.025c.531-.396.8-.625.8-1.078a.57.57 0 0 0-.128-.376C1.806 10.068 1.695 10 1.5 10a.658.658 0 0 0-.429.163.835.835 0 0 0-.144.153ZM2.003 2.5V6h.503a.5.5 0 0 1 0 1H.5a.5.5 0 0 1 0-1h.503V3.308l-.28.14a.5.5 0 0 1-.446-.895l1.003-.5a.5.5 0 0 1 .723.447Z"></path>
                </svg>
            </div>
        </Tooltip>,
        unorderedList: <Tooltip title={"Bulletted list (ctrl+shift+U)"} disableInteractive>
            <div className="toolItem unorderedList" onClick={() => setUnorderedListTrig(unorderedListTrig + 1)}>
                <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" className="octicon octicon-list-unordered Button-visual">
                    <path d="M5.75 2.5h8.5a.75.75 0 0 1 0 1.5h-8.5a.75.75 0 0 1 0-1.5Zm0 5h8.5a.75.75 0 0 1 0 1.5h-8.5a.75.75 0 0 1 0-1.5Zm0 5h8.5a.75.75 0 0 1 0 1.5h-8.5a.75.75 0 0 1 0-1.5ZM2 14a1 1 0 1 1 0-2 1 1 0 0 1 0 2Zm1-6a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM2 4a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z"></path>
                </svg>
            </div>
        </Tooltip>,
        attachFiles: <Tooltip title={"Attach file (ctrl+shift+A)"} disableInteractive>
            <div className="toolItem attachFiles" onClick={() => setAttachFilesTrig(attachFilesTrig + 1)}>
                <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" className="octicon octicon-paperclip Button-visual">
                    <path d="M12.212 3.02a1.753 1.753 0 0 0-2.478.003l-5.83 5.83a3.007 3.007 0 0 0-.88 2.127c0 .795.315 1.551.88 2.116.567.567 1.333.89 2.126.89.79 0 1.548-.321 2.116-.89l5.48-5.48a.75.75 0 0 1 1.061 1.06l-5.48 5.48a4.492 4.492 0 0 1-3.177 1.33c-1.2 0-2.345-.487-3.187-1.33a4.483 4.483 0 0 1-1.32-3.177c0-1.195.475-2.341 1.32-3.186l5.83-5.83a3.25 3.25 0 0 1 5.553 2.297c0 .863-.343 1.691-.953 2.301L7.439 12.39c-.375.377-.884.59-1.416.593a1.998 1.998 0 0 1-1.412-.593 1.992 1.992 0 0 1 0-2.828l5.48-5.48a.751.751 0 0 1 1.042.018.751.751 0 0 1 .018 1.042l-5.48 5.48a.492.492 0 0 0 0 .707.499.499 0 0 0 .352.154.51.51 0 0 0 .356-.154l5.833-5.827a1.755 1.755 0 0 0 0-2.481Z"></path>
                </svg>
            </div>
        </Tooltip>,
        mention: <Tooltip title={"Mention (ctrl+M)"} disableInteractive>
            <div className="toolItem mention" onClick={() => setMentionTrig(mentionTrig + 1)}>
                <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" className="octicon octicon-mention Button-visual">
                    <path d="M4.75 2.37a6.501 6.501 0 0 0 6.5 11.26.75.75 0 0 1 .75 1.298A7.999 7.999 0 0 1 .989 4.148 8 8 0 0 1 16 7.75v1.5a2.75 2.75 0 0 1-5.072 1.475 3.999 3.999 0 0 1-6.65-4.19A4 4 0 0 1 12 8v1.25a1.25 1.25 0 0 0 2.5 0V7.867a6.5 6.5 0 0 0-9.75-5.496ZM10.5 8a2.5 2.5 0 1 0-5 0 2.5 2.5 0 0 0 5 0Z"></path>
                </svg>
            </div>
        </Tooltip>,
        reference: <Tooltip title={"Wiki reference (ctrl+shift+R)"} disableInteractive>
            <div className="toolItem reference" onClick={() => setReferenceTrig(referenceTrig + 1)}>
                <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" className="octicon octicon-cross-reference Button-visual">
                    <path d="M2.75 3.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h2a.75.75 0 0 1 .75.75v2.19l2.72-2.72a.749.749 0 0 1 .53-.22h4.5a.25.25 0 0 0 .25-.25v-2.5a.75.75 0 0 1 1.5 0v2.5A1.75 1.75 0 0 1 13.25 13H9.06l-2.573 2.573A1.458 1.458 0 0 1 4 14.543V13H2.75A1.75 1.75 0 0 1 1 11.25v-7.5C1 2.784 1.784 2 2.75 2h5.5a.75.75 0 0 1 0 1.5ZM16 1.25v4.146a.25.25 0 0 1-.427.177L14.03 4.03l-3.75 3.75a.749.749 0 0 1-1.275-.326.749.749 0 0 1 .215-.734l3.75-3.75-1.543-1.543A.25.25 0 0 1 11.604 1h4.146a.25.25 0 0 1 .25.25Z"></path>
                </svg>
            </div>
        </Tooltip>,
        indent: <Tooltip title={"Indent (ctrl+])"} disableInteractive>
            <div className="toolItem indent" onClick={() => setIndentTrig(indentTrig + 1)}>
                <FormatIndentDecreaseIcon />
            </div>
        </Tooltip>,
        outdent: <Tooltip title={"Outdent (ctrl+[)"} disableInteractive>
            <div className="toolItem outdent" onClick={() => setOutdentTrig(outdentTrig + 1)}>
                <FormatIndentIncreaseIcon />
            </div>
        </Tooltip>,
        underline: <Tooltip title={"Underline (ctrl+U)"} disableInteractive>
            <div className="toolItem underline" onClick={() => setUnderlineTrig(underlineTrig + 1)}>
                <FormatUnderlinedIcon />
            </div>
        </Tooltip>,
        strikethrough: <Tooltip title={"Strikethrough (ctrl+shift+S)"} disableInteractive>
            <div className="toolItem strikethrough" onClick={() => setStrikethroughTrig(strikethroughTrig + 1)}>
                <StrikethroughSIcon />
            </div>
        </Tooltip>,
        abcjs: <Tooltip title={"Insert ABC music notation"} disableInteractive>
            <div className="toolItem abcjs" onClick={() => setAbcjsTrig(abcjsTrig + 1)}>
                {gIconMap.MusicNote()}
            </div>
        </Tooltip>,
        specialCharacter: <>
            <Tooltip title={"Insert special character"} disableInteractive>
                <div
                    className="toolItem specialCharacter"
                    onClick={(event: React.MouseEvent<HTMLElement>) => {
                        setSpecialCharacterMenuOpen(!specialCharacterMenuOpen);
                        setSpecialCharacterMenuAnchorEl(event.currentTarget);
                    }}
                >
                    <EmojiSymbolsIcon />
                </div>
            </Tooltip>
            {specialCharacterMenuOpen && <SpecialCharacterDropdown
                onSelect={(ch) => {
                    setSpecialCharacterMenuOpen(false);
                    setSpecialCharacter(ch);
                    setSpecialCharacterTrig(specialCharacterTrig + 1);
                }}
                anchorEl={specialCharacterMenuAnchorEl}
                onClose={() => setSpecialCharacterMenuOpen(false)}
            />}
        </>,
    };

    const editorContainerStyle: React.CSSProperties = editorIsVisible ? {} : {
        visibility: "hidden",
        position: "absolute",
    }

    if (readonly) {
        return <pre>{props.value}</pre>
    }

    return <div className="MD3 editor MD3Container">
        <div className="header">
            {/* <div className="toolbar">
                <div className={`tab write freeButton ${tab === "write" ? "selected" : "notselected"}`} onClick={() => changeTab("write")}>Write</div>
                <div className={`tab preview freeButton ${tab === "preview" ? "selected" : "notselected"}`} onClick={() => changeTab("preview")}>Preview</div>
                <div className={`tab  freeButton ${tab === "sidebyside" ? "selected" : "notselected"}`} onClick={() => changeTab("sidebyside")}>Side-by-side</div>
            </div> */}
            {editorIsVisible && <>
                <div className='toolbar toolBarRow toolBarRow1'>
                    {toolItems.bold}
                    {toolItems.italic}
                    {toolItems.underline}
                    {toolItems.strikethrough}

                    <div className="divider" />

                    {toolItems.orderedList}
                    {toolItems.unorderedList}
                    {toolItems.indent}
                    {toolItems.outdent}

                    <div className="divider" />
                    <div className='flex-spacer' />

                    <div
                        className={`tab preview freeButton ${showFormattingTips ? "selected" : "notselected"}`}
                        onClick={() => setShowFormattingTips(!showFormattingTips)}
                    >
                        {showFormattingTips ? "Hide formatting tips" : "Show formatting tips"}
                    </div>
                    {/* <a href="/backstage/wiki/markdown-help" target="_blank">{gIconMap.Launch()} Formatting help</a> */}
                </div>

                <div className='toolbar toolBarRow'>

                    {toolItems.heading}
                    {toolItems.quote}
                    {toolItems.code}
                    <div className="divider" />

                    {toolItems.abcjs}
                    {toolItems.specialCharacter}
                    <div className="divider" />

                    {toolItems.mention}
                    {toolItems.reference}
                    {toolItems.link}
                    {toolItems.attachFiles}
                </div>

                <Collapse in={showFormattingTips}>
                    <div className='toolbar toolBarRow formattingTipsRow'>
                        {/* <Lightbulb /> */}
                        {/* {gIconMap.Info()} */}
                        {M3TipsTabValues.map((tabName) =>
                            <div key={tabName}
                                className={`freeButton ${tipsTab === tabName ? "selected" : "notselected"}`}
                                onClick={() => setTipsTab(tipsTab === tabName ? null : tabName)}
                            >
                                {tabName}
                            </div>)}
                        <div className='flex-spacer' />
                    </div>

                    <Collapse in={tipsTab === "Character"}>
                        <div className='toolbar toolBarRow formattingTipsContentRow'>
                            <dl>
                                <dt><span className='highlight'>Bold</span>: Use double asterisks or double underscores around the text</dt>
                                <dd>
                                    <Pre>**bold text** or __bold text__</Pre>
                                </dd>

                                <dt><span className='highlight'>Italic</span>: Use single asterisk or single underscore</dt>
                                <dd>

                                    <Pre>*italic text* or _italic text_</Pre>
                                </dd>

                                <dt><span className='highlight'>Headings</span>: Prefix a line with hashes (1–6)</dt>
                                <dd>
                                    <Pre># Heading 1</Pre>
                                    <Pre>## Heading 2</Pre>
                                    <Pre>### Heading 3</Pre>
                                </dd>
                                {/* 
                                <dt><span className='highlight'>Bold &amp; Italic</span>: Use triple asterisks or triple underscores</dt>
                                <dd>
                                    <Pre>***bold &amp; italic*** or ___bold &amp; italic___</Pre>
                                </dd>

                                <dt><span className='highlight'>Strikethrough</span>: Use double tildes</dt>
                                <dd>
                                    <Pre>~~strikethrough~~</Pre>
                                </dd> */}

                                <dt><span className='highlight'>Highlight</span>: yellow, red, green, blue are supported</dt>
                                <dd>
                                    <Pre>{`{{highlight:this text is yellow}}`}</Pre>
                                    <Pre>{`{{highlightgreen:this text is green}}`}</Pre>
                                    <Pre>{`{{highlightblue:this text is blue}}`}</Pre>
                                    <Pre>{`{{highlightred:this text is red}}`}</Pre>
                                </dd>

                                <dt><span className='highlight'>Enclosure</span></dt>
                                <dd>
                                    <Pre>Cut from rehearsal mark {`{{enclosed:D}}`} to {`{{enclosed:F}}`}</Pre>
                                </dd>

                            </dl>
                        </div>
                    </Collapse>


                    <Collapse in={tipsTab === "Paragraph"}>
                        <div className='toolbar toolBarRow formattingTipsContentRow'>
                            <dl>
                                <dt><span className='highlight'>Headings</span>: Prefix a line with hashes (1–6)</dt>
                                <dd>
                                    <Pre># Heading 1</Pre>
                                    <Pre>## Heading 2</Pre>
                                    <Pre>### Heading 3</Pre>
                                </dd>

                                {/* Inline Code */}
                                <dt>
                                    <span className="highlight">Code (Inline)</span>: Use single backticks
                                </dt>
                                <dd>
                                    <Pre>`inline code`</Pre>
                                </dd>

                                {/* Block Code */}
                                <dt>
                                    <span className="highlight">Code (Block)</span>: Use triple backticks
                                    on separate lines.
                                </dt>
                                <dd>
                                    <Pre text={`\`\`\`
const example = 'Hello, world!';
console.log(example);
\`\`\``} />
                                </dd>

                                {/* Block Quotes */}
                                <dt>
                                    <span className="highlight">Block Quotes</span>: Use the &quot;&gt;&quot;
                                    character before each line
                                </dt>
                                <dd>
                                    <Pre text={`> This is a quote
> spanning multiple lines.`} />
                                </dd>



                                <dt>
                                    <span className="highlight">Paragraphs</span>: Separate paragraphs with a blank line
                                </dt>
                                <dd>
                                    <Pre
                                        text={`This is paragraph one, and this
continues to be paragraph one.

But this is a new paragraph.`}
                                    />
                                </dd>

                                <dt>
                                    <span className="highlight">Horizontal Rule</span>: Use three or more dashes on a line by themselves
                                </dt>
                                <dd>
                                    <Pre text="---" />
                                </dd>


                            </dl>
                        </div>
                    </Collapse>

                    <Collapse in={tipsTab === "Lists"}>
                        <div className="toolbar toolBarRow formattingTipsContentRow">
                            <dl>
                                {/* Unordered Lists */}
                                <dt>
                                    <span className="highlight">Unordered Lists</span>: Start each item with
                                    <code> - </code>, <code> * </code>, or <code> + </code>
                                </dt>
                                <dd>
                                    <Pre
                                        text={`- First item
- Second item
- Third item`}
                                    />
                                </dd>

                                {/* Ordered Lists */}
                                <dt>
                                    <span className="highlight">Ordered Lists</span>: Number each item in sequence
                                </dt>
                                <dd>
                                    <Pre
                                        text={`1. First item
2. Second item
3. Third item`}
                                    />
                                </dd>

                                {/* Nested Lists */}
                                <dt>
                                    <span className="highlight">Nested Lists</span>: Indent sub-items
                                </dt>
                                <dd>
                                    <Pre
                                        text={`- Parent item
  - Child item
  - Child item
- Parent item
  - Child item`}
                                    />
                                </dd>
                            </dl>
                        </div>
                    </Collapse>

                    <Collapse in={tipsTab === "Tables"}>
                        <div className="toolbar toolBarRow formattingTipsContentRow">
                            <dl>
                                {/* Basic Table */}
                                <dt>
                                    <span className="highlight">Tables</span>: Use the pipe <code>|</code>
                                    and dash <code>-</code> characters to form a table
                                </dt>
                                <dd>
                                    <Pre
                                        text={`| Column A | Column B |
|----------|----------|
| Row 1A   | Row 1B   |
| Row 2A   | Row 2B   |`}
                                    />
                                </dd>

                                {/* Column Alignment */}
                                <dt>
                                    <span className="highlight">Column Alignment</span>: Use colons
                                    (<code>:</code>) to align text in columns
                                </dt>
                                <dd>
                                    <Pre
                                        text={`| Left | Center | Right |
|:-----|:------:|------:|
| L1   | C1     | R1    |
| L2   | C2     | R2    |`}
                                    />
                                </dd>
                            </dl>
                        </div>
                    </Collapse>


                    <Collapse in={tipsTab === "Links"}>
                        <div className="toolbar toolBarRow formattingTipsContentRow">
                            <dl>
                                {/* Site Mentions */}
                                <dt>
                                    <span className="highlight">Link to Songs, Events, or Wiki Pages</span>:
                                    Type <code>@</code> then start typing
                                </dt>
                                <dd>
                                    When you type <code>@</code> in the editor and continue typing, you'll
                                    see suggestions to link a song, event, or wiki page. Selecting one
                                    inserts a link in this format:
                                    <Pre text={`[[song:82|It's Now Or Never (2005)]]`} />
                                </dd>

                                {/* Wiki Pages */}
                                <dt>
                                    <span className="highlight">Wiki Pages (Manually)</span>: Use double
                                    brackets
                                </dt>
                                <dd>
                                    You can manually create wiki links with or without a custom caption:
                                    <Pre
                                        text={`[[my wiki page]]
[[my wiki page|custom caption]]`}
                                    />
                                </dd>

                                {/* Standard URLs */}
                                <dt>
                                    <span className="highlight">Regular URLs</span>
                                </dt>
                                <dd>
                                    Regular web URLs are automatically converted to links:
                                    <Pre text="https://example.com" />
                                    You can also customize the text to the link:
                                    <Pre text="[Link Text](https://example.com)" />
                                </dd>
                            </dl>
                        </div>
                    </Collapse>


                    <Collapse in={tipsTab === "Images"}>
                        <div className="toolbar toolBarRow formattingTipsContentRow">
                            <dl>
                                {/* Insert Images */}
                                <dt>
                                    <span className="highlight">Inserting Images</span>: Drag &amp; drop or paste
                                    images directly into the editor
                                </dt>
                                <dd>
                                    <Pre
                                        text={`![alt text](/path/to/image.jpg)`}
                                    />
                                </dd>

                                {/* Resizing Images */}
                                <dt>
                                    <span className="highlight">Specify size</span>: Append a maximum dimension like <code>?300</code> to the URL
                                </dt>
                                <dd>
                                    Set the image’s maximum dimension (width or height) in pixels in this way.
                                    <Pre
                                        text={`![alt text](/path/to/image.jpg?400)`}
                                    />
                                </dd>
                            </dl>
                        </div>
                    </Collapse>



                    <Collapse in={tipsTab === "Attachments"}>
                        <div className="toolbar toolBarRow formattingTipsContentRow">
                            <dl>
                                {/* Insert Images */}
                                <dt>
                                    <span className="highlight">Inserting attachments</span>
                                </dt>
                                <dd>
                                    Drag &amp; drop or paste
                                    files directly into the editor. They will be made available as a clickable link to download.
                                    The generated link will look like:
                                    <Pre
                                        text={`[Meeting notes.pdf](/api/files/download/EjuATs-a13.pdf)`}
                                    />
                                </dd>

                            </dl>
                        </div>
                    </Collapse>



                    <Collapse in={tipsTab === "Music notation"}>
                        <div className="toolbar toolBarRow formattingTipsContentRow">
                            <dl>
                                {/* ABC Music Notation */}
                                <dt>
                                    <span className="highlight">ABC Notation</span>
                                </dt>
                                <dd>
                                    You can write ABC music notation inside a code block labeled
                                    with <code>abc</code>. For example:
                                    <Pre
                                        text={`\`\`\`abc
M:4/4
K:C#min
C3D EF=G_A | ^Bc
\`\`\``}
                                    />
                                    <div><img src="/images/abc_example_1.png" /></div>
                                    For more info about ABC notation,&nbsp;
                                    <a href="https://abcnotation.com/examples" target='_blank' rel="noreferrer">
                                        visit the website</a>.
                                </dd>
                            </dl>
                        </div>
                    </Collapse>



                </Collapse>
            </>
            }
        </div>
        <div className={`content tab_${tab}`} ref={setPopoverAnchorEl}>
            <div className="editorContainer" style={editorContainerStyle}>
                <MarkdownEditor
                    onValueChanged={props.onChange}
                    onSave={props.onSave}
                    nominalHeight={props.nominalHeight}
                    value={props.value}
                    autoFocus={autoFocus}
                    headingTrig={headingTrig}
                    boldTrig={boldTrig}
                    italicTrig={italicTrig}
                    quoteTrig={quoteTrig}
                    codeTrig={codeTrig}
                    linkTrig={linkTrig}
                    orderedListTrig={orderedListTrig}
                    unorderedListTrig={unorderedListTrig}
                    attachFilesTrig={attachFilesTrig}
                    mentionTrig={mentionTrig}
                    referenceTrig={referenceTrig}
                    indentTrig={indentTrig}
                    outdentTrig={outdentTrig}
                    underlineTrig={underlineTrig}
                    strikethroughTrig={strikethroughTrig}
                    refocusTrig={refocusTrig}
                    abcjsTrig={abcjsTrig}
                    specialCharacterTrig={specialCharacterTrig}
                    specialCharacter={specialCharacter}
                />
                {/* <div>
                    <span className="helpText">
                        <a href="/backstage/wiki/markdown-help" target="_blank">{gIconMap.Launch()} Formatting help</a>
                    </span>
                </div> */}
            </div>
            {tab === "preview" &&
                <div className="previewContainer">
                    <Markdown markdown={props.value} />
                </div>
            }
            {tab === "sidebyside" && !IsNullOrWhitespace(props.value) &&
                <div className="previewContainer">
                    <div className='previewTitle'>Preview</div>
                    <div className='previewMarkdownContainer hatch'>
                        <Markdown markdown={props.value} />
                    </div>
                </div>
                // <Popper
                //     open={true}
                //     placement='right-start'
                //     anchorEl={popoverAnchorEl}
                // >
                //     <div className="markdownSideBySideContainer">
                //         <div className="previewContainer">
                //             <Markdown markdown={props.value} />
                //         </div>
                //     </div>
                // </Popper>
            }
        </div>

    </div >;
};


