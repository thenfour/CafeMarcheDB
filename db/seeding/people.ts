import { faker } from "@faker-js/faker";
import type { Prisma, User } from "@prisma/client";
import { generatePublicId } from "../../src/server/publicId";
import { probability, randomDate } from "./random";
import type { SeedingConfig } from "./config";

export const developmentPassword = "Demo1234!";

async function createSeedPerson(db: Prisma.TransactionClient, name: string, email: string,
    hashedPassword: string, globalRoleId: number | null, googleBootstrap: boolean, createdAt: Date): Promise<User> {
    return db.user.create({ data: {
        publicId: generatePublicId<"User">(), name, email, hashedPassword, globalRoleId,
        createdAt,
        isSysAdmin: globalRoleId !== null, phone: probability(0.85) ? faker.phone.number() : null,
        calendarFeedToken: faker.string.uuid(),
        signInMethods: { create: [
            { publicId: generatePublicId<"UserSignInMethod">(), type: "email", identifier: email, displayId: email, createdAt },
            ...(googleBootstrap ? [{ publicId: generatePublicId<"UserSignInMethod">(), type: "google" as const,
                identifier: `GOOGLE_FIRST_TIME_INSTALL_USER_EMAIL:${email}`, displayId: email, createdAt }] : []),
        ] },
    } });
}

export async function seedPeople(db: Prisma.TransactionClient, config: Readonly<SeedingConfig>, hashedPassword: string, now: Date) {
    const oldestAccount = new Date(now.valueOf() - Math.max(5 * 365, config.monthsBeforeNow * 31 + 2 * 365) * 86_400_000);
    // Founders precede even the oldest event in the configured history window.
    const foundersJoinedBy = new Date(now.valueOf() - (config.monthsBeforeNow * 31 + 180) * 86_400_000);
    const founderDate = () => randomDate(oldestAccount, foundersJoinedBy);
    const sysadmin = await db.globalRole.findFirstOrThrow({ where: { isSysAdminRole: true, isDeleted: false } });
    const admin = await createSeedPerson(db, "Development Platform Administrator", "admin@demo.invalid", hashedPassword, sysadmin.id, false, founderDate());
    const shared = await createSeedPerson(db, "Alex Shared", "shared@demo.invalid", hashedPassword, null, false, founderDate());
    const special: User[] = [];
    for (const [name, email] of [["Carl", "carlco@gmail.com"], ["Peter", "peter@gmail.com"], ["Guido", "guido@gmail.com"]]) {
        special.push(await createSeedPerson(db, name!, email!, hashedPassword, sysadmin.id, true, founderDate()));
    }
    const managers: User[] = [];
    for (let index = 0; index < config.bands; index++) {
        managers.push(await createSeedPerson(db, `Band ${index + 1} Manager`, `manager${index + 1}@demo.invalid`, hashedPassword, null, false, founderDate()));
    }
    const ordinary: User[] = [];
    const remaining = config.userCount - 5 - config.bands;
    for (let index = 0; index < remaining; index++) {
        const bandIndex = index % config.bands;
        const memberIndex = Math.floor(index / config.bands) + 1;
        const user = await createSeedPerson(db, faker.person.fullName(), `member${bandIndex + 1}-${memberIndex}@demo.invalid`, hashedPassword, null, false,
            randomDate(oldestAccount, new Date(now.valueOf() - 7 * 86_400_000)));
        const aliases: Prisma.UserSignInMethodCreateManyInput[] = [];
        const aliasCount = faker.number.int({ min: 0, max: 2 });
        for (let alias = 0; alias < aliasCount; alias++) {
            const email = `alias${alias + 1}-${user.publicId.toLowerCase()}@demo.invalid`;
            aliases.push({ publicId: generatePublicId<"UserSignInMethod">(), userId: user.id, type: "email", identifier: email, displayId: email,
                createdAt: randomDate(user.createdAt, now) });
        }
        await db.userSignInMethod.createMany({ data: aliases });
        ordinary.push(user);
    }
    return { admin, shared, special, managers, ordinary };
}

export type SeedPeople = Awaited<ReturnType<typeof seedPeople>>;
