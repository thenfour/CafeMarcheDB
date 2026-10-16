import type { NextRouter } from "next/router";
import { vi } from "vitest";
import { CmdbClientRouter } from "src/route/clientRouter";
import type { CmdbRouterRequestArgs } from "src/route/portalRouting";

export function createTestRouter(config: CmdbRouterRequestArgs, overrides: Partial<NextRouter> = {}) {
    const nextRouter: NextRouter = {
        basePath: "", pathname: config.requestPath.internalPathname, route: config.requestPath.internalPathname,
        query: {}, asPath: config.requestPath.externalPathname,
        isLocaleDomain: false, isReady: true, isPreview: false, isFallback: false,
        push: vi.fn(async () => true), replace: vi.fn(async () => true),
        reload: vi.fn(), back: vi.fn(), forward: vi.fn(), prefetch: vi.fn(async () => {}),
        beforePopState: vi.fn(),
        events: { on: vi.fn(), off: vi.fn(), emit: vi.fn() },
        ...overrides,
    };
    return new CmdbClientRouter({ ...config, nextRouter });
}
