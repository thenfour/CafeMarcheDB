import { z } from "zod";
import * as db3 from "../db3";
import type { UserWithRolesPayload } from "../shared/schema/userPayloads";

const MAX_FILTER_ITEMS = 100;
const MAX_FILTER_VALUES = 1000;
const MAX_MODEL_FIELDS = 200;
const MAX_QUERY_TEXT_LENGTH = 500;
const MAX_TAKE = 1000;

const SafeInteger = z.number().int().refine(Number.isSafeInteger, "Expected a safe integer");
const RecordId = SafeInteger.refine(value => value > 0, "Expected a positive record ID");
const Take = SafeInteger.refine(value => value >= 1 && value <= MAX_TAKE, `Expected a value between 1 and ${MAX_TAKE}`);
const Skip = SafeInteger.refine(value => value >= 0 && value <= 10_000_000, "Expected a value between 0 and 10000000");
const Delay = SafeInteger.refine(value => value >= 0 && value <= 2_000, "Expected a value between 0 and 2000");
const Identifier = z.string().min(1).max(128).regex(/^[A-Za-z][A-Za-z0-9_]*$/);
const ScalarFilterValue = z.union([
    z.string().max(10_000),
    z.number().finite(),
    z.boolean(),
    z.date(),
    z.null(),
]);

const FilterItemSchema = z.object({
    id: z.union([SafeInteger, z.string().max(100)]).optional(),
    field: Identifier,
    value: ScalarFilterValue,
    operator: z.literal("equals"),
}).strict();

const FilterModelSchema = z.object({
    items: z.array(FilterItemSchema).max(MAX_FILTER_ITEMS),
    quickFilterValues: z.array(z.string().max(MAX_QUERY_TEXT_LENGTH)).max(20).optional(),
    pks: z.array(SafeInteger).max(MAX_FILTER_VALUES).optional(),
    tagIds: z.array(SafeInteger).max(MAX_FILTER_VALUES).optional(),
    tableParams: z.record(z.unknown()).optional(),
}).strict();

const OrderBySchema = z.record(z.enum(["asc", "desc"]))
    .refine(value => Object.keys(value).length === 1, "Exactly one order field is required");

const QueryBaseShape = {
    tableID: Identifier,
    tableName: Identifier,
    orderBy: OrderBySchema.optional(),
    filter: FilterModelSchema,
    cmdbQueryContext: z.string().min(1).max(MAX_QUERY_TEXT_LENGTH),
    delayMS: Delay.optional(),
};

const QueryRequestSchema = z.object({
    ...QueryBaseShape,
    take: Take.optional(),
}).strict();

const PaginatedQueryRequestSchema = z.object({
    ...QueryBaseShape,
    skip: Skip,
    take: Take,
}).strict();

const MutationModelSchema = z.record(z.unknown())
    .refine(value => Object.keys(value).length <= MAX_MODEL_FIELDS, `At most ${MAX_MODEL_FIELDS} model fields are allowed`);

const MutationRequestSchema = z.discriminatedUnion("mutationType", [
    z.object({
        tableID: Identifier,
        tableName: Identifier,
        mutationType: z.literal("delete"),
        deleteId: RecordId,
        deleteType: z.enum(["softWhenPossible", "hard"]),
    }).strict(),
    z.object({
        tableID: Identifier,
        tableName: Identifier,
        mutationType: z.literal("insert"),
        insertModel: MutationModelSchema,
    }).strict(),
    z.object({
        tableID: Identifier,
        tableName: Identifier,
        mutationType: z.literal("update"),
        updateId: RecordId,
        updateModel: MutationModelSchema,
    }).strict(),
]);

export class DB3RequestValidationError extends Error {
    constructor(message: string) {
        super(`Invalid DB3 request: ${message}`);
        this.name = "DB3RequestValidationError";
    }
}

function parseRequest<T>(schema: z.ZodType<T>, input: unknown, pathPrefix?: string): T {
    const result = schema.safeParse(input);
    if (result.success) return result.data;

    const issues = result.error.issues.map(issue => {
        const issuePath = issue.path.length ? issue.path.join(".") : "";
        const path = [pathPrefix, issuePath].filter(Boolean).join(".") || "request";
        return `${path}: ${issue.message}`;
    });
    throw new DB3RequestValidationError(issues.join("; "));
}

function getRequestTable(tableID: string, tableName: string): db3.xTable {
    let table: db3.xTable;
    try {
        table = db3.GetTableById(tableID);
    } catch {
        throw new DB3RequestValidationError(`unknown table ID '${tableID}'`);
    }

    if (tableID !== table.tableID) {
        throw new DB3RequestValidationError(`table ID must use its registered spelling '${table.tableID}'`);
    }
    if (tableName !== table.tableName) {
        throw new DB3RequestValidationError(`table name '${tableName}' does not match table ID '${tableID}'`);
    }
    return table;
}

function getKnownFieldNames(table: db3.xTable): Set<string> {
    const names = new Set<string>([table.pkMember]);
    table.columns.forEach(column => {
        names.add(column.member);
        if (column.fkidMember) names.add(column.fkidMember);
    });
    return names;
}

function validateFieldName(table: db3.xTable, fieldName: string, purpose: string): void {
    if (!getKnownFieldNames(table).has(fieldName)) {
        throw new DB3RequestValidationError(`unknown ${purpose} field '${fieldName}' on table '${table.tableID}'`);
    }
}

function schemaForQueryParameter(spec: db3.DB3QueryParameterSpec): z.ZodTypeAny {
    let schema: z.ZodTypeAny;
    switch (spec.kind) {
        case "boolean":
            schema = z.boolean();
            break;
        case "date":
            schema = z.date().refine(value => !Number.isNaN(value.valueOf()), "Expected a valid date");
            break;
        case "integer":
            schema = SafeInteger;
            break;
        case "integerArray":
            schema = z.array(SafeInteger).max(MAX_FILTER_VALUES);
            break;
        case "string":
            schema = z.string().max(MAX_QUERY_TEXT_LENGTH);
            break;
        case "stringArray":
            schema = z.array(z.string().max(MAX_QUERY_TEXT_LENGTH)).max(MAX_FILTER_VALUES);
            break;
    }

    if (spec.nullable) schema = schema.nullable();
    if (!spec.required) schema = schema.optional();
    return schema;
}

function validateTableParameters(table: db3.xTable, params: Record<string, unknown> | undefined): Record<string, unknown> {
    const shape = Object.fromEntries(
        Object.entries(table.queryParameters || {}).map(([name, spec]) => [name, schemaForQueryParameter(spec)]),
    );
    return parseRequest(z.object(shape).strict(), params || {}, "filter.tableParams");
}

function validateQueryForTable<T extends db3.QueryRequestInput | db3.PaginatedQueryRequestInput>(input: T): T {
    const table = getRequestTable(input.tableID, input.tableName);

    input.filter.items.forEach(item => validateFieldName(table, item.field, "filter"));
    if (input.orderBy) {
        validateFieldName(table, Object.keys(input.orderBy)[0]!, "order");
    }
    input.filter.tableParams = validateTableParameters(table, input.filter.tableParams);
    return input;
}

export function validateDB3QueryRequest(input: unknown): db3.QueryRequestInput {
    return validateQueryForTable(parseRequest(QueryRequestSchema, input) as db3.QueryRequestInput);
}

export function validateDB3PaginatedQueryRequest(input: unknown): db3.PaginatedQueryRequestInput {
    return validateQueryForTable(parseRequest(PaginatedQueryRequestSchema, input) as db3.PaginatedQueryRequestInput);
}

export function validateDB3MutationRequest(input: unknown): db3.MutatorInput {
    const parsed = parseRequest(MutationRequestSchema, input) as db3.MutatorInput;
    const table = getRequestTable(parsed.tableID, parsed.tableName);

    if (parsed.mutationType === "insert") {
        Object.keys(parsed.insertModel).forEach(field => validateFieldName(table, field, "mutation"));
    }
    if (parsed.mutationType === "update") {
        Object.keys(parsed.updateModel).forEach(field => validateFieldName(table, field, "mutation"));
        if (Object.prototype.hasOwnProperty.call(parsed.updateModel, table.pkMember)
            && parsed.updateModel[table.pkMember] !== parsed.updateId) {
            throw new DB3RequestValidationError(`update model field '${table.pkMember}' must match updateId`);
        }
    }
    return parsed;
}

type DB3RpcEndpoint = "mutation" | "paginatedQuery" | "query";

// create a clientintention based on context... actually it's not perfect, but
// that's largely because clientintention is a bit of a fuzzy concept. this is required
// to maintain parity with as-is behavior, while no longer trusting client-provided intentions.
export function deriveDB3ClientIntention(
    endpoint: DB3RpcEndpoint,
    currentUser: UserWithRolesPayload | null,
): db3.xTableClientUsageContext {
    if (!currentUser) {
        if (endpoint !== "query") {
            throw new DB3RequestValidationError(`${endpoint} requires an authenticated database user`);
        }
        return { intention: "public", mode: "primary", currentUser: undefined };
    }

    return {
        intention: currentUser.isSysAdmin ? "admin" : "user",
        mode: "primary",
        currentUser,
    };
}
