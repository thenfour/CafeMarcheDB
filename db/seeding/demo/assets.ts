import { copyFile, mkdir, writeFile } from "fs/promises";
import path from "path";
import { demoId, type DemoConfig } from "./config";
import { sampleScore as score, createSampleRecording } from "../assets";

export async function writeDemoAssets(directory: string, config: DemoConfig) {
    await mkdir(directory, { recursive: true });
    const recording = createSampleRecording();
    await writeFile(path.join(directory, "cmdb-demo-score.svg"), score, "utf8");
    await writeFile(path.join(directory, "cmdb-demo-recording.wav"), new Uint8Array(recording));
    for (let index = 0; index < config.bands; index++) {
        for (const [fileIndex, extension, source] of [[0, "svg", "cmdb-demo-score.svg"], [1, "wav", "cmdb-demo-recording.wav"]] as const) {
            // Copy known leaves before committing database rows that refer to their bytes.
            const leaf = `${demoId(config, `band:${index + 1}:file:${fileIndex}`)}.${extension}`;
            await copyFile(path.join(directory, source), path.join(directory, leaf));
        }
    }
    return { scoreBytes: Buffer.byteLength(score), recordingBytes: recording.length };
}

export type DemoAssets = Awaited<ReturnType<typeof writeDemoAssets>>;
