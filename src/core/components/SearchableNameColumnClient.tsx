import { useCurrentUser } from "src/auth/hooks/useCurrentUser";
import * as DB3Client from "src/core/db3/DB3Client";
import * as db3 from "src/core/db3/db3";
import { CMTextInputBase, CMTextInputBaseProps } from "./CMTextField";



//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
interface TextInputWithSearchProps extends CMTextInputBaseProps {
    columnName: string;
    schema: db3.xTable;
    allowSearch: boolean;
};
const TextInputWithSearch = (props: TextInputWithSearchProps) => {
    const searchQuery = props.value || "";

    const clientIntention: db3.xTableClientUsageContext = { intention: "user", mode: 'primary' };
    const [currentUser] = useCurrentUser();
    clientIntention.currentUser = currentUser!;

    const songsClient = DB3Client.useTableRenderContext({
        tableSpec: new DB3Client.xTableClientSpec({
            table: props.schema,
            columns: [
                new DB3Client.PKColumnClient({ columnName: "id" }),
                new DB3Client.GenericStringColumnClient({ columnName: props.columnName, cellWidth: 120 }),
            ],
        }),
        filterModel: {
            quickFilterValues: [searchQuery],
            items: [],
        },
        paginationModel: {
            page: 0,
            pageSize: 1,
        },
        requestedCaps: DB3Client.xTableClientCaps.PaginatedQuery,
        clientIntention,
    });

    const items = songsClient.items as db3.SongPayload_Verbose[];

    return <div className="searchableValueContainer">
        <CMTextInputBase {...props} />
        {(items.length > 0) && (searchQuery.length > 2) && props.allowSearch &&
            <div className="searchableValueResult">
                <div className="existingMatchLabel">Existing match:</div>
                <div className="existingMatchValue">{items[0]![props.columnName]}</div>
                <div className="littleHelpText">Try to avoid creating duplicate items</div>
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
            onChange={(e, val) => params.api.setFieldValues({ [this.columnName]: val })}
            autoFocus={params.autoFocus}
            value={params.value as string}
            className={this.className}

            allowSearch={!params.validationResult || !!params.validationResult.success}
            columnName={this.columnName}
            schema={this.schemaTable}
        />
    });
};
