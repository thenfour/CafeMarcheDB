import { ThemeOptions } from '@mui/material/styles';

export const themeOptions: ThemeOptions = {
  palette: {
    mode: 'dark',
    primary: {
      main: '#ede331',
      contrastText: '#344873',
    },
    secondary: {
      main: '#831012',
      contrastText: '#ede331',
    },
    background: {
      default: '#a26a6a',
      paper: '#b1b050',
    },
    text: {
      primary: 'rgba(51,10,222,0.87)',
      secondary: 'rgba(185,38,212,0.6)',
      disabled: 'rgba(226,19,19,0.38)',
      hint: '#320bf1',
    },
  },
  typography: {
    fontFamily: 'Droid Serif',
  },
  props: {
    MuiButtonBase: {
      disableRipple: true,
    },
  },
};
