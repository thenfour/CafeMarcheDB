// saveEventWorkflowModel
import { resolver } from "@blitzjs/rpc";
import { AuthenticatedCtx } from "blitz";
import { Prisma } from "db";
import { ComputeChangePlan } from "shared/associationUtils";
import { Permission } from "shared/permissions";
import { ObjectDiff, passthroughWithoutTransaction } from "shared/utils";
import * as db3 from "../db3";
import * as mutationCore from "../server/db3mutationCore";
import { gWorkflowMutex, MockEvent, ZSaveModelMutationInput } from "../server/eventWorkflow";
import { ChangeAction, CreateChangeContext, RegisterChange } from "shared/activityLog";

export default resolver.pipe(
    resolver.zod(ZSaveModelMutationInput),
    resolver.authorize(Permission.edit_workflow_instances),
    async (args, ctx: AuthenticatedCtx) => {
        return gWorkflowMutex.runExclusive(async () => {

            //return await db.$transaction(async (transactionalDb) => {
            return await passthroughWithoutTransaction(async (transactionalDb) => {
                const changeContext = CreateChangeContext(`insertOrUpdateEventWorkflowInstance`);

                const eventUpdateModel: Prisma.EventUpdateInput = {};
                let newEventTagIds: number[] | undefined;
                const customFieldUpdates: Prisma.EventCustomFieldValueUncheckedCreateInput[] = [];

                const customFields = await transactionalDb.eventCustomField.findMany();
                const existingCustomFieldValues = await transactionalDb.eventCustomFieldValue.findMany({ where: { eventId: args.eventId } });
                //const oldEvent = await transactionalDb.event.findFirst({ where: { id: args.eventId } });

                // collect updates
                for (const valueKey of Object.keys(args.values)) {
                    const member: keyof MockEvent = valueKey as any;
                    const value = args.values[valueKey];
                    switch (member) {
                        case "name":
                        //case "description":
                        case "locationDescription":
                        case "typeId":
                        case "statusId":
                        case "expectedAttendanceUserTagId":
                        case "frontpageVisible":
                            eventUpdateModel[member] = value;
                            break;
                        case "tagIds":
                            const tagIds: MockEvent["tagIds"] = value;
                            newEventTagIds = [...tagIds];
                            break;
                        default:
                            {
                                // custom value
                                const cf = customFields.find(x => x.id === db3.GetCustomFieldIdFromMember(member));
                                if (!cf) {
                                    throw new Error(`no updateable value or custom field value matches '${member}'`);
                                }
                                customFieldUpdates.push({
                                    customFieldId: cf.id,
                                    eventId: args.eventId,
                                    dataType: cf.dataType,
                                    jsonValue: JSON.stringify(value),
                                });
                            }
                    }
                }

                // execute updates...

                // tags:
                if (newEventTagIds) {
                    await mutationCore.UpdateAssociations({
                        changeContext,
                        ctx,
                        column: db3.xEvent.getColumn("tags") as any,
                        desiredTagIds: newEventTagIds,
                        localTable: db3.xEvent,
                        localId: args.eventId,
                    });
                }

                // event:
                if (Object.keys(eventUpdateModel).length > 0) {
                    await transactionalDb.event.update({
                        where: { id: args.eventId },
                        data: eventUpdateModel,
                    });
                }

                // custom fields
                {
                    const plan = ComputeChangePlan(existingCustomFieldValues, customFieldUpdates, (a, b) => {
                        return a.customFieldId === b.customFieldId;
                    });

                    await transactionalDb.eventCustomFieldValue.createMany({
                        data: plan.create,
                    });

                    for (const cf of plan.potentiallyUpdate) {
                        const diff = ObjectDiff(cf.a, cf.b);
                        if (diff.areDifferent) {
                            const id = diff.differences.lhs.id || diff.similarities.id!;
                            if (!id) throw new Error();
                            await transactionalDb.eventCustomFieldValue.update({
                                where: { id },
                                data: diff.differences.rhs
                            });
                        }
                    }

                    await transactionalDb.eventCustomField.deleteMany({
                        where:
                        {
                            id: {
                                in: plan.delete.map(x => x.id!)
                            }
                        }
                    });
                }

                await mutationCore.CallMutateEventHooks({
                    tableNameOrSpecialMutationKey: "mutation:saveEventWorkflowModel",
                    model: { id: args.eventId },
                    db: transactionalDb,
                });

                await RegisterChange({
                    action: ChangeAction.update,
                    changeContext,
                    ctx,
                    pkid: args.eventId,
                    table: "saveEventWorkflowModel",
                    db: transactionalDb,
                    options: {
                        dontCalculateChanges: true,
                    },
                    oldValues: undefined,
                    newValues: {
                        eventUpdateModel,
                        customFieldUpdates,
                        newEventTagIds,
                    }
                });
            }); // transaction
        }); // mutex
    } // async (args, ctx)
); // resolver.pipe

