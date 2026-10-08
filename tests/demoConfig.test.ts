import { describe, expect, it } from "vitest";
import { demoChoice, demoId, parseDemoConfig, resolveDemoDatabaseUrl } from "../db/seeding/demo/config";

describe("demo command configuration", () => {
    it("provides a two-band multilingual default and anchors dates to UTC", () => {
        expect(parseDemoConfig([], new Date("2026-10-08T23:59:59Z"))).toEqual({ bands: 2, membersPerBand: 8,
            songsPerBand: 6, eventsPerBand: 5, locales: ["en-US", "fr-BE", "nl-BE"], seed: 104, referenceDate: "2026-10-08" });
    });

    it("accepts separated and equals options, reduced locales and empty content domains", () => {
        expect(parseDemoConfig(["--bands=3", "--members-per-band", "4", "--songs-per-band=0", "--events-per-band=0",
            "--locales=en-US,nl-BE", "--seed=42", "--date=2028-02-29"])).toEqual({ bands: 3, membersPerBand: 4,
            songsPerBand: 0, eventsPerBand: 0, locales: ["en-US", "nl-BE"], seed: 42, referenceDate: "2028-02-29" });
    });

    it.each([
        ["--band=2"], ["--bands=0"], ["--bands=11"], ["--bands=1.5"], ["--bands=Infinity"], ["--bands"],
        ["--members-per-band=2"], ["--songs-per-band=-1"], ["--events-per-band=31"], ["--seed=-1"],
        ["--bands=2", "--bands=3"], ["--bands", "--seed=1"], ["--locales=fr-BE"], ["--locales=en-US,de-DE"],
        ["--locales=en-US,en-US"], ["--date=2026-02-29"], ["--date=2026-13-01"], ["--date=tomorrow"],
    ])("rejects malformed options before any reset: %j", (...args) => {
        expect(() => parseDemoConfig(args)).toThrow();
    });

    it("derives a separate local demo target without altering connection options", () => {
        const target = resolveDemoDatabaseUrl("mysql://user:password@localhost:3307/cmdb?connection_limit=5", undefined);
        expect(target.pathname).toBe("/cmdb_demo");
        expect(target.port).toBe("3307");
        expect(target.searchParams.get("connection_limit")).toBe("5");
        expect(target.password).toBe("password");
    });

    it.each([
        "mysql://root@remote.example/cmdb_demo", "mysql://root@127.0.0.1/cmdb", "mysql://root@localhost/cmdb_demo-other",
        "mysql://root@localhost/cmdb_demo%3Bdrop", "postgres://root@localhost/cmdb_demo", "invalid",
    ])("rejects unsafe demo targets: %s", target => {
        expect(() => resolveDemoDatabaseUrl(undefined, target)).toThrow();
    });

    it("rejects the application database even through a loopback hostname alias", () => {
        expect(() => resolveDemoDatabaseUrl("mysql://root@localhost/cmdb_demo_test", "mysql://root@127.0.0.1/cmdb_demo_test")).toThrow(/separate/);
        expect(() => resolveDemoDatabaseUrl("mysql://root@localhost/cmdb_demo", undefined)).toThrow(/separate/);
    });

    it("reproduces public identities and choices without coupling generator call order", () => {
        expect(demoId({ seed: 104 }, "band:1")).toMatch(/^[a-zA-Z0-9_-]{16}$/);
        expect(demoId({ seed: 104 }, "band:1")).toBe(demoId({ seed: 104 }, "band:1"));
        expect(demoId({ seed: 104 }, "band:1")).not.toBe(demoId({ seed: 42 }, "band:1"));
        expect(demoChoice({ seed: 104 }, "member:1", 3)).toBe(demoChoice({ seed: 104 }, "member:1", 3));
    });
});
