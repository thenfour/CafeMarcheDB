import { Collapse } from "@mui/material";
import React from "react";
import { Pre } from "../CMCoreComponents2";


const M3TipsTabValues = [
    "Character",
    "Paragraph",
    "Lists",
    "Tables",
    "Links",
    "Images",
    "Attachments",
] as const;

// 2. Derive a type from that array
type M3TipsTab = (typeof M3TipsTabValues)[number];


export const MarkdownEditorFormattingTips = (props: { in: boolean }) => {
    const [tipsTab, setTipsTab] = React.useState<M3TipsTab | null>(null);
    return <Collapse in={props.in}>
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

                    {/* Copy from file menu */}
                    <dt>
                        <span className="highlight">Copy link from existing files</span>
                    </dt>
                    <dd>
                        For files already uploaded to the system, you can copy the markdown link syntax directly.
                        In any file list, click the ⋮ menu next to a file and select "Copy markdown link"
                        to get the properly formatted link that you can paste here.
                    </dd>

                </dl>
            </div>
        </Collapse>


    </Collapse>;
};