import { createHash } from "crypto";

export const demoLocaleTags = ["en-US", "fr-BE", "nl-BE"] as const;
export type DemoLocale = typeof demoLocaleTags[number];

export interface DemoConfig {
    bands: number;
    membersPerBand: number;
    songsPerBand: number;
    eventsPerBand: number;
    locales: DemoLocale[];
    seed: number;
    referenceDate: string;
}

export const demoPassword = "Demo1234!";
export const demoHelp = `Usage: yarn demo:reset [options]

  --bands <count>             Bands (default 2; 1..10)
  --members-per-band <count>  Members, including manager and shared person (default 8; 3..50)
  --songs-per-band <count>    Songs (default 6; 0..100)
  --events-per-band <count>   Events (default 5; 0..30)
  --locales <tags>            Comma-separated en-US,fr-BE,nl-BE (default all; en-US required)
  --seed <integer>            Reproducible identities and varied assignments (default 104)
  --date <YYYY-MM-DD>         Reference date for past/upcoming events (default today in UTC)
  --help                     Show this help without connecting to a database

Database: DEMO_DATABASE_URL, or DATABASE_URL with database name replaced by cmdb_demo.
Only local databases named cmdb_demo or cmdb_demo_<suffix> are accepted.
Launch: yarn demo:dev, or yarn demo:build then yarn demo:start. DEMO_PORT defaults to 10455.
All sample accounts use the password ${demoPassword}. See docs/demo-seeding.md.`;

function readOptions(args: readonly string[]): Map<string, string> {
    const known = new Set(["bands", "members-per-band", "songs-per-band", "events-per-band", "locales", "seed", "date"]);
    const options = new Map<string, string>();
    for (let index = 0; index < args.length; index++) {
        const token = args[index]!;
        const match = /^--([a-z-]+)(?:=(.*))?$/.exec(token);
        if (!match || !known.has(match[1]!)) {
            throw new Error(`Unknown demo option: ${token}. Use --help.`);
        }
        const key = match[1]!;
        const value = match[2] ?? args[++index];
        if (value === undefined || value.startsWith("--") || value === "" || options.has(key)) {
            throw new Error(`Provide exactly one value for --${key}.`);
        }
        options.set(key, value);
    }
    return options;
}

function integerOption(options: Map<string, string>, key: string, fallback: number, min: number, max: number): number {
    const raw = options.get(key) ?? String(fallback);
    const value = Number(raw);
    if (!/^-?\d+$/.test(raw) || !Number.isSafeInteger(value) || value < min || value > max) {
        throw new Error(`--${key} must be an integer from ${min} to ${max}.`);
    }
    return value;
}

export function parseDemoConfig(args: readonly string[], now: Date = new Date()): DemoConfig {
    const options = readOptions(args);
    const referenceDate = options.get("date") ?? now.toISOString().slice(0, 10);
    const parsedDate = new Date(`${referenceDate}T00:00:00.000Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(referenceDate) || !Number.isFinite(parsedDate.getTime())
        || parsedDate.toISOString().slice(0, 10) !== referenceDate) {
        throw new Error("--date must be a real date in YYYY-MM-DD format.");
    }
    const locales: DemoLocale[] = [];
    for (const tag of (options.get("locales") ?? demoLocaleTags.join(",")).split(",")) {
        const locale = demoLocaleTags.find(candidate => candidate === tag);
        if (!locale || locales.includes(locale)) {
            throw new Error("--locales must contain distinct supported tags: en-US,fr-BE,nl-BE.");
        }
        locales.push(locale);
    }
    if (!locales.includes("en-US")) {
        throw new Error("--locales must include en-US for fallback examples.");
    }
    return {
        bands: integerOption(options, "bands", 2, 1, 10),
        membersPerBand: integerOption(options, "members-per-band", 8, 3, 50),
        songsPerBand: integerOption(options, "songs-per-band", 6, 0, 100),
        eventsPerBand: integerOption(options, "events-per-band", 5, 0, 30),
        seed: integerOption(options, "seed", 104, 0, 2_147_483_647),
        locales, referenceDate,
    };
}

export function resolveDemoDatabaseUrl(applicationUrl: string | undefined, explicitDemoUrl: string | undefined): URL {
    const source = explicitDemoUrl ?? applicationUrl;
    if (!source) {
        throw new Error("Set DATABASE_URL or DEMO_DATABASE_URL to a local MySQL connection.");
    }
    let target: URL;
    try {
        target = new URL(source);
    } catch {
        throw new Error("Invalid demo database connection URL.");
    }
    if (!explicitDemoUrl) {
        target.pathname = "/cmdb_demo";
    }
    if (target.protocol !== "mysql:" || !["localhost", "127.0.0.1", "[::1]"].includes(target.hostname)
        || !/^\/cmdb_demo(?:_[a-z0-9_]+)?$/.test(target.pathname)) {
        throw new Error("Demo commands require local MySQL and a database named cmdb_demo or cmdb_demo_<suffix>.");
    }
    if (applicationUrl) {
        const application = new URL(applicationUrl);
        // localhost and loopback addresses can refer to the same server.
        if (application.pathname.toLowerCase() === target.pathname.toLowerCase()) {
            throw new Error("The demo database must be separate from the application's DATABASE_URL.");
        }
    }
    return target;
}

/** These public identities are deliberately predictable demo fixtures, never credentials. */
export function demoId(config: Pick<DemoConfig, "seed">, key: string): string {
    return createHash("sha256").update(`cmdb-demo:${config.seed}:${key}`).digest("base64url").slice(0, 16);
}

export function demoChoice(config: Pick<DemoConfig, "seed">, key: string, count: number): number {
    return createHash("sha256").update(`${config.seed}:${key}`).digest().readUInt32BE(0) % count;
}

export function demoDaysAgo(config: Pick<DemoConfig, "referenceDate">, days: number): Date {
    return new Date(new Date(`${config.referenceDate}T12:00:00Z`).valueOf() - days * 86_400_000);
}

/** Repeatable dates use the full interval, independently of insertion order. */
export function demoDateBetween(config: Pick<DemoConfig, "seed">, key: string, earliest: Date, latest: Date): Date {
    const fraction = demoChoice(config, `${key}:date`, 1_000_001) / 1_000_000;
    return new Date(earliest.valueOf() + Math.floor((latest.valueOf() - earliest.valueOf()) * fraction));
}
