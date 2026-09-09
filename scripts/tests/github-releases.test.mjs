import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { createGitHubClient, publishRelease } from "../lib/github-releases.mjs"
import { identityForVersion, artifactNames, RELEASE_RUNTIME } from "../lib/release-model.mjs"

test("release listing searches across other products and includes selectable prereleases", async () => {
    const urls = []
    const otherProduct = { tag_name: "single-band-v3.0.0", draft: false }
    const expected = { tag_name: "cafemarche-v3.1.0-rc.1", draft: false, prerelease: true }
    const client = createGitHubClient("owner/repo", "token", async (url) => {
        urls.push(url)
        const entries = urls.length === 1 ? Array(100).fill(otherProduct) : [
            { tag_name: "v2.03", draft: false }, { tag_name: "cafemarche-v3.0.0", draft: true }, expected,
        ]
        return new Response(JSON.stringify(entries))
    })
    assert.deepEqual(await client.listProductReleases("cafemarche", 10), [expected])
    assert.match(urls[1], /page=2$/)
})

test("missing releases are distinct from authentication or server failures", async () => {
    const missing = createGitHubClient("owner/repo", "token", async () => new Response("not found", { status: 404 }))
    assert.equal(await missing.findRelease("cafemarche-v3.0.0"), null)
    for (const status of [401, 403, 500]) {
        const client = createGitHubClient("owner/repo", "token", async () => new Response("failed", { status }))
        await assert.rejects(() => client.findRelease("cafemarche-v3.0.0"), { status })
    }
})

test("publication lookup finds drafts even when the tag endpoint returns 404", async () => {
    const draft = { id: 42, tag_name: "cafemarche-v3.0.0", draft: true }
    const client = createGitHubClient("owner/repo", "token", async (url) => {
        if (url.includes("/releases/tags/")) return new Response("not found", { status: 404 })
        return new Response(JSON.stringify([draft]))
    })
    assert.deepEqual(await client.findRelease(draft.tag_name, true), draft)
    assert.equal(await client.findRelease(draft.tag_name), null)
})

function publicationFixture({ draft = null, tagCommit = null, uploadFailure = false } = {}) {
    const identity = identityForVersion("cafemarche", "3.0.0")
    const manifest = { ...identity, commit: "a".repeat(40), sourceRef: "refs/heads/main", runtime: RELEASE_RUNTIME }
    const calls = []
    const client = {
        tagCommit: async () => tagCommit,
        findRelease: async () => draft,
        request: async (method, route, body) => {
            calls.push({ method, route, body })
            return { id: 10, assets: [], html_url: "https://github.com/owner/repo/releases/test" }
        },
        uploadAsset: async (release, file, name) => {
            calls.push({ upload: name })
            if (uploadFailure) throw new Error("interrupted upload")
        },
    }
    return { client, calls, manifest }
}

test("a new release stays a draft until all three assets have uploaded", async () => {
    const { client, calls, manifest } = publicationFixture()
    await publishRelease(client, manifest, "dist")
    assert.equal(calls[0].route, "/git/refs")
    assert.equal(calls[0].body.sha, manifest.commit)
    assert.equal(calls[1].body.draft, true)
    assert.equal(calls[1].body.target_commitish, manifest.commit)
    assert.deepEqual(calls.slice(2, 5).map((call) => call.upload), Object.values(artifactNames(manifest)))
    assert.deepEqual(calls[5], { method: "PATCH", route: "/releases/10", body: { draft: false, make_latest: "false" } })
})

test("failed upload never publishes; retry can replace only assets on the matching draft", async () => {
    const failed = publicationFixture({ uploadFailure: true })
    await assert.rejects(() => publishRelease(failed.client, failed.manifest, "dist"), /interrupted upload/)
    assert.equal(failed.calls.some((call) => call.method === "PATCH"), false)
    const retry = publicationFixture({ tagCommit: "a".repeat(40), draft: {
        id: 12, draft: true, target_commitish: "a".repeat(40),
        assets: [{ id: 20, name: "cmdb_cafemarche_3.0.0.tar.gz" }, { id: 21, name: "operator-notes.txt" }],
    } })
    await publishRelease(retry.client, retry.manifest, "dist")
    assert.deepEqual(retry.calls[0], { method: "DELETE", route: "/releases/assets/20", body: undefined })
    assert.equal(retry.calls.some((call) => call.route === "/releases/assets/21"), false)
    assert.equal(retry.calls.at(-1).body.draft, false)
})

test("published versions and mismatched tags/drafts are immutable", async () => {
    for (const options of [
        { tagCommit: "b".repeat(40) },
        { tagCommit: "a".repeat(40), draft: { draft: false } },
        { draft: { draft: true, target_commitish: "b".repeat(40) } },
    ]) {
        const fixture = publicationFixture(options)
        await assert.rejects(() => publishRelease(fixture.client, fixture.manifest, "dist"))
        assert.equal(fixture.calls.length, 0)
    }
})

test("annotated tags resolve to their commit", async () => {
    const client = createGitHubClient("owner/repo", "token", async (url) => new Response(JSON.stringify(
        url.includes("/git/ref/") ? { object: { type: "tag", sha: "tag-object" } } : { object: { type: "commit", sha: "a".repeat(40) } },
    )))
    assert.equal(await client.tagCommit("cafemarche-v3.0.0"), "a".repeat(40))
})

test("private assets download through the authenticated API and stream to disk", async (t) => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "cmdb-asset-test-"))
    t.after(() => {
        assert.equal(path.dirname(directory), path.resolve(os.tmpdir()))
        assert.ok(path.basename(directory).startsWith("cmdb-asset-test-"))
        fs.rmSync(directory, { recursive: true, force: true })
    })
    const client = createGitHubClient("owner/private-repo", "test-token", async (url, options) => {
        assert.equal(url, "https://api.github.com/repos/owner/private-repo/releases/assets/123")
        assert.equal(options.headers.Authorization, "Bearer test-token")
        assert.equal(options.headers.Accept, "application/octet-stream")
        return new Response("release bytes")
    })
    const destination = path.join(directory, "archive")
    await client.downloadAsset({ id: 123, name: "archive", browser_download_url: "https://unused.invalid" }, destination)
    assert.equal(fs.readFileSync(destination, "utf8"), "release bytes")
})
