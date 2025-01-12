

import React from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ComposedChart, YAxis, XAxis, CartesianGrid, Line, Bar, ResponsiveContainer, BarChart } from 'recharts';
import { SetlistPlan } from 'src/core/db3/shared/setlistPlanTypes';
import { getHashedColor, IsNullOrWhitespace, toSorted } from 'shared/utils';
import { useSongsContext } from '../SongsContext';
import { SetlistPlanStats } from './SetlistPlanUtilities';

interface SetlistPlannerVisualizationsProps {
    doc: SetlistPlan;
    stats: SetlistPlanStats;
}

const SongPie: React.FC<SetlistPlannerVisualizationsProps> = (props) => {
    const allSongs = useSongsContext();
    const gUnassignedCaption = "Free rehearsal";

    const songs = props.stats.songStats
        .map((songStat) => {
            const song = allSongs.songs.find((x) => x.id === songStat.songId);
            return {
                name: song?.name ?? "Unknown",
                value: songStat.totalPointsAllocated,
            };
        });
    songs.sort((a, b) => a.value - b.value);

    const data = [
        ...songs,
        {
            name: gUnassignedCaption,
            value: 8,
        },
    ];

    return <PieChart width={800} height={800}>
        <defs>
            <pattern
                id="hatchPattern"
                patternUnits="userSpaceOnUse"
                width="8"
                height="8"
                patternTransform="rotate(45)"
            >
                <rect x="0" y="0" width="8" height="8" fill="transparent" />
                <rect x="0" y="0" width="1" height="8" fill="#ccc" />
                <rect x="4" y="0" width="1" height="8" fill="#ccc" />
            </pattern>
        </defs>
        <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={220}
            fill="#8884d8"
            isAnimationActive={false}
            label
        >
            {data.map((stat, index) => (
                <Cell key={`cell-${index}`} fill={stat.name === gUnassignedCaption ? "url(#hatchPattern)" : getHashedColor(stat.name)} className='hatch' />
            ))}
        </Pie>
        <Tooltip />
        <Legend />
    </PieChart>;
}


const UncertaintyOverTime: React.FC<SetlistPlannerVisualizationsProps> = (props) => {

    let uncertainty = props.stats.totalPointsRequired;
    let reference = props.stats.totalPointsRequired;
    const referencePointsPerRehearsal = props.stats.totalPointsRequired / props.doc.payload.columns.length;
    const data: { name: string, uncertainty: number, pointsAllocated: number, reference: number }[] = [];

    for (const segmentStat of props.stats.segmentStats) {
        const column = props.doc.payload.columns.find((x) => x.columnId === segmentStat.segment.columnId);
        data.push({
            name: column?.name ?? "Unknown",
            uncertainty,
            pointsAllocated: segmentStat.totalPointsAllocated,
            reference,
        });
        uncertainty -= segmentStat.totalPointsAllocated;
        reference -= referencePointsPerRehearsal;
    }

    data.push({
        name: "",
        uncertainty,
        pointsAllocated: 0,
        reference
    });

    return <ComposedChart
        width={800}
        height={800}
        data={data}
    >
        <CartesianGrid stroke="#f5f5f5" />
        <XAxis dataKey="name" scale="band" />
        <YAxis />
        <Tooltip />
        <Legend />

        <Line type="monotone" dataKey="uncertainty" stroke="#ff7300" strokeWidth={4} />
        <Bar dataKey="pointsAllocated" barSize={30} fill="#8888" />
        <Line type="monotone" dataKey="reference" stroke="#6668" strokeWidth={1} />

        {/* <Area type="monotone" dataKey="amt" fill="#8884d8" stroke="#8884d8" />
        <Scatter dataKey="cnt" fill="red" /> */}
    </ComposedChart>

}


// song stacked bars, one bar per song, horiz, colored segments.

const SongStackedBars: React.FC<SetlistPlannerVisualizationsProps> = (props) => {
    const allSongs = useSongsContext();

    // gather the requisite info...
    const songs = props.stats.songStats
        .map((songStat) => {
            const song = allSongs.songs.find((x) => x.id === songStat.songId);
            const allocatedCells = props.doc.payload.cells.filter((cell) => cell.rowId === songStat.rowId && (cell.pointsAllocated || 0) > 0);
            // sort allocatedCells by column index
            allocatedCells.sort((a, b) => {
                const aIndex = props.doc.payload.columns.findIndex((x) => x.columnId === a.columnId);
                const bIndex = props.doc.payload.columns.findIndex((x) => x.columnId === b.columnId);
                return aIndex - bIndex;
            });
            const firstAllocatedColumnIndex = allocatedCells.length > 0 ? props.doc.payload.columns.findIndex((x) => x.columnId === allocatedCells[0]!.columnId) : undefined;
            const lastAllocatedColumnIndex = allocatedCells.length > 0 ? props.doc.payload.columns.findIndex((x) => x.columnId === allocatedCells[allocatedCells.length - 1]!.columnId) : undefined;
            return {
                name: song?.name ?? "Unknown",
                song: song!,
                songStat: { ...songStat, requiredPoints: songStat.requiredPoints || 0 },
                allocatedCells,
                firstAllocatedColumnIndex,
                lastAllocatedColumnIndex,
                columnValues: props.doc.payload.columns.map((column) => {
                    const cell = props.doc.payload.cells.find((x) => x.rowId === songStat.rowId && x.columnId === column.columnId) || { pointsAllocated: 0 };
                    return {
                        column,
                        cell,
                    };
                }),
            };
        });
    songs.sort((a, b) => b.songStat.requiredPoints - a.songStat.requiredPoints);

    return <table>
        {songs.map(song => {
            return <tr>
                <td>{song.name}</td>
                <td>
                    <div style={{ display: "flex", color: "#fff", fontFamily: "monospace" }}>
                        {song.columnValues.map((columnValue, columnIndex) => {
                            const isEmpty = columnValue.cell.pointsAllocated === 0;
                            const isInBounds = columnIndex >= song.firstAllocatedColumnIndex! && columnIndex <= song.lastAllocatedColumnIndex!;
                            return <div
                                style={{
                                    backgroundColor: isInBounds ? (isEmpty ? "#fa0" : "#8cc4") : "transparent",//getHashedColor(columnValue.column.name),
                                    width: 25,
                                    display: "flex",
                                    justifyContent: "center",
                                    "--fc": "#f80",
                                } as any}
                                className={`${isInBounds ? (columnValue.cell.pointsAllocated === 0 ? "hatch" : "") : "out-of-bounds"}`}
                            >
                                {!isEmpty && columnValue.cell.pointsAllocated}
                            </div>;
                        })}
                    </div>
                </td>
            </tr>
        })}

    </table>
}




interface SetlistPlannerVisualizationsProps {
    doc: SetlistPlan;
    stats: SetlistPlanStats;
}

export const SetlistPlannerVisualizations: React.FC<SetlistPlannerVisualizationsProps> = (props) => {
    return (
        <div>
            <SongPie {...props} />
            <UncertaintyOverTime {...props} />
            <SongStackedBars {...props} />
        </div>
    );

};