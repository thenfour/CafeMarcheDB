import { ThemeOptions } from '@mui/material/styles';

export const themeOptions: ThemeOptions = {
  palette: {
    mode: 'light',
    primary: {
      main: '#344873',
      contrastText: '#ede331',
    },
    secondary: {
      main: '#831012',
      contrastText: '#ede331',
    },
  },
  transitions: {
    duration: {
      shortest: 0,
      shorter: 0,
      short: 0,
      standard: 0,// most basic recommended timing (default 300)
      complex: 0,// this is to be used in complex animations (default 375)
      enteringScreen: 0,// recommended when something is entering screen (default 225)
      leavingScreen: 0,// recommended when something is leaving screen (default 195)
    },
  },
  components: {
    MuiButtonBase: {
      defaultProps: {
        disableRipple: true,
      },
    },
  },
};