// this is not very good. it works, but very awkward.

// so i'm trying to unify in-grid editing and editing from a new item dialog.
// but one difficulty is that 

// once i type, it performs full filtering
// clicking out should be safer
// implement add new option
// hitting ENTER or TAB is not intuitive... basically it should be more modal

import CloseIcon from '@mui/icons-material/Close';
import DoneIcon from '@mui/icons-material/Done';
import { Autocomplete, AutocompleteCloseReason, Box, Chip, ClickAwayListener, Popper } from "@mui/material";
import {
    AutocompleteChangeReason,
    AutocompleteRenderOptionState,
    autocompleteClasses
} from '@mui/material/Autocomplete';
import ButtonBase from '@mui/material/ButtonBase';
import InputBase from '@mui/material/InputBase';
import { styled, useTheme } from '@mui/material/styles';
import React from "react";
import { ForeignSingleField } from './dbcomponents2/CMColumnSpec';
import { useMutation, useQuery } from '@blitzjs/rpc';
import { SnackbarContext } from '../components/SnackbarContext';



// https://codesandbox.io/s/735dvv?file=/Demo.tsx:0-601
interface PopperComponentProps {
    anchorEl?: any;
    disablePortal?: boolean;
    open: boolean;
}

const StyledAutocompletePopper = styled('div')(({ theme }) => ({
    [`& .${autocompleteClasses.paper}`]: {
        boxShadow: 'none',
        margin: 0,
        color: 'inherit',
        fontSize: 13,
    },
    [`& .${autocompleteClasses.listbox}`]: {
        backgroundColor: theme.palette.mode === 'light' ? '#fff' : '#1c2128',
        padding: 0,
        [`& .${autocompleteClasses.option}`]: {
            minHeight: 'auto',
            alignItems: 'flex-start',
            padding: 8,
            borderBottom: `1px solid  ${theme.palette.mode === 'light' ? ' #eaecef' : '#30363d'
                }`,
            '&[aria-selected="true"]': {
                backgroundColor: 'transparent',
            },
            [`&.${autocompleteClasses.focused}, &.${autocompleteClasses.focused}[aria-selected="true"]`]:
            {
                backgroundColor: theme.palette.action.hover,
            },
        },
    },
    [`&.${autocompleteClasses.popperDisablePortal}`]: {
        position: 'relative',
    },
}));

function PopperComponent(props: PopperComponentProps) {
    const { disablePortal, anchorEl, open, ...other } = props;
    return <StyledAutocompletePopper {...other} />;
}

const StyledPopper = styled(Popper)(({ theme }) => ({
    border: `2px solid ${theme.palette.mode === 'light' ? '#e1e4e8' : '#30363d'}`,
    boxShadow: `0 12px 24px ${theme.palette.mode === 'light' ? 'rgba(149, 157, 165, 0.4)' : 'rgb(1, 4, 9)'
        }`,
    borderRadius: 6,
    width: 300,
    zIndex: theme.zIndex.modal,
    fontSize: 13,
    color: theme.palette.mode === 'light' ? '#24292e' : '#c9d1d9',
    backgroundColor: theme.palette.mode === 'light' ? '#fff' : '#1c2128',
}));

const StyledInput = styled(InputBase)(({ theme }) => ({
    padding: 10,
    width: '100%',
    borderBottom: `1px solid ${theme.palette.mode === 'light' ? '#eaecef' : '#30363d'
        }`,
    '& input': {
        borderRadius: 4,
        backgroundColor: theme.palette.mode === 'light' ? '#fff' : '#0d1117',
        padding: 8,
        transition: theme.transitions.create(['border-color', 'box-shadow']),
        border: `1px solid ${theme.palette.mode === 'light' ? '#eaecef' : '#30363d'}`,
        fontSize: 14,
        '&:focus': {
            boxShadow: `0px 0px 0px 3px ${theme.palette.mode === 'light'
                ? 'rgba(3, 102, 214, 0.3)'
                : 'rgb(12, 45, 107)'
                }`,
            borderColor: theme.palette.mode === 'light' ? '#0366d6' : '#388bfd',
        },
    },
}));

const Button = styled(ButtonBase)(({ theme }) => ({
    fontSize: 13,
    width: '100%',
    textAlign: 'left',
    paddingBottom: 8,
    color: theme.palette.mode === 'light' ? '#586069' : '#8b949e',
    fontWeight: 600,
    '&:hover,&:focus': {
        color: theme.palette.mode === 'light' ? '#0366d6' : '#58a6ff',
    },
    '& span': {
        width: '100%',
    },
    '& svg': {
        width: 16,
        height: 16,
    },
}));

export interface ForeignAutocompleteProps<DBModel, ForeignModel> {
    field: ForeignSingleField<DBModel, ForeignModel>;

    getOptionLabel: (option: ForeignModel) => string;

    // should render a <li {...props}>
    renderOption: (props: React.HTMLAttributes<HTMLLIElement>, option: ForeignModel, state: AutocompleteRenderOptionState) => React.ReactElement;
    renderAsChip: (value: ForeignModel | null) => React.ReactElement; // todo: onDelete handler, selected state etc.
    value: ForeignModel | null;
    onChange: (
        event: React.SyntheticEvent,
        value: ForeignModel | null,
        reason: AutocompleteChangeReason,
    ) => void;


};

// export const ForeignMultiAutocomplete = <DBModel, ForeignModel,>(props: ForeignAutocompleteProps<DBModel, ForeignModel>) => {
//     const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
//     const [value, setValue] = React.useState<ForeignModel[]>([]);
//     const [pendingValue, setPendingValue] = React.useState<ForeignModel[]>([]);
//     const theme = useTheme();
//     const [options, { refetch }] = useQuery(props.field.args.getAllOptionsQuery, {});

//     const handleClick = (event: React.MouseEvent<HTMLElement>) => {
//         setPendingValue(value);
//         setAnchorEl(event.currentTarget);
//     };

//     const handleClose = () => {
//         setValue(pendingValue);
//         if (anchorEl) {
//             anchorEl.focus();
//         }
//         setAnchorEl(null);
//     };

//     const open = Boolean(anchorEl);
//     const id = open ? 'github-label' : undefined;

//     //console.log(options);

//     return (
//         <React.Fragment>
//             <Button disableRipple onClick={handleClick}>Select...</Button>
//             <StyledPopper id={id} open={open} anchorEl={anchorEl} placement="bottom-start">
//                 <ClickAwayListener onClickAway={handleClose}>
//                     <div>
//                         <Box sx={{
//                             borderBottom: `1px solid ${theme.palette.mode === 'light' ? '#eaecef' : '#30363d'}`,
//                             // padding: '8px 10px',
//                             // fontWeight: 600,
//                         }}>
//                             Apply labels to this pull request
//                         </Box>
//                         <Autocomplete
//                             open
//                             multiple={true}
//                             onClose={(
//                                 event: React.ChangeEvent<{}>,
//                                 reason: AutocompleteCloseReason,
//                             ) => {
//                                 if (reason === 'escape') {
//                                     handleClose();
//                                 }
//                             }}
//                             value={pendingValue}
//                             onChange={(event, newValue, reason) => {
//                                 if (
//                                     event.type === 'keydown' &&
//                                     (event as React.KeyboardEvent).key === 'Backspace' &&
//                                     reason === 'removeOption'
//                                 ) {
//                                     return;
//                                 }
//                                 setPendingValue(newValue);
//                             }}
//                             disableCloseOnSelect
//                             PopperComponent={PopperComponent}
//                             renderTags={() => null} // i don't actually know what this does.

//                             noOptionsText="No labels"
//                             renderOption={props.renderOption}
//                             options={options}
//                             getOptionLabel={props.getOptionLabel}
//                             renderInput={(params) => (
//                                 <StyledInput
//                                     ref={params.InputProps.ref}
//                                     inputProps={params.inputProps}
//                                     autoFocus
//                                     placeholder="Filter labels"
//                                 />
//                             )}
//                         />
//                     </div>
//                 </ClickAwayListener>
//             </StyledPopper>
//         </React.Fragment>
//     );
// }



interface NewOption {
    isNewItem: boolean;
    inputValue: string;
};


export const ForeignSingleAutocomplete = <DBModel, ForeignModel,>(props: ForeignAutocompleteProps<DBModel, ForeignModel>) => {
    const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
    const theme = useTheme();
    const [options, { refetch }]: [[ForeignModel | NewOption | null], any] = useQuery(props.field.args.getAllOptionsQuery, {});
    const [createMutation] = props.field.args.allowInsertFromString ? useMutation(props.field.args.insertFromStringMutation) : [null];
    const { showMessage: showSnackbar } = React.useContext(SnackbarContext);

    //const [value, setValue] = React.useState<ForeignModel | null>(null);
    //const [pendingValue, setPendingValue] = React.useState<ForeignModel | null>(null);

    const handleClick = (event: React.MouseEvent<HTMLElement>) => {
        //setPendingValue(value);
        setAnchorEl(event.currentTarget);
    };

    const handleClose = () => {
        //setValue(pendingValue);
        if (anchorEl) {
            anchorEl.focus();
        }
        setAnchorEl(null);
    };

    const open = Boolean(anchorEl);
    const id = open ? 'github-label' : undefined;

    return (
        <React.Fragment>

            <Box onClick={handleClick}>
                {props.renderAsChip(props.value)}
            </Box>
            <StyledPopper id={id} open={open} anchorEl={anchorEl} placement="bottom-start">
                <ClickAwayListener onClickAway={handleClose}>
                    <div>
                        <Box sx={{
                            borderBottom: `1px solid ${theme.palette.mode === 'light' ? '#eaecef' : '#30363d'}`,
                            // padding: '8px 10px',
                            // fontWeight: 600,
                        }}>
                            Apply labels to this pull request
                            <Button onClick={handleClose}>
                                <CloseIcon />
                            </Button>
                        </Box>
                        <Autocomplete
                            open
                            onClose={(
                                event: React.ChangeEvent<{}>,
                                reason: AutocompleteCloseReason,
                            ) => {
                                if (reason === 'escape') { // idk
                                    handleClose();
                                }
                            }}
                            // multiple
                            //disableCloseOnSelect
                            value={props.value}
                            onChange={(event, newValue, reason) => {
                                // if (
                                //     event.type === 'keydown' && // i don't really understand this logic
                                //     (event as React.KeyboardEvent).key === 'Backspace' &&
                                //     reason === 'removeOption'
                                // ) {
                                //     return;
                                // }
                                //console.log(`onChange, newvalue=${newValue}`);
                                props.onChange(event, newValue, reason);
                                //setPendingValue(newValue);
                            }}
                            PopperComponent={PopperComponent}
                            renderTags={() => null} // i don't actually know what this does.

                            autoSelect={true}
                            blurOnSelect={true}

                            filterOptions={(options, state) => {
                                console.log(`state.inputValue ${state.inputValue}`);
                                //console.log(state);
                                let found = false;
                                options.sort((a, b) => {
                                    const anull = a === null || a === undefined;
                                    const bnull = b === null || b === undefined;
                                    if (anull && bnull) return 0; // both null
                                    if (anull) return -1;
                                    if (bnull) return 1;
                                    const aid = a[props.field.args.foreignPk];
                                    const bid = b[props.field.args.foreignPk];
                                    if (aid === bid) return 0; // identical objects

                                    // it's tempting to put selected items first, but it's a jolting UX

                                    const alabel = state.getOptionLabel(a);
                                    const blabel = state.getOptionLabel(b);

                                    // well this is slightly fuzzy; some values should probably be considered equal in different ways.
                                    // probably could use a isExactMatchWithString() pred.
                                    if (alabel === state.inputValue || blabel === state.inputValue) {
                                        found = true;
                                    }

                                    // // now sort by filter match
                                    // if ((alabel).indexOf(state.inputValue) >= 0) {
                                    //     found = true;
                                    //     //return -1;
                                    // }
                                    // if ((blabel).indexOf(state.inputValue) >= 0) {
                                    //     found = true;
                                    //     //return 1;
                                    // }

                                    // natural sort order
                                    return (alabel as string).localeCompare(blabel);
                                    //return (a.sortOrder - b.sortOrder) || 0;
                                });

                                options = options.filter(o => {
                                    if (o === null || o === undefined) return true; // don't remove null option if it's there (but uh it shouldn't be)
                                    //if (typeof o === 'NewOption') return true;
                                    const label = state.getOptionLabel(o);
                                    if ((label).indexOf(state.inputValue) >= 0) {
                                        return true;
                                    }
                                    return false;
                                });

                                //options.sort((a, b) => { return (a.name as string).localeCompare(b.name) });
                                //console.log(state.inputValue);
                                //console.log(options.map(o => o.name));

                                // if the input value is not an option, then give an option to create the value.
                                if (!found && props.field.args.allowInsertFromString) {
                                    const no: NewOption = { isNewItem: true, inputValue: state.inputValue };
                                    options = [no, ...options];
                                    console.log(`added new item option for ${state.inputValue}`);
                                }
                                return options;
                            }}

                            isOptionEqualToValue={(option, value) => {
                                if (value.isNewItem) {
                                    return false;
                                }
                                const ret = props.field.isEqual(option, value, option[props.field.args.foreignPk], value[props.field.args.foreignPk]);
                                //console.log(`option[${option.id}]/value[${value.id}] isequal: ${ret}`);
                                return ret;
                                // console.log(`OPTION / VALUE: {`);
                                // console.log(option);
                                // console.log(value);
                                // console.log(`}`);
                                //return false;
                            }}

                            freeSolo={true}
                            noOptionsText={`No options for ${props.field.args.label}`}
                            //renderOption={props.renderOption}
                            renderOption={(props__, option, state) => {
                                //console.log(`${typeof option} = ${option.isNewItem}`);
                                if (option.isNewItem) {
                                    return <li>.....new.... option....</li>;
                                }
                                return props.renderOption(props__, option, state);
                            }}
                            options={options}

                            getOptionLabel={(option) => { // it's not completely clear to me what this is used for, considering we render items ourselves.
                                // Value selected with enter, right from the input. docs state that for freesolo this case must be handled.
                                if (typeof option === 'string') {
                                    return option;
                                }
                                if (option.inputValue) {
                                    return option.inputValue;
                                }
                                // Regular option
                                return props.getOptionLabel(option as ForeignModel);
                            }}

                            renderInput={(params) => (
                                <StyledInput
                                    ref={params.InputProps.ref}
                                    inputProps={params.inputProps}
                                    autoFocus
                                    placeholder={`Filter ${props.field.args.label}`}
                                />
                            )}
                        />
                    </div>
                </ClickAwayListener>
            </StyledPopper>
        </React.Fragment>
    );
}



// renderOption from example is like this, using flexgrow and opacity / sizing



                            //  (props, option, { selected }) => (
                            //     <li {...props}>
                            //         <Box
                            //             component={DoneIcon}
                            //             sx={{ width: 17, height: 17, mr: '5px', ml: '-2px' }}
                            //             style={{
                            //                 visibility: selected ? 'visible' : 'hidden',
                            //             }}
                            //         />
                            //         <Box
                            //             component="span"
                            //             sx={{
                            //                 width: 14,
                            //                 height: 14,
                            //                 flexShrink: 0,
                            //                 borderRadius: '3px',
                            //                 mr: 1,
                            //                 mt: '2px',
                            //             }}
                            //             style={{ backgroundColor: "red" }}
                            //         />
                            //         <Box
                            //             sx={{
                            //                 flexGrow: 1,
                            //                 '& span': {
                            //                     color:
                            //                         theme.palette.mode === 'light' ? '#586069' : '#8b949e',
                            //                 },
                            //             }}
                            //         >
                            //             {option.name}
                            //             <br />
                            //             <span>a description here</span>
                            //         </Box>
                            //         <Box
                            //             component={CloseIcon}
                            //             sx={{ opacity: 0.6, width: 18, height: 18 }}
                            //             style={{
                            //                 visibility: selected ? 'visible' : 'hidden',
                            //             }}
                            //         />
                            //     </li>
                            // )}