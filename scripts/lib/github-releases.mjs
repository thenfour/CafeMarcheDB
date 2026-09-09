/**
 * Implements the GitHub Releases storage boundary for release artifacts.
 *
 * Internal module used by package-release.mjs and upgrade.mjs; do not run it
 * directly. Publishing needs a contents-write token. Reading private release
 * assets needs a contents-read token; public releases can be read anonymously.
 */

import fs from "node:fs"
import { Readable } from "node:stream"
import { pipeline } from "node:stream/promises"
import { artifactNames, identityFromTag } from "./release-model.mjs"

export function ownerRepoFromOrigin(url) {
    const match = url.match(/^(?:https:\/\/github\.com\/|git@github\.com:|ssh:\/\/git@github\.com\/)([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+?)(?:\.git)?$/)
    if (!match) throw new Error("origin must identify a GitHub repository.")
    return match[1]
}

export function createGitHubClient(ownerRepo, token, fetchImplementation = fetch) {
    const base = `https://api.github.com/repos/${ownerRepo}`

    async function request(method, route, body) {
        const response = await fetchImplementation(`${base}${route}`, {
            method,
            headers: headers("application/vnd.github+json", body ? { "Content-Type": "application/json" } : {}),
            body: body ? JSON.stringify(body) : undefined,
        })
        await assertResponse(response, `${method} ${route}`)
        return response.status === 204 ? null : response.json()
    }

    function headers(accept, extra = {}) {
        return { Accept: accept, "User-Agent": "cmdb-release", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...extra }
    }

    async function assertResponse(response, operation) {
        if (response.ok) return
        const error = new Error(`GitHub ${operation}: HTTP ${response.status} ${await response.text()}`)
        error.status = response.status
        throw error
    }

    async function findRelease(tag, includeDrafts = false) {
        try { return await request("GET", `/releases/tags/${encodeURIComponent(tag)}`) }
        catch (error) { if (error.status !== 404) throw error }
        // GitHub's tag endpoint only promises published releases. Draft retries need
        // the authenticated release listing, including older pages.
        if (!includeDrafts) return null
        for (let page = 1; ; page++) {
            const releases = await request("GET", `/releases?per_page=100&page=${page}`)
            const match = releases.find((release) => release.tag_name === tag)
            if (match) return match
            if (releases.length < 100) return null
        }
    }

    async function tagCommit(tag) {
        let reference
        try { reference = await request("GET", `/git/ref/tags/${encodeURIComponent(tag)}`) }
        catch (error) { if (error.status === 404) return null; throw error }
        let object = reference.object
        for (let depth = 0; depth < 10; depth++) {
            if (object.type === "commit") return object.sha
            if (object.type !== "tag") break
            object = (await request("GET", `/git/tags/${object.sha}`)).object
        }
        throw new Error(`Cannot resolve ${tag} to a commit.`)
    }

    async function listProductReleases(product, limit) {
        const matches = []
        for (let page = 1; ; page++) {
            const releases = await request("GET", `/releases?per_page=100&page=${page}`)
            matches.push(...releases.filter((release) => !release.draft && identityFromTag(release.tag_name, product)))
            // Filtering must happen across pages: another product can fill an entire page.
            if (matches.length >= limit || releases.length < 100) return matches.slice(0, limit)
        }
    }

    async function downloadAsset(asset, destination) {
        // Use the authenticated API endpoint, including for assets in private repositories.
        const response = await fetchImplementation(`${base}/releases/assets/${asset.id}`, { headers: headers("application/octet-stream") })
        await assertResponse(response, `download ${asset.name}`)
        await pipeline(Readable.fromWeb(response.body), fs.createWriteStream(destination))
    }

    async function uploadAsset(release, filePath, name) {
        const uploadBase = release.upload_url.split("{")[0]
        const url = new URL(uploadBase)
        if (url.origin !== "https://uploads.github.com") throw new Error("Unexpected GitHub upload host.")
        url.searchParams.set("name", name)
        const response = await fetchImplementation(url, {
            method: "POST",
            headers: headers("application/vnd.github+json", {
                "Content-Type": "application/octet-stream",
                "Content-Length": String(fs.statSync(filePath).size),
            }),
            body: fs.createReadStream(filePath),
            duplex: "half",
        })
        await assertResponse(response, `upload ${name}`)
        return response.json()
    }

    async function packageAtCommit(commit) {
        const file = await request("GET", `/contents/package.json?ref=${encodeURIComponent(commit)}`)
        if (file.encoding !== "base64") throw new Error("Unexpected package.json API encoding.")
        return JSON.parse(Buffer.from(file.content, "base64").toString("utf8"))
    }

    return { request, findRelease, tagCommit, listProductReleases, downloadAsset, uploadAsset, packageAtCommit }
}

export async function publishRelease(client, manifest, distDirectory) {
    const existingCommit = await client.tagCommit(manifest.tag)
    if (existingCommit && existingCommit !== manifest.commit) {
        throw new Error(`${manifest.tag} already identifies a different commit. Bump package.json version.`)
    }
    let release = await client.findRelease(manifest.tag, true)
    if (release && !release.draft) throw new Error(`${manifest.tag} is already published. Bump package.json version for another release.`)
    if (release && release.target_commitish !== manifest.commit) throw new Error("Existing draft belongs to a different source commit.")

    if (!existingCommit) await client.request("POST", "/git/refs", { ref: `refs/tags/${manifest.tag}`, sha: manifest.commit })
    if (!release) {
        release = await client.request("POST", "/releases", {
            tag_name: manifest.tag,
            target_commitish: manifest.commit,
            name: `${manifest.product} ${manifest.version}`,
            body: `Product: ${manifest.product}\nVersion: ${manifest.version}\nSource: ${manifest.sourceRef}\nCommit: ${manifest.commit}\nRuntime: ${manifest.runtime.profile}`,
            draft: true,
            prerelease: manifest.version.split("+")[0].includes("-"),
            make_latest: "false",
        })
    }

    // Only unfinished drafts can be retried. Published assets are never replaced.
    for (const name of Object.values(artifactNames(manifest))) {
        for (const asset of release.assets.filter((asset) => asset.name === name)) {
            await client.request("DELETE", `/releases/assets/${asset.id}`)
        }
        await client.uploadAsset(release, `${distDirectory}/${name}`, name)
    }
    return client.request("PATCH", `/releases/${release.id}`, { draft: false, make_latest: "false" })
}
