import type { xTable } from "../db3core";

//----------------------------------------------------------------------
// This runtime planner walks selections from different Prisma delegates. Leaf
// arguments (where/orderBy/etc.) are opaque and are preserved without changes.
//
// IOW, it takes your requested prisma `select:`, and augments it what's really
// necessary to satisfy the view. for example,
// - companion fields e.g., localized strings, inherited values...
// - foreign references / collections as necessary.
//----------------------------------------------------------------------

export interface DB3ReadSelectionArgs {
    readonly select?: DB3ReadSelectionMap | null;
    readonly include?: DB3ReadSelectionMap | null;
    readonly [argument: string]: unknown;
}

export interface DB3ReadSelectionMap {
    readonly [member: string]: boolean | DB3ReadSelectionArgs | null | undefined;
}

// Rows here belong to dynamically selected tables, not one concrete model.
type ReadRow = Readonly<Record<string, unknown>>;

export interface DB3ReadSelectionPlan {
    readonly selection: DB3ReadSelectionArgs;
    readonly stripSupportFields: (row: ReadRow) => ReadRow;
}

const isReadRow = (value: unknown): value is ReadRow => (
    value !== null && typeof value === "object" && !Array.isArray(value)
);

/** Add server fetch dependencies without changing the requested result shape. */
export function prepareDB3ReadSelection(
    table: xTable,
    requested: DB3ReadSelectionArgs,
    requiredRootMembers: readonly string[] = [],
): DB3ReadSelectionPlan {
    const supportMembers = new Set<string>();
    const relations = new Map<string, DB3ReadSelectionPlan>();
    const requestedMembers = requested.select ?? requested.include;
    let members = requestedMembers;
    const setMember = (member: string, value: boolean | DB3ReadSelectionArgs) => {
        members = { ...members, [member]: value };
    };

    const parentScope = table.bandScope?.via;
    if (parentScope && !requestedMembers?.[parentScope.relation]) {
        const parentField = table.prismaMemberRegistry.get(parentScope.relation);
        if (parentField?.kind !== "foreignObject") {
            throw new Error(`Band ownership requires a declared parent reference on ${table.tableID}.`);
        }
        supportMembers.add(parentScope.relation);
        const parentSelection = { select: {
            [table.bandScope!.member]: true, [parentScope.ownerUserMember]: true,
        } };
        setMember(parentScope.relation, prepareDB3ReadSelection(parentField.getTargetTable(), parentSelection).selection);
    }

    // include and implicit selections already fetch every scalar column.
    if (requested.select) {
        for (const member of [...table.getReadAuthorizationMembers(), ...requiredRootMembers]) {
            if (parentScope?.relation === member) {
                continue;
            }
            if (requested.select[member]) {
                continue;
            }
            supportMembers.add(member);
            setMember(member, true);
        }
        for (const field of table.columns) {
            if (!members?.[field.member]) {
                continue;
            }
            if (supportMembers.has(field.member)) {
                Object.keys(field.readCompanionSchemas ?? {}).forEach(member => supportMembers.add(member));
            }
            if ("stringIdentityMember" in field && typeof field.stringIdentityMember === "string") {
                if (!requested.select[field.stringIdentityMember]) supportMembers.add(field.stringIdentityMember);
                setMember(field.stringIdentityMember, true);
            }
            if (table.bandScope?.inheritedFrom && (field.inheritsValue || "stringIdentityMember" in field)) {
                const source = table.bandScope.inheritedFrom;
                if (!requested.select[source]) supportMembers.add(source);
                setMember(source, true);
            }
        }
    }

    for (const [member, value] of Object.entries(requestedMembers ?? {})) {
        if (!value || typeof value !== "object") {
            continue;
        }
        const ownership = table.prismaMemberRegistry.get(member);
        if (ownership?.kind !== "foreignObject" && ownership?.kind !== "relationCollection") {
            continue;
        }
        const relation = prepareDB3ReadSelection(ownership.getTargetTable(), value);
        relations.set(member, relation);
        if (relation.selection !== value) setMember(member, relation.selection);
    }

    return {
        selection: members === requestedMembers ? requested : {
            ...requested,
            [requested.select ? "select" : "include"]: members,
        },
        stripSupportFields: row => {
            const result = { ...row };
            for (const member of supportMembers) {
                delete result[member];
            }
            for (const [member, relation] of relations) {
                const value = result[member];
                if (Array.isArray(value)) {
                    result[member] = value.map(item => isReadRow(item) ? relation.stripSupportFields(item) : item);
                } else if (isReadRow(value)) {
                    result[member] = relation.stripSupportFields(value);
                }
            }
            return result;
        },
    };
}
