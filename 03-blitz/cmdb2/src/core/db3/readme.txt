// ok prisma, zod, mutations, queries, page, all have expressions of db schemas.
// can i do it less redundantly?

// the simplest example should be zod. each field should be deduceable. sure i understand that the db model doesn't
// describe how the application should expose them, but it should be close enough to just add hooks or column type descriptors.

// the prisma model is a closed language which i can't touch really. so that's going to stay the way it is.
// theoretically i could generate that schema from my own app schema, but that's going too far for v1.

// but zod stuff, mutations, queries, and datagrid columns should all be possible from 1 place.
// effectively, an extension of the prisma schema in typescript form.

// prisma schema:

model InstrumentFunctionalGroup {
  id          Int @id @default (autoincrement())
  name        String
  description        String @default ("")
  sortOrder   Int
  instruments Instrument[]
}

model Instrument {
  id                Int @id @default (autoincrement())
  name              String
  sortOrder         Int
  functionalGroupId Int
  functionalGroup   InstrumentFunctionalGroup @relation(fields: [functionalGroupId], references: [id], onDelete: Restrict) // if you want to delete a functional group, you need to manually reassign
  instrumentTags    InstrumentTagAssociation[]

  fileTags FileInstrumentTag[]
  users    UserInstrument[]
}

model InstrumentTag {
  id           Int @id @default (autoincrement())
  text         String
  sortOrder    Int @default (0)
  color        String ?
        significance String ? // "uses electricity" for example?
            instruments  InstrumentTagAssociation[]
}

// association table
model InstrumentTagAssociation {
  id           Int @id @default (autoincrement())
  instrumentId Int
  instrument   Instrument @relation(fields: [instrumentId], references: [id], onDelete: Cascade) // cascade delete association
  tagId        Int
  tag          InstrumentTag @relation(fields: [tagId], references: [id], onDelete: Cascade) // cascade delete association

    @@unique([instrumentId, tagId]) // 
}

// let's restate that then in code:

const XInstrumentFunctionalGroup = cmdb.Table({
    id: cmdb.PrimaryKeyField(),
    name: cmdb.SimpleStringField(),
    ...
});

/*
assume that all this is server-side code, which means queries & mutations are able to leverage it.
any validation can be done 
nullability can be deduced from the prisma model
cmdb.Table will also validate the schema against the prisma model, to make sure all columns are covered and with correct types.
how about relationships?
*/

const XInstrumentFunctionalGroup = cmdb.Table({
    id: cmdb.PrimaryKeyField(),
    name: cmdb.SimpleStringField({ ...}),
    instruments: cmdb.OneToManyForeignField<Instrument[]>({ ...}),
    ...
});

const XInstrument = cmdb.Table({
    id: cmdb.PrimaryKeyField(),
    name: cmdb.SimpleStringField({ ...}),
    functionalGroup: cmdb.OneToManyLocalField<XInstrumentFunctionalGroup>({ ...}),
    //functionalGroupId Int
    //functionalGroup   InstrumentFunctionalGroup @relation(fields: [functionalGroupId], references: [id], onDelete: Restrict) // if you want to delete a functional group, you need to manually reassign
});

/*
with that info, for example a datagrid should be able to know what to do with functionalGroup.

there will be server-specific code (blitz RPC mutations/queries) and client-specific code (React) which needs to also be included here.
how to arrange for that? i guess a similar annotated schema, but with client-specific info. actually it can be done automatically;
the field types have a 1:1 mapping with a client component.

so if a field needs some special treatment it can be done in a way that's server code compatible (as strings instead of React.ReactNode),
or create a new field type, etc.

one solution is to have an enum for field types. seems practical, and switch() that on client.

*/

// const XTableClient = <T>(table: T, tableClientDesc) => {
//     //
// };

// const XInstrumentClient = XTableClient(XInstrument, {

// });

<CMDataTable table={ XInstrument } />

const Column = ({ column }) => {

}

const CMDataTable = ({ table }) => {
    return table.columns.map(c => <Column column={ c } />)
}

