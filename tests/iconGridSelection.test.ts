import React from "react";
import { describe, expect, it, vi } from "vitest";
import { gNullValue } from "shared/rootroot";
import { gIconOptions } from "shared/utils";

vi.mock("src/core/db3/components/DB3ClientCore", () => ({ IColumnClient: class { constructor(args: object) { Object.assign(this, args); } } }));
vi.mock("src/core/db3/db3", () => ({}));
vi.mock("src/core/components/CMTextField", () => ({}));
vi.mock("src/core/components/markdown/Markdown", () => ({}));
vi.mock("src/core/components/markdown/MarkdownControl3", () => ({}));
vi.mock("src/core/components/SettingMarkdown", () => ({}));
vi.mock("src/core/components/CMCoreComponents2", () => ({}));
vi.mock("src/core/components/color/ColorPick", () => ({}));
vi.mock("src/core/components/dashboardContext/DashboardContext", () => ({}));
vi.mock("src/core/db3/components/IconMap", () => ({ RenderMuiIcon: () => null }));
vi.mock("src/core/components/CMLink", () => ({}));

import { IconFieldClient } from "src/core/db3/components/DB3ClientBasicFields";

describe("icon grid editor null boundary", () => {
    it.each([null, "Alarm"])("passes %s from the grid into the picker without exposing the null sentinel", value => {
        const column = new IconFieldClient({ columnName: "iconName", cellWidth: 150, allowNull: true });
        column.schemaColumn = { member: "iconName", options: gIconOptions, ValidateAndParse: () => ({ result: "success" }) } as any;
        column.onSchemaConnected({} as any);
        const grid = column.GridColProps!;
        const row = { id: 1, iconName: value };
        const api = { setEditCellValue: vi.fn() };
        const gridValue = grid.valueGetter!({ value, row } as any);
        // Exercise the inherited grid conversion as well as the icon-specific renderer.
        expect(gridValue).toBe(value === null ? gNullValue : value);
        const editor = grid.renderEditCell!({ id: 1, value: gridValue, row, api } as any) as React.ReactElement;
        expect(editor.props.value).toBe(value);
        expect(editor.props.allowNull).toBe(true);
        editor.props.onOK(null);
        expect(api.setEditCellValue).toHaveBeenCalledWith({ id: 1, field: "iconName", value: null });
        expect(grid.valueSetter!({ row, value: null } as any).iconName).toBeNull();
    });
});
