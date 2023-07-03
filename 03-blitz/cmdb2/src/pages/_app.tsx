import { AppProps, ErrorBoundary, ErrorComponent, ErrorFallbackProps } from "@blitzjs/next";
import { CacheProvider, EmotionCache } from "@emotion/react";
import { Backdrop, CircularProgress, CssBaseline } from "@mui/material";
//import CssBaseline from "@material-ui/core/CssBaseline";
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { AuthenticationError, AuthorizationError } from "blitz";
import Head from "next/head";
import { withBlitz } from "src/blitz-client";
import createEmotionCache from "src/core/createEmotionCache";
import { themeOptions } from "src/core/theme";
import '../../public/global.css';
import React from "react";
import { useTheme } from "@mui/material/styles";
import { SnackbarProvider } from "src/core/components/SnackbarContext";

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
    <SnackbarProvider>
      <Component {...pageProps} />
    </SnackbarProvider>
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
