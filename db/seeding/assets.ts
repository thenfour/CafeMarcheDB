export const sampleScore = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="300" viewBox="0 0 800 300">
<rect width="800" height="300" fill="white"/><g fill="black" font-family="serif">
<text x="40" y="45" font-size="26">CMDB demo — rehearsal score</text>
<text x="40" y="80" font-size="16">Partition de démonstration / Demopartituur</text>
<path d="M40 120H760M40 135H760M40 150H760M40 165H760M40 180H760" stroke="black"/>
<ellipse cx="180" cy="165" rx="10" ry="7"/><path d="M190 165V110" stroke="black" stroke-width="2"/>
<ellipse cx="300" cy="150" rx="10" ry="7"/><path d="M310 150V95" stroke="black" stroke-width="2"/>
<ellipse cx="420" cy="135" rx="10" ry="7"/><path d="M430 135V80" stroke="black" stroke-width="2"/>
<text x="40" y="250" font-size="16">Original sample fixture. No external downloads required.</text></g></svg>`;

export function createSampleRecording(): Buffer {
    const sampleRate = 8_000;
    const samples = sampleRate * 2;
    const wav = Buffer.alloc(44 + samples * 2);
    wav.write("RIFF", 0);
    wav.writeUInt32LE(wav.length - 8, 4);
    wav.write("WAVEfmt ", 8);
    wav.writeUInt32LE(16, 16);
    wav.writeUInt16LE(1, 20);
    wav.writeUInt16LE(1, 22);
    wav.writeUInt32LE(sampleRate, 24);
    wav.writeUInt32LE(sampleRate * 2, 28);
    wav.writeUInt16LE(2, 32);
    wav.writeUInt16LE(16, 34);
    wav.write("data", 36);
    wav.writeUInt32LE(samples * 2, 40);
    for (let index = 0; index < samples; index++) {
        const fade = Math.min(1, index / 400, (samples - index) / 400);
        wav.writeInt16LE(Math.round(Math.sin(2 * Math.PI * 440 * index / sampleRate) * 4_000 * fade), 44 + index * 2);
    }
    return wav;
}

