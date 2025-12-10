import { BlitzPage } from "@blitzjs/next";
import { useQuery } from "@blitzjs/rpc";
import { Divider } from "@mui/material";
import { Prisma } from "db";
import * as mime from 'mime';
import React from "react";
import { Permission } from "shared/permissions";
import { slugify, unslugify } from "shared/rootroot";
import { Timing } from "shared/time";
import { IsNullOrWhitespace, getEnumValues, isInternalUrl, parseMimeType } from "shared/utils";
import { useCurrentUser } from "src/auth/hooks/useCurrentUser";
import { CMChip, CMChipContainer } from "src/core/components/CMChip";
import { CMSinglePageSurfaceCard } from "src/core/components/CMCoreComponents";
import { InspectObject, KeyValueDisplay, KeyValueTable, NameValuePair } from "src/core/components/CMCoreComponents2";
import { CMTextField, CMTextInputBase } from "src/core/components/CMTextField";
import { BigEventCalendar } from "src/core/components/EventCalendar";
import { Markdown3Editor } from "src/core/components/markdown/MarkdownControl3";
import { SongAutocomplete } from "src/core/components/SongAutocomplete";
import { WorkflowViewer } from "src/core/components/workflow/WorkflowEventComponents";
import { AssociationSelect } from "@/src/core/components/ItemAssociation";
import * as DB3Client from "src/core/db3/DB3Client";
import { RenderMuiIcon } from "src/core/db3/components/IconMap";
import { IconEditCell } from "src/core/db3/components/IconSelectDialog";
import * as db3 from "src/core/db3/db3";
import getDistinctChangeFilterValues from "src/core/db3/queries/getDistinctChangeFilterValues";
import { AutoAssignInstrumentPartition } from "src/core/db3/shared/apiTypes";
import DashboardLayout from "@/src/core/components/dashboard/DashboardLayout";
import { ChipFilterGroup, FilterControls } from "../../core/components/search/FilterControl";
import { arraysContainSameValues } from "shared/arrayUtils";
import { QuickSearchItemMatch, QuickSearchItemTypeSets } from "shared/quickFilter";
import { collectDeviceInfo } from "@/src/core/components/featureReports/activityTracking";
import AbcNotationRenderer from "@/src/core/components/AbcNotationRenderer";
import { QrTester } from "@/src/core/components/QrCode";
import { useDashboardContext } from "@/src/core/components/dashboardContext/DashboardContext";

interface FilterSpec {
    qfText: string;
    selectedEventTypeId: number | null;
    selectedSongTagIds: number[];
    selectedEventTagIds: number[];
    selectedTiming: Timing;
};

const FilterControlsTester = () => {
    const defaultFilter: FilterSpec = {
        qfText: "",
        selectedEventTypeId: null,
        selectedSongTagIds: [],
        selectedEventTagIds: [],
        selectedTiming: Timing.Present,
    };
    const [spec, setSpec] = React.useState<FilterSpec>(defaultFilter);
    const dashboardContext = useDashboardContext();

    const HasExtraFilters = (val: FilterSpec) => {
        if (!arraysContainSameValues(val.selectedSongTagIds, defaultFilter.selectedSongTagIds)) return true;
        if (!arraysContainSameValues(val.selectedEventTagIds, defaultFilter.selectedEventTagIds)) return true;
        return false;
    };

    const HasAnyFilters = (val: FilterSpec) => {
        // todo: what's the diff? refine the design.
        if (spec.qfText !== "") return true;
        if (spec.selectedEventTypeId) return true;
        return HasExtraFilters(val);
    };

    const primaryFilter = <ChipFilterGroup
        style="radio"
        selectedIds={[spec.selectedTiming]}
        items={getEnumValues(Timing).map(t => ({
            id: t as Timing,
            label: t,
            shape: "rectangle",
        }))}
        onChange={(newSel) => setSpec({ ...spec, selectedTiming: newSel[0]! })}
    />;

    const extraFilter = <>
        <div className="divider"></div>
        <ChipFilterGroup
            style="radiotoggle"
            selectedIds={spec.selectedEventTypeId ? [spec.selectedEventTypeId] : []}
            items={dashboardContext.eventType.map(t => ({
                id: t.id,
                label: <>{RenderMuiIcon(t.iconName)}{t.text}</>,
                shape: "rectangle",
                color: t.color,
            }))}
            onChange={(newSel) => setSpec({ ...spec, selectedEventTypeId: (newSel[0]! || null) })}
        />
        <ChipFilterGroup
            style="toggle"
            selectedIds={spec.selectedEventTagIds}
            items={dashboardContext.eventTag.map(t => ({
                id: t.id,
                label: t.text,
                color: t.color,
            }))}
            onChange={(newSel) => setSpec({ ...spec, selectedEventTagIds: newSel })}
        />
        <div className="divider"></div>

        <ChipFilterGroup
            style="toggle"
            selectedIds={spec.selectedSongTagIds}
            items={dashboardContext.songTag.map(t => ({
                id: t.id,
                label: t.text,
                color: t.color,
            }))}
            onChange={(newSel) => setSpec({ ...spec, selectedSongTagIds: newSel })}
        />
    </>;

    return <>
        <FilterControls
            quickFilterText={spec?.qfText}
            onQuickFilterChange={v => setSpec({ ...spec, qfText: v })}
            inCard={true}
            hasAnyFilters={HasAnyFilters(spec)}
            hasExtraFilters={HasExtraFilters(spec)}
            extraFilter={extraFilter}
            onResetFilter={() => setSpec(defaultFilter)}
            primaryFilter={primaryFilter}
        />
        <pre>{JSON.stringify(spec, null, 2)}</pre>
    </>;
};




const AutoAssignInstrumentTester = () => {
    const [text, setText] = React.useState<string>(`PaperSpaceships03-Accordion.pdf
    PaperSpaceships03-Alto Horn.pdf
    PaperSpaceships03-Baritone Sax.pdf
    PaperSpaceships03-Bass Clarinet.pdf
    PaperSpaceships03-Bass Guitar.pdf
    PaperSpaceships03-Cello.pdf
    PaperSpaceships03-Clarinet in Bb.pdf
    PaperSpaceships03-Flute.pdf
    PaperSpaceships03-Glockenspiel.pdf
    PaperSpaceships03-Guitar.pdf
    PaperSpaceships03-Percussion_ Drums+Djembe.pdf
    PaperSpaceships03-Percussion_ Shaker+Guiro.pdf
    PaperSpaceships03-Piano.pdf
    PaperSpaceships03-Tenor Sax.pdf
    PaperSpaceships03-Trombone.pdf
    PaperSpaceships03-Trumpet in Bb.pdf
    PaperSpaceships03-Tuba.pdf
    PaperSpaceships03-Viola.pdf
    PaperSpaceships03-Violin.pdf
    paperspaceships07x - E-Hangdrum.pdf
    paperspaceships5x - Alto Sax.pdf`);

    const tableSpec = new DB3Client.xTableClientSpec({
        table: db3.xInstrument,
        columns: [
            new DB3Client.PKColumnClient({ columnName: "id" }),
            new DB3Client.GenericStringColumnClient({ columnName: "name", cellWidth: 200 }),
            new DB3Client.MarkdownStringColumnClient({ columnName: "description", cellWidth: 200 }),
            new DB3Client.GenericStringColumnClient({ columnName: "autoAssignFileLeafRegex", cellWidth: 200, fieldCaption: "Regex" }),
            new DB3Client.GenericIntegerColumnClient({ columnName: "sortOrder", cellWidth: 80 }),
            new DB3Client.ForeignSingleFieldClient<db3.InstrumentFunctionalGroupPayload>({ columnName: "functionalGroup", cellWidth: 200, }),
            new DB3Client.TagsFieldClient<db3.InstrumentTagAssociationPayload>({ columnName: "instrumentTags", cellWidth: 220, allowDeleteFromCell: false }),
        ],
    });

    const [currentUser] = useCurrentUser();

    const tableClient = DB3Client.useTableRenderContext({
        tableSpec,
        requestedCaps: DB3Client.xTableClientCaps.Query,
        clientIntention: { intention: "user", mode: 'primary', currentUser },
    });
    const allInstruments = tableClient.items as Prisma.InstrumentGetPayload<{}>[];

    const lines = text.split('\n').filter(l => !IsNullOrWhitespace(l));
    const results: { leaf: string, instruments: Prisma.InstrumentGetPayload<{}>[] }[] = [];

    const localStripExtension = (filename: string) => {
        const lastDotIndex = filename.lastIndexOf('.');
        if (lastDotIndex <= 0) return filename;
        return filename.substring(0, lastDotIndex);
    };

    for (let i = 0; i < lines.length; ++i) {
        const leaf = lines[i]!;
        const aaret = AutoAssignInstrumentPartition({
            fileLeafWithoutExtension: localStripExtension(leaf),
            allInstruments,
        });

        results.push({
            leaf,
            instruments: aaret.matchingInstrumentIds.map(iid => allInstruments.find(inst => inst.id === iid)!),
        });
    };


    return <div>
        <div>Input a leaf name, and i'll tell you which instruments i'd assign.</div>
        <div><textarea onChange={(e) => setText(e.target.value)} /></div>
        <div>
            <table>
                <thead>
                    <tr>
                        <th>leaf</th>
                        <th>instruments</th>
                    </tr>
                </thead>
                <tbody>
                    {results.map((r, i) => (
                        <tr key={i}>
                            <td>{r.leaf}</td>
                            <td>
                                {r.instruments.map(inst => (<div key={inst.id}>{inst.id} {inst.name}</div>))}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    </div>;
};

const MarkdownTester = () => {

    const markdownContent = `
# My Music Sheet

Here is some ABCjs music notation:

\`\`\`abc
X: 1
T: Scale
M: 4/4
L: 1/4
K: C
C D E F | G A B c |
\`\`\`

Another ABCjs block:

\`\`\`abc
X: 2
T: Another Scale
M: 4/4
L: 1/4
K: G
G A B c | d e f g |
\`\`\`

QR Code Examples:

Simple text QR: {{qr:Hello World!}}

Website QR: {{qr:url:https://github.com/thenfour/CafeMarcheDB}}

WiFi QR: {{qr:wifi:MyNetwork|WPA|password123}}
    `;


    const [text, setText] = React.useState<string>(markdownContent);
    return <div>
        <Markdown3Editor value={text} onChange={(v) => setText(v)} nominalHeight={250} />
    </div>
};


const EventCalendarTester = () => {
    return <BigEventCalendar selectedEventId={undefined} />
};


const ActivityLogValueViewerTester = () => {
    const [value, setValue] = React.useState<string>("");
    const [tableName, setTableName] = React.useState<string>("");
    const [filterSourceData, filterSourceDataOther] = useQuery(getDistinctChangeFilterValues, {});

    let obj: any = undefined;
    try {
        obj = JSON.parse(value);
    } catch (e) { }

    return <div>
        <CMTextField value={tableName} onChange={(e, v) => setTableName(v)} autoFocus={false} label="Table name" />
        <CMTextField value={value} onChange={(e, v) => setValue(v)} autoFocus={false} label="Value" multiline={true} />
        <div style={{ width: 350, border: "2px solid #0004" }}>
            <DB3Client.ActivityLogValueViewer tableName={tableName} value={obj} cacheData={filterSourceData} renderWorkflow={(workflowDef) => <WorkflowViewer value={workflowDef} />} />
        </div>
    </div>;
};


const AutoCompleteSongEventTester = () => {
    const [result, setResult] = React.useState<QuickSearchItemMatch | null>(null);
    return <AssociationSelect value={result} onChange={(v) => setResult(v)} allowedItemTypes={QuickSearchItemTypeSets.Everything!} />;
};


const InternalUriTester = () => {
    const [uri, setUri] = React.useState<string>("");
    return <NameValuePair name="Internal URI" value={
        <div>
            <CMTextField value={uri} onChange={(e, v) => setUri(v)} autoFocus={false} label="URI" />
            <pre>{isInternalUrl(uri) ? "Internal" : "External"}</pre>
        </div>
    } />
};


const ClientInfoTester = () => {

    const [info, setInfo] = React.useState<any>(null);

    React.useEffect(() => {
        void collectDeviceInfo().then((info) => {
            setInfo(info);
        });
    }, [])

    return <NameValuePair name="Client info" value={
        <>
            <InspectObject src={info} />
            <KeyValueTable data={info || {}} />
        </>
    } />
};


const AbcTester = () => {
    const [customNotation, setCustomNotation] = React.useState<string>(`a b c`);
    return <>
        <h2>ABC Notation Renderer</h2>
        <div>
            <p>Enter ABC notation below:</p>
            <textarea style={{ width: '100%', height: '100px' }} value={customNotation} onChange={(e) => setCustomNotation(e.target.value)} />

            <AbcNotationRenderer
                notation={customNotation}
                width={740}
                scale={1.0}
                style={{ marginTop: '20px', border: '1px solid #ccc', padding: '10px' }}
            />
        </div>
    </>;
};


const MainContent = () => {
    const [leaf, setLeaf] = React.useState<string>("");
    const [slugOrNot, setSlugOrNot] = React.useState<string>("");
    const [mimeTypeStr, setMimeTypeStr] = React.useState<string>("");
    const [songValue, setSongValue] = React.useState<db3.SongPayload | null>(null);

    const mimeType = (mime as any).getType(leaf); // requires a leaf only, for some reason explicitly fails on a full path.

    return <div>

        <QrTester />

        <AbcTester />

        <div>
            <a href="test/CMSelectTest">CMSelectTest.tsx</a>
        </div>
        <div>
            <a href="test/quickSearchTest">quickSearchTest.tsx</a>
        </div>

        <ClientInfoTester />

        <InternalUriTester />

        <AutoCompleteSongEventTester />

        <ActivityLogValueViewerTester />

        <EventCalendarTester />

        <CMSinglePageSurfaceCard>
            <div className="content">
                <MarkdownTester />
            </div>
        </CMSinglePageSurfaceCard>


        <CMSinglePageSurfaceCard>
            <div className="content">
                <FilterControlsTester />
            </div>
        </CMSinglePageSurfaceCard>


        <AutoAssignInstrumentTester />

        <CMSinglePageSurfaceCard>

            <h3>SongAutocomplete</h3>
            <div style={{ backgroundColor: "#c4c", padding: "10px" }}>
                <div style={{ backgroundColor: "white", padding: "10px" }}>
                    <SongAutocomplete
                        //index={0}
                        value={songValue}
                        onChange={(value) => setSongValue(value as any)}
                    />
                </div>
            </div>

            <KeyValueDisplay data={{
                id: (songValue?.id) || "<null>",
                name: (songValue?.name) || "<null>",
            }} />

        </CMSinglePageSurfaceCard>

        <NameValuePair
            isReadOnly={false}
            name="Leaf"
            value={<div>
                <CMTextInputBase value={leaf} onChange={(e, v) => setLeaf(v)} />
                <pre>Mime: {mimeType}</pre>
                <pre>{JSON.stringify(parseMimeType(mimeType), undefined, 2)}</pre>
            </div>}
        />

        <NameValuePair
            isReadOnly={false}
            name="Mime type"
            value={<div>
                <CMTextInputBase value={mimeTypeStr} onChange={(e, v) => setMimeTypeStr(v)} />
                <pre>{JSON.stringify(parseMimeType(mimeTypeStr))}</pre>
            </div>}
        />


        <Divider />
        <h2>CMCoreComponents</h2>

        <h3>CMSinglePageSurfaceCard</h3>
        <div>for elevating content on a page, or just use .contentSection / .header / .content</div>
        <CMSinglePageSurfaceCard>
            <div className="header">CMSinglePageSurfaceCard.header</div>
            <div className="content">CMSinglePageSurfaceCard.content</div>
        </CMSinglePageSurfaceCard>

        <Divider />

        <h3>CMChip</h3>
        <CMChipContainer>
            <CMChip color={"yes"} size="small" variation={{ enabled: false, selected: false, fillOption: "filled", variation: "strong" }}>(todo: all variations)</CMChip>
        </CMChipContainer>

        <h3>CMChip on surface </h3>
        <CMSinglePageSurfaceCard>
            <CMChipContainer>
                <CMChip color={"yes"} size="small" variation={{ enabled: false, selected: false, fillOption: "filled", variation: "strong" }}>(todo: all variations)</CMChip>
            </CMChipContainer>
        </CMSinglePageSurfaceCard>


        <h3>Icons</h3>
        <div>
            <IconEditCell validationError={null} onOK={() => { }} value={null} readonly={false} allowNull={true} />
        </div>


        <NameValuePair
            isReadOnly={false}
            name="Slugify"
            value={<div>
                <CMTextInputBase value={slugOrNot} onChange={(e, v) => setSlugOrNot(v)} />
                <pre>Slugify:          {slugify(slugOrNot)}</pre>
                <pre>Double slugify:   {slugify(slugify(slugOrNot))}</pre>
                <pre>Unslugify: {unslugify(slugOrNot)}</pre>
            </div>}
        />

    </div>;
};

const ComponentGalleryPage: BlitzPage = () => {
    return (
        <DashboardLayout title="Component Gallery" basePermission={Permission.sysadmin}>
            <MainContent />
        </DashboardLayout>
    )
}

export default ComponentGalleryPage;
