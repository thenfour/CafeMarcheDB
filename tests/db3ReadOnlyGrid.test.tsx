// @vitest-environment jsdom
import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import type { DataGridProps } from "@mui/x-data-grid";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Permission } from "shared/permissions";
import { kStaticLocalizedStringRegistry, type LocalizedPlainStringKey } from "src/locale/shared/staticLocalizedStringRegistry";
import { ServerPermissionSet } from "src/auth/server/ServerPermissionSet";
import { testServerAuthorization } from "./support/serverAuthorization";
import type { ClientOf } from "src/core/db3/shared/core/db3View";

type AuditGridProps = DataGridProps<ClientOf<typeof auditLogView>>;

vi.mock("src/core/db3/components/useClientAuth", () => ({ useClientAuth: () => auth }));
vi.mock("src/core/db3/components/useDB3Context", () => ({ useDB3QueryContext: () => ({ routeLocale: "fr-BE" }) }));
vi.mock("src/core/components/dashboardContext/DashboardContext", () => ({ useDashboardContext: () => ({ isShowingAdminControls: false }) }));
vi.mock("src/core/components/SnackbarContext", () => ({ SnackbarContext: React.createContext({ showMessage: vi.fn() }) }));
vi.mock("src/locale/components/useLocale", () => ({ useLocale: () => ({ getPlainString: (key: LocalizedPlainStringKey) => kStaticLocalizedStringRegistry[key].defaultValue }) }));
vi.mock("@components/DateTime/RelativeTimeComponents", () => ({ AgeRelativeToNow: () => <span /> }));
vi.mock("@blitzjs/rpc", async () => ({ ...await vi.importActual<typeof import("@blitzjs/rpc")>("@blitzjs/rpc"),
    usePaginatedQuery: (_query: unknown, input: unknown) => {
        request = input;
        return [{ items: [row], count: 1, executionTimeMillis: 1, resultId: "fixture" }, { refetch: vi.fn(), dataUpdatedAt: 1 }];
    },
}));
vi.mock("@mui/x-data-grid", async () => ({ ...await vi.importActual<typeof import("@mui/x-data-grid")>("@mui/x-data-grid"),
    DataGrid: (props: AuditGridProps) => {
        rendered = props;
        return <div role="grid">{props.rows.map(item => <div key={item.id}>{item.recordId}</div>)}</div>;
    },
}));

import { DB3EditGrid } from "src/core/db3/components/db3DataGrid";
import { defineTableClientSpec, PKColumnClient } from "src/core/db3/DB3Client";
import { auditLogView } from "src/core/db3/shared/audit/auditViews";
import { DB3ReferenceStore } from "src/core/db3/shared/core/db3Hydration";

const auth = testServerAuthorization({ id: 1 }, new ServerPermissionSet([{ id: 1, name: Permission.sysadmin }]));
const row = { id: 1, action: "update", table: "Event", recordId: 987, context: "fixture", operationId: "operation",
    changedAt: new Date(), oldValues: null, newValues: null, userId: 10,
};
let rendered: AuditGridProps;
let request: unknown;
let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
});
afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
});

describe("named read-only DB3 grids", () => {
    it("hydrates named rows through their explicit provider without requiring CRUD or offering writes", async () => {
        const tableSpec = defineTableClientSpec({ view: auditLogView, columns: { id: columnName => new PKColumnClient({ columnName }) } });
        await act(async () => root.render(<DB3EditGrid view={auditLogView} tableSpec={tableSpec} referenceProvider={new DB3ReferenceStore()}
            readOnly tableParams={{ tableNames: ["Event"] }} />));
        expect(container.textContent).toContain("987");
        expect(container.textContent).not.toContain("Copy for seeding");
        expect(rendered.columns.every(column => column.editable !== true)).toBe(true);
        expect(rendered.slotProps?.toolbar?.disableCreate).toBe(true);
        expect(request).toMatchObject({ table: { viewID: "Change_AuditLog" }, routeLocale: "fr-BE", filter: { tableParams: { tableNames: ["Event"] } } });
    });
});
