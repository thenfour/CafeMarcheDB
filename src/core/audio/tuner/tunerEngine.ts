import { clamp01 } from "@/shared/utils";

export type TunerReading = {
    frequencyHz: number | null;
    confidence01: number;
    rms: number;
    updatedAt: number;
};

export type TunerStatus = "idle" | "starting" | "running" | "stopped" | "error";

export type TunerStatusUpdate = {
    status: TunerStatus;
    message?: string;
};

export type TunerCallbacks = {
    onReading: (reading: TunerReading) => void;
    onStatus?: (update: TunerStatusUpdate) => void;
};

const MIN_FREQ_HZ = 30;
const MAX_FREQ_HZ = 2000;
const DEFAULT_BUFFER_SIZE = 8192;
const PITCH_DETECTOR_PROCESSOR_NAME = "pitch-detector-processor";

/**
 * Single-path tuner engine powered by an AudioWorklet that runs YIN pitch detection.
 * The worklet posts {frequencyHz, confidence01, rms} messages back to the main thread.
 */
export class TunerEngine {
    private audioContext: AudioContext | null = null;
    private workletNode: AudioWorkletNode | null = null;
    private mediaStream: MediaStream | null = null;
    private mediaSource: MediaStreamAudioSourceNode | null = null;
    private callbacks: TunerCallbacks;
    private workletRegistered: boolean = false;

    constructor(callbacks: TunerCallbacks) {
        this.callbacks = callbacks;
    }

    async start(deviceId?: string) {
        this.publishStatus({ status: "starting" });
        try {
            if (!this.audioContext) {
                this.audioContext = new AudioContext();
            }
            if (!this.workletRegistered) {
                await this.registerWorkletModule(this.audioContext);
                this.workletRegistered = true;
            }

            const constraints: MediaStreamConstraints = {
                audio: {
                    deviceId: deviceId ? { exact: deviceId } : undefined,
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false,
                },
                video: false,
            };

            this.mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
            this.mediaSource = this.audioContext.createMediaStreamSource(this.mediaStream);

            this.workletNode = new AudioWorkletNode(
                this.audioContext,
                PITCH_DETECTOR_PROCESSOR_NAME,
                {
                    processorOptions: {
                        analysisBufferSize: DEFAULT_BUFFER_SIZE,
                        minFreqHz: MIN_FREQ_HZ,
                        maxFreqHz: MAX_FREQ_HZ,
                    },
                }
            );

            this.workletNode.port.onmessage = (event: MessageEvent<any>) => {
                const { frequencyHz, confidence01, rms } = event.data as { frequencyHz: number | null; confidence01: number; rms: number; };
                this.callbacks.onReading({
                    frequencyHz,
                    confidence01: clamp01(confidence01),
                    rms,
                    updatedAt: performance.now(),
                });
            };

            // Connect the graph; the worklet does not output audio.
            this.mediaSource.connect(this.workletNode);
            this.workletNode.connect(this.audioContext.destination);

            this.publishStatus({ status: "running" });
        } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to start tuner";
            this.publishStatus({ status: "error", message });
            await this.stop();
        }
    }

    async stop() {
        this.workletNode?.disconnect();
        this.workletNode = null;

        this.mediaSource?.disconnect();
        this.mediaSource = null;

        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(track => track.stop());
            this.mediaStream = null;
        }

        if (this.audioContext) {
            await this.audioContext.suspend();
        }

        this.publishStatus({ status: "stopped" });
    }

    async listAudioInputs(): Promise<MediaDeviceInfo[]> {
        const devices = await navigator.mediaDevices.enumerateDevices();
        return devices.filter(d => d.kind === "audioinput");
    }

    private publishStatus(update: TunerStatusUpdate) {
        if (this.callbacks.onStatus) {
            this.callbacks.onStatus(update);
        }
    }

    private async registerWorkletModule(ctx: AudioContext) {
        const workletUrl = createPitchDetectorWorkletUrl();
        await ctx.audioWorklet.addModule(workletUrl);
    }
}

// ---------------- Worklet source ----------------

const PITCH_DETECTOR_WORKLET_SOURCE = `
const DEFAULT_MIN_FREQ_HZ = ${MIN_FREQ_HZ};
const DEFAULT_MAX_FREQ_HZ = ${MAX_FREQ_HZ};
const DEFAULT_BUFFER_SIZE = ${DEFAULT_BUFFER_SIZE};
const HOP_INTERVAL = 6; // analyze every 6 render quanta to reduce CPU

class PitchDetectorProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const opts = (options && options.processorOptions) || {};
    this.analysisBufferSize = opts.analysisBufferSize || DEFAULT_BUFFER_SIZE;
    this.minFreqHz = opts.minFreqHz || DEFAULT_MIN_FREQ_HZ;
    this.maxFreqHz = opts.maxFreqHz || DEFAULT_MAX_FREQ_HZ;

    this.buffer = new Float32Array(this.analysisBufferSize);
    this.writeIndex = 0;
    this.hopCounter = 0;
    this.lastRms = 0;
  }

  appendSamples(channel) {
    for (let i = 0; i < channel.length; i++) {
      this.buffer[this.writeIndex] = channel[i];
      this.writeIndex = (this.writeIndex + 1) % this.analysisBufferSize;
    }
  }

  computeRms() {
    let sum = 0;
    for (let i = 0; i < this.analysisBufferSize; i++) {
      const v = this.buffer[i];
      sum += v * v;
    }
    const rms = Math.sqrt(sum / this.analysisBufferSize);
    this.lastRms = rms;
    return rms;
  }

  // YIN implementation adapted for worklet context.
  detectPitch(sampleRate) {
    const buffer = this.buffer;
    const n = buffer.length;

    // Difference function d_tau
    const diff = new Float32Array(n);
    for (let tau = 0; tau < n; tau++) {
      let sum = 0;
      for (let i = 0; i < n - tau; i++) {
        const delta = buffer[i] - buffer[i + tau];
        sum += delta * delta;
      }
      diff[tau] = sum;
    }

    // Cumulative mean normalized difference function cmndf
    const cmndf = new Float32Array(n);
    cmndf[0] = 1;
    let runningSum = 0;
    for (let tau = 1; tau < n; tau++) {
      runningSum += diff[tau];
      cmndf[tau] = diff[tau] * tau / runningSum;
    }

    // Absolute min within allowed freq range
    const maxTau = Math.floor(sampleRate / this.minFreqHz);
    const minTau = Math.max(2, Math.floor(sampleRate / this.maxFreqHz));

    let bestTau = -1;
    let bestValue = 1;
    for (let tau = minTau; tau < Math.min(maxTau, n); tau++) {
      const value = cmndf[tau];
      if (value < bestValue) {
        bestValue = value;
        bestTau = tau;
      }
    }

    if (bestTau === -1) {
      return { frequencyHz: null, confidence01: 0 };
    }

    // Parabolic interpolation around bestTau for sub-sample accuracy
    const prev = cmndf[bestTau - 1] ?? cmndf[bestTau];
    const next = cmndf[bestTau + 1] ?? cmndf[bestTau];
    const denom = (2 * bestValue) - prev - next;
    const delta = denom !== 0 ? (next - prev) / (2 * denom) : 0;
    const refinedTau = bestTau + delta;

    const frequencyHz = sampleRate / refinedTau;
    const confidence01 = 1 - bestValue;
    return { frequencyHz, confidence01 };
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || input.length === 0) {
      return true;
    }

    const channel = input[0];
    if (!channel) {
      return true;
    }

    this.appendSamples(channel);
    this.hopCounter++;
    if (this.hopCounter < HOP_INTERVAL) {
      return true;
    }
    this.hopCounter = 0;

    const rms = this.computeRms();

    const { frequencyHz, confidence01 } = this.detectPitch(sampleRate);
    const valid = frequencyHz && frequencyHz >= this.minFreqHz && frequencyHz <= this.maxFreqHz;

    this.port.postMessage({
      frequencyHz: valid ? frequencyHz : null,
      confidence01: confidence01 ?? 0,
      rms,
    });

    return true;
  }
}

registerProcessor('${PITCH_DETECTOR_PROCESSOR_NAME}', PitchDetectorProcessor);
`;

function createPitchDetectorWorkletUrl(): string {
    const blob = new Blob([PITCH_DETECTOR_WORKLET_SOURCE], { type: "application/javascript" });
    return URL.createObjectURL(blob);
}
