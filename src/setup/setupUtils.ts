
// Utility function to seed a database table with items and log the created entries
export const SeedTable = async <Ttable extends { create: (inp: { data: TuncheckedCreateInput }) => any }, TuncheckedCreateInput>(tableName: string, table: Ttable, items: TuncheckedCreateInput[]) => {
    console.log(`Seeding table ${tableName}`);

    // This array will store the original input items along with their new primary keys
    type TUpdatedItem = (TuncheckedCreateInput & { id: number });
    const updatedItems: TUpdatedItem[] = [];

    for (let i = 0; i < items.length; ++i) {
        const ret = await table.create({
            data: items[i]!
        });

        // Create a new item entry with the id added
        const updatedItem: TUpdatedItem = {
            ...items[i]!,
            id: ret.id as number // Assuming 'id' is the primary key and is returned by the create method
        };

        // Add the new item to the updatedItems array
        updatedItems.push(updatedItem);

        // Logging depending on available properties
        if (ret.name) {
            console.log(`created '${tableName}': { name:'${ret.name}', id: '${ret.id}'}`);
        } else if (ret.text) {
            console.log(`created '${tableName}': { text:'${ret.text}', id: '${ret.id}'}`);
        } else {
            console.log(`created '${tableName}': { id: '${ret.id}'}`);
        }
    }

    // Return the updated array
    return updatedItems;
};


export const UpdateTable = async <Ttable extends { update: (inp: { data: TuncheckedUpdateInput, where: any }) => any }, TuncheckedUpdateInput>(tableName: string, matchField: string, table: Ttable, items: TuncheckedUpdateInput[]) => {
    for (let i = 0; i < items.length; ++i) {
        const item = items[i]!;
        const ret = await table.update({
            data: item,
            where: {
                [matchField]: item[matchField],
            }
        });

        if (ret.name) {
            console.log(`updated '${tableName}': { name:'${ret.name}', id: '${ret.id}'}`);
        } else if (ret.text) {
            console.log(`updated '${tableName}': { text:'${ret.text}', id: '${ret.id}'}`);
        } else {
            console.log(`updated '${tableName}': { id: '${ret.id}'}`);
        }
    }
};


