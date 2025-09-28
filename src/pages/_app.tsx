import { AppProps, ErrorBoundary, ErrorComponent, ErrorFallbackProps } from "@blitzjs/next";
import { CacheProvider, EmotionCache } from "@emotion/react";
import { CssBaseline } from "@mui/material";
import { LocalizationProvider } from "@mui/x-date-pickers";
//import CssBaseline from "@material-ui/core/CssBaseline";
import { ThemeProvider, createTheme, useTheme } from '@mui/material/styles';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import '@xyflow/react/dist/style.css';
import { AuthenticationError, AuthorizationError } from "blitz";
import React from "react";
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { withBlitz } from "src/blitz-client";
import { SnackbarProvider } from "src/core/components/SnackbarContext";
import createEmotionCache from "src/core/createEmotionCache";
import { themeOptions } from "src/core/theme";
import '../../public/eventSongList.css';
import '../../public/frontpage.css';
import '../../public/global.css';
import '../../public/global2.css';
import '../../public/markdown.css';
import '../../public/style/bigCalendar.css';
import "../../public/style/color.css";
import '../../public/style/customFieldEditor.css';
import '../../public/style/dashboard.css';
import '../../public/style/events2.css';
import '../../public/style/filterControls.css';
import '../../public/style/ImportEvents.css';
import '../../public/style/mediaPlayer.css';
import '../../public/style/metronome.css';
import '../../public/style/setlistPlan.css';
import '../../public/style/songSearch.css';
import '../../public/style/tabs.css';
import '../../public/style/workflow.css';

// Client-side cache, shared for the whole session of the user in the browser.
const clientSideEmotionCache = createEmotionCache();

//const theme = createTheme(themeOptions);

export interface MyAppProps extends AppProps {
  emotionCache?: EmotionCache;
}


function RootErrorFallback({ error }: ErrorFallbackProps) {
  if (error instanceof AuthenticationError) {
    return <div>Error: You are not authenticated</div>
  } else if (error instanceof AuthorizationError) {
    console.log(`${error.message || error.name}`);
    return (
      <ErrorComponent
        statusCode={error.statusCode}
        title="Sorry, you are not authorized to access this"
      />
    )
  } else {
    return (
      <ErrorComponent
        statusCode={(error as any)?.statusCode || 400}
        title={error.message || error.name}
      />
    )
  }
}

// in order to emit css from the theme, this must be a CHILD of ThemeProvider.
function ThemedApp({ Component, pageProps, emotionCache = clientSideEmotionCache }) {
  const getLayout = Component.getLayout || ((page) => page)
  const theme = useTheme();

  React.useEffect(() => {
    document.documentElement.style.setProperty('--primary-color', theme.palette.primary.main);
    document.documentElement.style.setProperty('--secondary-color', theme.palette.secondary.main);
  }, []);

  return getLayout(
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <SnackbarProvider>
        {/* <DashboardContextProvider> */}
        <Component {...pageProps} />
        {/* </DashboardContextProvider> */}
      </SnackbarProvider>
    </LocalizationProvider>
  );
}

const theme = createTheme(themeOptions);

function MyApp({
  Component,
  pageProps,
  emotionCache = clientSideEmotionCache
}: MyAppProps) {
  return (
    <CacheProvider value={emotionCache}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <ErrorBoundary FallbackComponent={RootErrorFallback}>
          <ThemedApp Component={Component} pageProps={pageProps} emotionCache={emotionCache} />
        </ErrorBoundary>
      </ThemeProvider>
    </CacheProvider>
  );
}

export default withBlitz(MyApp)
