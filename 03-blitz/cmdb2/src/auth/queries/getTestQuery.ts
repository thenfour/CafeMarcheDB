import { resolver } from "@blitzjs/rpc";
import db, { Prisma } from "db";
import { Permission } from "shared/permissions";


interface QueryParams {
    delayMilliseconds: number;
    seed: number;
};

const sleep = (ms: number, seed: number) => new Promise((resolve) => setTimeout(() => {
    resolve(`you slept for ${ms} millis with seed ${seed}`);
}, ms));

export default resolver.pipe(
    async (params: QueryParams, ctx) => {
        return await sleep(params.delayMilliseconds, params.seed);
    }
);



