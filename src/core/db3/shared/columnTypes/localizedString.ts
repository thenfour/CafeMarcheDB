import type { LocalizedStringFormat } from "@prisma/client";
import type { DB3AuthSpec } from "../db3core";
import { GenericStringField } from "./genericString";

/** The read pipeline resolves these identities before DTO validation and hydration. */
export class LocalizedStringField<const TAuth extends DB3AuthSpec> extends GenericStringField<true, TAuth> {
    readonly stringIdentityMember: string;
    readonly stringFormat: LocalizedStringFormat;

    constructor(args: TAuth & { columnName: string; stringIdentityMember: string; stringFormat: LocalizedStringFormat }) {
        super({ ...args, allowNull: true, format: args.stringFormat === "Markdown" ? "markdown" : "plain" });
        this.stringIdentityMember = args.stringIdentityMember;
        this.stringFormat = args.stringFormat;
    }
}
