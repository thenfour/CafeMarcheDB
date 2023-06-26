import { AppProps, ErrorBoundary, ErrorComponent, ErrorFallbackProps } from "@blitzjs/next";
import { CacheProvider, EmotionCache } from "@emotion/react";
import CssBaseline from "@material-ui/core/CssBaseline";
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { AuthenticationError, AuthorizationError } from "blitz";
import Head from "next/head";
import { withBlitz } from "src/blitz-client";
import createEmotionCache from "src/core/createEmotionCache";
import { themeOptions } from "src/core/theme";

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

function MyApp({
  Component,
  pageProps,
  emotionCache = clientSideEmotionCache,
}: MyAppProps) {

  const getLayout = Component.getLayout || ((page) => page);

  const theme = createTheme(themeOptions);
  return (

    <CacheProvider value={emotionCache}>
      <ThemeProvider theme={theme}>
        {/* CssBaseline kickstart an elegant, consistent, and simple baseline to build upon. */}
        <CssBaseline />
        <ErrorBoundary FallbackComponent={RootErrorFallback}>
          {getLayout(<Component {...pageProps} />)}
        </ErrorBoundary>
      </ThemeProvider>
    </CacheProvider>



  );


  // return (
  //   <React.StrictMode>
  //     <ErrorBoundary FallbackComponent={RootErrorFallback}>
  //       <ThemeProvider theme={theme}>
  //         {getLayout(<Component {...pageProps} />)}
  //       </ThemeProvider>
  //     </ErrorBoundary>
  //   </React.StrictMode>
  // );
}

export default withBlitz(MyApp);
