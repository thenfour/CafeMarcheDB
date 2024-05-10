import { BlitzPage } from "@blitzjs/next";
import ThumbUpIcon from '@mui/icons-material/ThumbUp';
import { Divider } from "@mui/material";
import { StandardVariationSpec } from "shared/color";
import { Permission } from "shared/permissions";
import { IsNullOrWhitespace, parseMimeType } from "shared/utils";
import * as CMCoreComponents from "src/core/components/CMCoreComponents";
import { KeyValueDisplay, NameValuePair } from "src/core/components/CMCoreComponents2";
import { CMTextInputBase } from "src/core/components/CMTextField";
import { DateTimeRangeControlExample } from "src/core/components/DateTimeRangeControl";
import { IconEditCell } from "src/core/db3/components/IconSelectDialog";
import DashboardLayout from "src/core/layouts/DashboardLayout";
import React from "react";
import * as mime from 'mime';
import { slugify, unslugify } from "shared/rootroot";
import * as db3 from "src/core/db3/db3";
import { SongAutocomplete } from "src/core/components/SongAutocomplete";
import { AutoAssignInstrumentPartition } from "src/core/db3/shared/apiTypes";
import * as DB3Client from "src/core/db3/DB3Client";
import { Prisma } from "db";
import { useCurrentUser } from "src/auth/hooks/useCurrentUser";
import { DateTimeRange, RelativeTimingBucket, RelativeTimingInfo } from "shared/time";


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
            new DB3Client.SlugColumnClient({
                columnName: "slug", cellWidth: 120, previewSlug: (obj) => {
                    return null;
                }
            }),
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
                    <th>leaf</th>
                    <th>instruments</th>
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

const MainContent = () => {
    const [leaf, setLeaf] = React.useState<string>("");
    const [slugOrNot, setSlugOrNot] = React.useState<string>("");
    const [mimeTypeStr, setMimeTypeStr] = React.useState<string>("");
    const [songValue, setSongValue] = React.useState<db3.SongPayload | null>(null);

    const mimeType = (mime as any).getType(leaf); // requires a leaf only, for some reason explicitly fails on a full path.

    return <>

        <AutoAssignInstrumentTester />

        <CMCoreComponents.CMSinglePageSurfaceCard>

            <h3>SongAutocomplete</h3>
            <div style={{ backgroundColor: "#c4c", padding: "10px" }}>
                <div style={{ backgroundColor: "white", padding: "10px" }}>
                    <SongAutocomplete
                        index={0}
                        value={songValue}
                        onChange={(value) => setSongValue(value as any)}
                    />
                </div>
            </div>

            <KeyValueDisplay data={{
                id: (songValue?.id) || "<null>",
                name: (songValue?.name) || "<null>",
            }} />

        </CMCoreComponents.CMSinglePageSurfaceCard>

        <CMCoreComponents.CMSinglePageSurfaceCard>

            <h3>DateTimeRange</h3>
            <div>
                <DateTimeRangeControlExample />
            </div>
        </CMCoreComponents.CMSinglePageSurfaceCard>

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
        <CMCoreComponents.CMSinglePageSurfaceCard>
            <div className="header">CMSinglePageSurfaceCard.header</div>
            <div className="content">CMSinglePageSurfaceCard.content</div>
        </CMCoreComponents.CMSinglePageSurfaceCard>

        <Divider />

        <h3>CMChip</h3>
        <CMCoreComponents.CMChipContainer>
            <CMCoreComponents.CMChip color={"yes"} size="small" variation={{ enabled: false, selected: false, fillOption: "filled", variation: "strong" }}>(todo: all variations)</CMCoreComponents.CMChip>
        </CMCoreComponents.CMChipContainer>



        <h3>CMChip on surface </h3>
        <CMCoreComponents.CMSinglePageSurfaceCard>
            <CMCoreComponents.CMChipContainer>
                <CMCoreComponents.CMChip color={"yes"} size="small" variation={{ enabled: false, selected: false, fillOption: "filled", variation: "strong" }}>(todo: all variations)</CMCoreComponents.CMChip>
            </CMCoreComponents.CMChipContainer>
        </CMCoreComponents.CMSinglePageSurfaceCard>


        <h3>Icons</h3>
        <div>
            <IconEditCell validationError={null} onOK={() => { }} value={null} readonly={false} />
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

    </>;
};

const ComponentGalleryPage: BlitzPage = () => {
    return (
        <DashboardLayout title="Component Gallery" basePermission={Permission.sysadmin}>
            <MainContent />
        </DashboardLayout>
    )
}

export default ComponentGalleryPage;
