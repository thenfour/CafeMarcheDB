# Wiki editing locks

Each editor session owns a distinct lock token. A lease lasts 15 minutes and is renewed by editing activity (at most once per minute) or a successful save. Background presence does not renew or revoke it. Explicit close releases ownership; navigation cleanup is best effort, with expiration as the fallback.

Acquisition and saving use serializable transactions with bounded retries for serialization and unique-key conflicts. Saves require an unexpired token belonging to the current user, plus the draft's original revision ID and content version. Successful saves increment `WikiPage.contentVersion`, even when consolidating the current history revision. Administrative DB3 revision mutations also increment the displaying page's version in their transaction. Audit records for wiki saves share the content transaction.

Polling refreshes server state without changing the draft's base. A failed save leaves the editor open. Reacquisition checks that base; an explicit takeover can replace only the observed token belonging to the same user. A conflict comparison holds a fixed snapshot. Acknowledging reconciliation changes the base to that snapshot, so subsequent remote edits still cause a conflict.

Draft preservation means keeping the mounted editor's text. It does not provide persistence through a browser crash or forced reload.

## Deployment

Apply migration `20260915120000_wiki_content_version` before running the updated application. Existing pages start at version zero. Reload previously open wiki editors after deploying the changed RPC contract, after copying any unsaved text.

## Validation

`vitest run tests/wikiLocks.test.ts tests/wikiEditorSession.test.ts tests/authorization/wikiMetadataTelemetryHardening.test.ts`

The focused tests cover lease expiry, missing pings, ownership/takeover, consolidated versions, transaction retries, polling versus draft state, network failures, cleanup, and administrative version invalidation. These use mocked database calls and a jsdom editor-session harness; they do not replace a concurrent MySQL or interactive browser check.
