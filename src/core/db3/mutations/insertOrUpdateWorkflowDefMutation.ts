// insertOrUpdateWorkflowDefMutation
import { resolver } from "@blitzjs/rpc";
import { AuthenticatedCtx } from "blitz";
import { Prisma } from "db";
import { Permission } from "shared/permissions";
import { CreateChangeContext } from "shared/utils";
import * as db3 from "../db3";
import * as mutationCore from "../server/db3mutationCore";
import { TinsertOrUpdateWorkflowDefArgs } from "../shared/apiTypes";

export default resolver.pipe(
    resolver.authorize(Permission.login),
    async (args: TinsertOrUpdateWorkflowDefArgs, ctx: AuthenticatedCtx) => {

        const currentUser = await mutationCore.getCurrentUserCore(ctx);
        const clientIntention: db3.xTableClientUsageContext = {
            intention: "user",
            mode: "primary",
            currentUser,
        };

        debugger;
        const changeContext = CreateChangeContext(`insertOrUpdateWorkflow`);

        // create or update the workflowdef
        // export interface TinsertOrUpdateWorkflowDefArgs {
        //     id?: number; // for insertion, this is not used / specified.
        //     sortOrder: number;
        //     name: string;
        //     description: string;
        //     color?: string | null | undefined;
        //     isDefaultForEvents: boolean;
        //     groups: TinsertOrUpdateWorkflowDefGroup[];
        //     nodes: TinsertOrUpdateWorkflowDefNode[];
        // };

        // export interface TinsertOrUpdateWorkflowDefGroup {
        //     id?: number; // for insertion, this is not used / specified.
        //     // workflowDefId
        //     name: string;
        //     description: string;
        //     color?: string | null | undefined;

        //     positionX?: number | undefined;
        //     positionY?: number | undefined;
        //     width?: number | undefined;
        //     height?: number | undefined;
        //     selected: boolean;
        // };


        // export interface TinsertOrUpdateWorkflowDefNode {
        //     id?: number; // for insertion, this is not used / specified.
        //     dependencies: TinsertOrUpdateWorkflowDefNodeDependency[];
        //     defaultAssignees: TinsertOrUpdateWorkflowDefNodeDefaultAssignee[];

        //     name: string;
        //     description: string;

        //     groupId: number | null;
        //     //     workflowDefId Int?

        //     displayStyle: string;
        //     manualCompletionStyle: string;
        //     thisNodeProgressWeight: number;

        //     relevanceCriteriaType: string;
        //     activationCriteriaType: string;
        //     completionCriteriaType: string;

        //     fieldName?: string | undefined;
        //     fieldValueOperator?: string | undefined;
        //     fieldValueOperand2?: string | undefined;

        //     defaultDueDateDurationDaysAfterStarted?: number | undefined;
        //     positionX?: number | undefined;
        //     positionY?: number | undefined;
        //     width?: number | undefined;
        //     height?: number | undefined;
        //     selected: boolean;
        // };






        // export interface TinsertOrUpdateWorkflowDefNodeDefaultAssignee {
        //     id?: number; // for insertion, this is not used / specified.
        //     userId: number;
        //     // nodeDefId
        // };

        // export interface TinsertOrUpdateWorkflowDefNodeDependency {
        //     id?: number; // for insertion, this is not used / specified.

        //     selected: boolean;
        //     determinesRelevance: boolean;
        //     determinesActivation: boolean;
        //     determinesCompleteness: boolean;
        //     nodeDefId: number; // the other (child) node
        // };


        return args;
    }
);

