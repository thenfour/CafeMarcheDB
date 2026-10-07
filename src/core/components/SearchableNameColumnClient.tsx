import * as DB3Client from "src/core/db3/DB3Client";
import * as db3 from "src/core/db3/db3";
import { CMTextInputBase, CMTextInputBaseProps } from "./CMTextField";
import { useLocale } from "src/locale/components/useLocale";



//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export interface TextInputWithSearchProps extends CMTextInputBaseProps, DB3Client.ColumnPresentationArgs {
    columnName: string;
    schema: db3.xTable;
    allowSearch: boolean;
};
export const TextInputWithSearch = (props: TextInputWithSearchProps) => {
    const locale = useLocale();
    const { fieldCaptionKey, fieldDescriptionKey, columnName, schema, allowSearch, ...inputProps } = props;
    const searchQuery = props.value || "";

    // i'm almost certain the only columnName used here is `name`;
    // hard-coding that and asserting it in callers can allow use of the newer style table clients.
    const songsClient = DB3Client.useLegacyTableRenderContext({
        tableSpec: DB3Client.defineLegacyDynamicTableClientSpec({
            table: props.schema,
            columns: [
                new DB3Client.PKColumnClient({ columnName: "id" }),
                new DB3Client.GenericStringColumnClient({ fieldCaptionKey, fieldDescriptionKey, columnName, cellWidth: 120 }),
            ],
        }),
        filterModel: {
            quickFilterValues: [searchQuery],
        },
        paginationModel: {
            page: 0,
            pageSize: 1,
        },
        requestedCaps: DB3Client.xTableClientCaps.PaginatedQuery,
    });

    const items = songsClient.items;

    return <div className="searchableValueContainer">
        <CMTextInputBase {...inputProps} />
        {(items.length > 0) && (searchQuery.length > 2) && allowSearch &&
            <div className="searchableValueResult">
                <div className="existingMatchLabel">{locale.getPlainString("db3.search.existingMatch")}</div>
                <div className="existingMatchValue">{items[0]![props.columnName]}</div>
                <div className="littleHelpText">{locale.getPlainString("db3.search.avoidDuplicates")}</div>
            </div>}
    </div>;
};


//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// here we just want to have a column which allows checking if an object of similar name already exists
export interface SearchableNameColumnArgs extends DB3Client.GenericStringColumnArgs {
    //
};

export class SearchableNameColumnClient extends DB3Client.GenericStringColumnClient {
    constructor(args: SearchableNameColumnArgs) {
        super(args);
    }
    renderForNewDialog = (params: DB3Client.RenderForNewItemDialogArgs) => this.defaultRenderer({
        validationResult: params.validationResult,
        isReadOnly: false,
        value: <TextInputWithSearch
            aria-label={this.fieldCaption}
            onChange={(e, val) => params.api.setFieldValues({ [this.columnName]: val })}
            autoFocus={params.autoFocus}
            value={params.value as string}
            className={this.className}

            allowSearch={!params.validationResult || !!params.validationResult.success}
            columnName={this.columnName}
            schema={this.schemaTable}
            fieldCaptionKey={this.fieldCaptionKey}
            fieldDescriptionKey={this.fieldDescriptionKey}
        />
    });
};
