import { makeServerSidePermissionGuard } from "@/src/auth/server/serverPageAuthorization";
import DashboardLayout from "@/src/core/components/dashboard/DashboardLayout";
import { BlitzPage } from "@blitzjs/next";
import { Box, Button, Checkbox, FormControlLabel, MenuItem, Paper, Stack, TextField, Typography } from "@mui/material";
import React from "react";
import { Permission } from "shared/permissions";
import { sleep } from "shared/utils";
import { CMChipShapeOptions, CMChipSizeOptions } from "src/core/components/CMChip";
import { CMMultiSelect, CMSelectDisplayStyle, CMSingleSelect, StringArrayOptionsProvider } from "src/core/components/select/CMSelect";
import { CMSelectNullBehavior, CMSingleSelectDialog } from "src/core/components/select/CMSingleSelectDialog";
import { DB3MultiSelect, DB3SingleSelect } from "src/core/db3/components/db3Select";
import * as db3 from "src/core/db3/db3";

const numbers = [0, 1, 2, 4, 6, 8];
const numberOptions = StringArrayOptionsProvider(numbers);
const people = [{ id: 1, name: "Alex Martin" }, { id: 2, name: "Sam Dupont" }, { id: 3, name: "Charlie Laurent" }];
const getPersonInfo = (person: typeof people[number]) => ({ id: person.id, name: person.name, color: "blue" });
const renderPerson = (person: typeof people[number]) => person.name;

const Example = (props: React.PropsWithChildren<{ title: string; description: string; value: unknown }>) => <Paper component="section" variant="outlined" sx={{ p: 2.5, minWidth: 0, borderRadius: 2 }}>
    <Typography variant="h6" component="h2">{props.title}</Typography>
    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 2 }}>{props.description}</Typography>
    {props.children}
    <Typography variant="caption" component="div" color="text.secondary" sx={{ mt: 2, overflowWrap: "anywhere" }}>Value: {props.value === undefined ? "undefined" : JSON.stringify(props.value)}</Typography>
</Paper>;

// A practical gallery of the public CM and DB3 APIs, all backed by the same picker UI.
export const SelectionExamples = () => {
    const [single, setSingle] = React.useState(0);
    const [nullable, setNullable] = React.useState<number | null>(null);
    const [optional, setOptional] = React.useState<number | undefined>();
    const [multi, setMulti] = React.useState([1, 4]);
    const [person, setPerson] = React.useState<typeof people[number] | undefined>();
    const [confirmed, setConfirmed] = React.useState(1);
    const [confirmOpen, setConfirmOpen] = React.useState(false);
    const failNext = React.useRef(false);
    const getPeople = React.useCallback(async () => {
        await sleep(500);
        if (failNext.current) { failNext.current = false; throw new Error("Example loading failure"); }
        return people;
    }, []);
    const [instrument, setInstrument] = React.useState<db3.InstrumentClientPayload | null>(null);
    const [instruments, setInstruments] = React.useState<db3.InstrumentClientPayload[]>([]);
    const [tags, setTags] = React.useState<db3.InstrumentTagEditorClient[]>([]);
    const [group, setGroup] = React.useState<db3.InstrumentFunctionalGroupClientPayload | null>(null);
    const [user, setUser] = React.useState<db3.UserPayloadMinimum | null>(null);
    const [displayStyle, setDisplayStyle] = React.useState(CMSelectDisplayStyle.SelectedWithDialog);
    const [readonly, setReadonly] = React.useState(false);
    const [chipSize, setChipSize] = React.useState<CMChipSizeOptions>("small");
    const [chipShape, setChipShape] = React.useState<CMChipShapeOptions>("rectangle");
    const shared = { displayStyle, readonly, chipSize, chipShape };

    return <Box sx={{ maxWidth: 1100, mx: "auto", p: { xs: 2, md: 3 } }}>
        <Typography variant="h4" component="h1">Picker examples</Typography>
        <Typography color="text.secondary" sx={{ mt: 1, mb: 3 }}>Single and multiple choices, local and asynchronous options, and database-backed fields.</Typography>
        <Paper variant="outlined" sx={{ p: 2, mb: 3, borderRadius: 2 }}>
            <Stack direction="row" useFlexGap flexWrap="wrap" spacing={2} alignItems="center">
                <TextField select label="Display" size="small" value={displayStyle} onChange={event => setDisplayStyle(event.target.value as CMSelectDisplayStyle)} sx={{ minWidth: 210 }}>
                    <MenuItem value={CMSelectDisplayStyle.SelectedWithDialog}>Selected values + dialog</MenuItem>
                    <MenuItem value={CMSelectDisplayStyle.AllWithDialog}>All values + dialog</MenuItem>
                    <MenuItem value={CMSelectDisplayStyle.AllWithInlineEditing}>Inline editing + dialog</MenuItem>
                </TextField>
                <TextField select label="Chip size" size="small" value={chipSize} onChange={event => setChipSize(event.target.value as CMChipSizeOptions)} sx={{ minWidth: 120 }}>
                    <MenuItem value="small">Small</MenuItem><MenuItem value="big">Large</MenuItem>
                </TextField>
                <TextField select label="Chip shape" size="small" value={chipShape} onChange={event => setChipShape(event.target.value as CMChipShapeOptions)} sx={{ minWidth: 135 }}>
                    <MenuItem value="rectangle">Rectangle</MenuItem><MenuItem value="rounded">Rounded</MenuItem>
                </TextField>
                <FormControlLabel control={<Checkbox checked={readonly} onChange={event => setReadonly(event.target.checked)} />} label="Read only" />
            </Stack>
        </Paper>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "repeat(2, minmax(0, 1fr))" }, gap: 2 }}>
            <Example title="One choice" description="Selecting a value accepts it immediately. Zero is a valid choice." value={single}>
                <CMSingleSelect {...shared} {...numberOptions} value={single} onChange={setSingle} dialogTitle="Choose a number" />
            </Example>
            <Example title="Multiple choices" description="Checkboxes edit a draft. Apply keeps it; Cancel discards it." value={multi}>
                <CMMultiSelect {...shared} {...numberOptions} value={multi} onChange={setMulti} dialogTitle="Choose numbers" />
            </Example>
            <Example title="Optional choice" description="An explicit None option clears the value to null." value={nullable}>
                <CMSingleSelect {...shared} {...numberOptions} value={nullable} onChange={setNullable} nullBehavior={CMSelectNullBehavior.AllowNull} dialogTitle="Choose an optional number" />
            </Example>
            <Example title="Undefined value" description="The same interaction can represent an unset value as undefined." value={optional}>
                <CMSingleSelect {...shared} {...numberOptions} value={optional} onChange={setOptional} nullBehavior={CMSelectNullBehavior.AllowUndefined} dialogTitle="Choose a number or leave unset" />
            </Example>
            <Example title="Asynchronous choices" description="Simulated network delay, search, and a recoverable loading error." value={person?.name}>
                <CMSingleSelect {...shared} getOptions={getPeople} getOptionInfo={getPersonInfo} renderOption={renderPerson} value={person} onChange={setPerson} nullBehavior={CMSelectNullBehavior.AllowUndefined} dialogTitle="Choose a person" />
                <Button size="small" onClick={() => { failNext.current = true; }} disabled={readonly} sx={{ mt: 1 }}>Fail the next load</Button>
            </Example>
            <Example title="Confirm a single choice" description="Radio buttons let you review a choice before pressing Apply." value={confirmed}>
                <Button variant="outlined" disabled={readonly} onClick={() => setConfirmOpen(true)}>Review choice: {confirmed}</Button>
                {confirmOpen && <CMSingleSelectDialog {...numberOptions} chipSize={chipSize} chipShape={chipShape} value={confirmed} closeOnSelect={false} title="Confirm your number" description="Choose one number, then apply your change." onCancel={() => setConfirmOpen(false)} onOK={value => { setConfirmed(value); setConfirmOpen(false); }} />}
            </Example>
            <Example title="Custom trigger" description="A caller can supply its own opener while using the same picker." value={single}>
                <CMSingleSelect {...shared} {...numberOptions} value={single} onChange={setSingle} displayStyle={CMSelectDisplayStyle.CustomButtonWithDialog} dialogTitle="Choose a number"
                    customRender={open => <Button variant="outlined" disabled={readonly} onClick={open}>Choose number: {single}</Button>} />
            </Example>
            <Example title="Instrument" description="DB3 supplies the available instruments, labels, and colors." value={instrument?.name || null}>
                <DB3SingleSelect {...shared} schema={db3.xInstrument} value={instrument} onChange={setInstrument} nullBehavior={CMSelectNullBehavior.AllowNull} dialogTitle="Choose an instrument" />
            </Example>
            <Example title="Several instruments" description="The DB3 multi-select uses the same picker and draft behavior." value={instruments.map(item => item.name)}>
                <DB3MultiSelect {...shared} schema={db3.xInstrument} value={instruments} onChange={setInstruments} dialogTitle="Choose instruments" />
            </Example>
            <Example title="Instrument tags" description="Search and create a tag when the schema and your permissions allow it. New tags are saved immediately." value={tags.map(item => item.text)}>
                <DB3MultiSelect {...shared} schema={db3.xInstrumentTag} view={db3.instrumentTagEditorView} value={tags} onChange={setTags} allowInsertFromString dialogTitle="Choose instrument tags" />
            </Example>
            <Example title="Instrument group" description="Creation is also available to single-choice fields when permitted." value={group?.name || null}>
                <DB3SingleSelect {...shared} schema={db3.xInstrumentFunctionalGroup} view={db3.instrumentFunctionalGroupEditorView} value={group} onChange={setGroup} nullBehavior={CMSelectNullBehavior.AllowNull} allowInsertFromString dialogTitle="Choose an instrument group" />
            </Example>
            <Example title="User" description="A minimal DB3 picker needs only a schema, value, and change handler." value={user?.name || null}>
                <DB3SingleSelect {...shared} schema={db3.xUser} value={user} onChange={setUser} nullBehavior={CMSelectNullBehavior.AllowNull} dialogTitle="Choose a user" />
            </Example>
        </Box>
    </Box>;
};

const CMSelectTestPage: BlitzPage = () => <DashboardLayout title="Picker examples"><SelectionExamples /></DashboardLayout>;
export default CMSelectTestPage;
export const getServerSideProps = makeServerSidePermissionGuard(Permission.sysadmin);
