import { Button, Menu, MenuItem, SvgIcon, Tooltip } from "@mui/material";
import React from "react";
import { IsNullOrWhitespace } from "shared/utils";
import { MarkdownEditorCommandApi, MarkdownTokenContext } from "./MarkdownEditorCommandBase";



export function CMHighlightIcon(props) {
    return (
        <SvgIcon {...props} viewBox="0 0 24 24">
            <path d="M20.707 5.826l-3.535-3.533a.999.999 0 0 0-1.408-.006L7.096 10.82a1.01 1.01 0 0 0-.273.488l-1.024 4.437L4 18h2.828l1.142-1.129 3.588-.828c.18-.042.345-.133.477-.262l8.667-8.535a1 1 0 0 0 .005-1.42ZM11.338 13.659l-2.121-2.12 7.243-7.131 2.12 2.12-7.242 7.131ZM4 20h16v2H4z" />
        </SvgIcon>
    );
}

//////////////////////////////////////////////////
interface ToolitemDropdownProps {
    anchorEl: HTMLElement | null;
    onClose: () => void;
    children?: React.ReactNode;
}

const ToolitemDropdown: React.FC<ToolitemDropdownProps> = ({ anchorEl, onClose, children }) => {
    return <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={onClose} className='markdown'>
        {children}
    </Menu>;
};

interface ToolItemWithDropdownProps {
    tooltip: string;
    icon: React.ReactNode;
    setCloseMenuProc: (proc: () => void) => void;
};

const ToolItemWithDropdown = (props: React.PropsWithChildren<ToolItemWithDropdownProps>) => {
    const [anchorEl, setAnchorEl] = React.useState<HTMLElement | null>(null);

    const closeMenu = () => {
        setAnchorEl(null);
        props.setCloseMenuProc(() => () => { });
    };

    return <>
        <Tooltip title={props.tooltip} disableInteractive>
            <div className="toolItem" onClick={(e) => {
                props.setCloseMenuProc(closeMenu);
                setAnchorEl(e.currentTarget);
            }}>
                {props.icon}
            </div>
        </Tooltip>
        <ToolitemDropdown anchorEl={anchorEl} onClose={() => setAnchorEl(null)}>
            {props.children}
        </ToolitemDropdown>
    </>;
};


//////////////////////////////////////////////////
export interface SurroundTextCommandSpec {
    prefix: string;
    suffix: string;
    textIfNoSelection: string;
    menuItemLabel: React.ReactNode;
};

interface SurroundTextToolItemWithDropdownProps {
    api: MarkdownEditorCommandApi;
    tooltip: string;
    icon: React.ReactNode;
    commands: SurroundTextCommandSpec[];
};

export const SurroundTextToolItemWithDropdown = (props: React.PropsWithChildren<SurroundTextToolItemWithDropdownProps>) => {
    const [endMenuProc, setEndMenuProc] = React.useState<() => void>(() => () => { });

    return <ToolItemWithDropdown tooltip={props.tooltip} icon={props.icon} setCloseMenuProc={proc => setEndMenuProc(() => proc)}>
        {props.commands.map((command, index) => <MenuItem
            key={index}
            onClick={async () => {
                await props.api.controlledTextArea.surroundSelectionWithText(command.prefix, command.suffix, command.textIfNoSelection);
                endMenuProc();
            }}
            dense
        >
            {command.menuItemLabel}
        </MenuItem>)}
    </ToolItemWithDropdown >
}



//////////////////////////////////////////////////
export interface SpecialCharactersSpec {
    category: string;
    symbols: string[];
};

interface InsertSpecialCharacterToolItemWithDropdownProps {
    api: MarkdownEditorCommandApi;
    tooltip: string;
    icon: React.ReactNode;
    categoriesAndCharacters: SpecialCharactersSpec[];
};

export const InsertSpecialCharacterToolItemWithDropdown = (props: React.PropsWithChildren<InsertSpecialCharacterToolItemWithDropdownProps>) => {
    const [endMenuProc, setEndMenuProc] = React.useState<() => void>(() => () => { });

    return <ToolItemWithDropdown tooltip={props.tooltip} icon={props.icon} setCloseMenuProc={proc => setEndMenuProc(() => proc)}>
        {props.categoriesAndCharacters.map((category) => (
            <div key={category.category}>
                {!IsNullOrWhitespace(category.category) && <MenuItem disabled dense>{category.category}</MenuItem>}
                {category.symbols.map((symbol, i) => (
                    <MenuItem key={i} onClick={async () => {
                        await props.api.controlledTextArea.replaceSelectionWithText(symbol, { select: "afterChange" });
                        endMenuProc();
                    }} dense>
                        {symbol}
                    </MenuItem>
                ))}
            </div>
        ))}
    </ToolItemWithDropdown >
}





//////////////////////////////////////////////////
// a toolbar item base
interface MarkdownEditorToolbarItemProps {
    tooltip: string;
    icon: React.ReactNode;
    className?: string;
    onClick?: (e: React.MouseEvent<HTMLElement>) => void;
};

export const MarkdownEditorToolbarItem = (props: React.PropsWithChildren<MarkdownEditorToolbarItemProps>) => {
    return <><Tooltip title={props.tooltip} disableInteractive>
        <div className={`toolItem ${props.className ? " " + props.className : ""}`} onClick={props.onClick}>
            {props.icon}
        </div>
    </Tooltip>
        {props.children}
    </>;
};




////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export interface ParsedMarkdownReference {
    isReference: boolean;
    slug: string;      // empty if not a reference
    caption: string;   // empty if not a reference
}

/**
 * Parses text for a potential Markdown-style reference:
 *   - "not a reference" -> { isReference: false, slug: "", caption: "" }
 *   - "[[reference_slug]]" -> { isReference: true, slug: "reference_slug", caption: "reference_slug" }
 *   - "[[reference_slug|custom caption]]" -> { isReference: true, slug: "reference_slug", caption: "custom caption" }
 */
export function parseMarkdownReference(text: string): ParsedMarkdownReference {
    // Pattern explanation:
    //   ^             start of string
    //   \[\[          literal [[
    //   ([^|\]]+)     capture group for slug (one or more characters until '|' or ']')
    //   (?:\|([^\]]+))?   optional: `|` then capture group for the custom caption (one or more characters until ']')
    //   \]\]          literal ]]
    //   $             end of string
    const pattern = /^\[\[([^|\]]+)(?:\|([^\]]+))?\]\]$/;
    const match = text.match(pattern);

    if (!match) {
        // Not a reference
        return {
            isReference: false,
            slug: "",
            caption: "",
        };
    }

    // If matched, extract groups
    const slug = match[1]!.trim();
    const caption = match[2] ? match[2].trim() : "";//slug;

    return {
        isReference: true,
        slug,
        caption,
    };
}


// if you want to trim surrounding whitespace, make sure your regex pattern has the \s* at the start and end of the regex. this is not done by default because it would be too slow for large text areas.
export function GetMatchUnderSelection(text: string, selectionStart: number, selectionEnd: number, regexPattern: RegExp, options?: { trimSurroundingWhitespace?: boolean }): undefined | MarkdownTokenContext {
    // does the current selection land entirely within a mention (or exactly encapulates one?)
    // to do this, use a regex to find all occurrences of mentions in the text, and check if the current selection is within one of them.
    const matches = [...text.matchAll(regexPattern)];
    if (matches.length === 0) {
        //console.log(`not in a mention because none exist [${selectionStart},${selectionEnd}]`);
        return undefined;
    }
    // now check if the current selection is within one of the matches
    for (const match of matches) {
        const matchText = match[0]!;
        let matchStart = match.index!;
        let matchEnd = matchStart + matchText.length;
        if (selectionStart >= matchStart && selectionEnd <= matchEnd) {
            // if trimSurroundingWhitespace is true, trim the matchStart and matchEnd to the first non-whitespace character.
            if (options?.trimSurroundingWhitespace) {
                // trim matchStart.
                const matchTextWithTrimmedStart = matchText.trimStart();
                matchStart += matchText.length - matchTextWithTrimmedStart.length;
                const matchTextWithTrimmedEnd = matchTextWithTrimmedStart.trimEnd();
                matchEnd -= matchTextWithTrimmedStart.length - matchTextWithTrimmedEnd.length;
            }
            return {
                start: matchStart,
                end: matchEnd,
            };
        }
    }
    return undefined;
}

// in the dialogs, enter key is not working properly so this wrapper hacks it up.
export const MuiButtonWithEnterHandler = (props) => <Button {...props} onKeyDown={(e) => {
    // but actually this doesn't work either; this soemitmes does a double-invoke.
    // if (e.key === "Enter") {
    //     e.stopPropagation();
    //     props.onClick(e);
    // }
}} />;
