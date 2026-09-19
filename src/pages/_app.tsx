import { AppProps, BlitzPage, ErrorBoundary, ErrorFallbackProps } from "@blitzjs/next";
import { CacheProvider, EmotionCache } from "@emotion/react";
import PowerOffIcon from "@mui/icons-material/PowerOff";
import { Box, Button, CssBaseline, Typography } from "@mui/material";
import { LocalizationProvider } from "@mui/x-date-pickers";
//import CssBaseline from "@material-ui/core/CssBaseline";
import { ThemeProvider, createTheme, PaletteColorOptions, SimplePaletteColorOptions } from '@mui/material/styles';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { AuthenticationError, AuthorizationError } from "blitz";
import React from "react";
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { queryClient, withBlitz } from "src/blitz-client";
import { SnackbarProvider } from "src/core/components/SnackbarContext";
import createEmotionCache from "src/core/createEmotionCache";
import { themeOptions } from "src/core/theme";
import Head from "next/head";
import NextApp, { AppContext, AppInitialProps } from "next/app";
import { BrandContext, useBrand } from "@/shared/brandConfig";

import 'src/styles/main.css';
import '../../public/frontpage.css';
import { DbBrandConfig, DefaultDbBrandConfig } from "@/shared/brandConfigBase";
import { ConnectionHealthMonitor } from "src/core/connectivity/ConnectionHealthComponents";
import { isConnectivityError } from "src/core/connectivity/connectionHealth";
import { useQueryErrorResetBoundary } from "@blitzjs/rpc";

// Client-side cache, shared for the whole session of the user in the browser.
const clientSideEmotionCache = createEmotionCache();

//const theme = createTheme(themeOptions);

interface SharedPageProps {
  brand?: DbBrandConfig;
}

export interface MyAppProps extends Omit<AppProps<SharedPageProps>, "Component"> {
  Component: BlitzPage<SharedPageProps>;
  emotionCache?: EmotionCache;
}


export function getRootErrorPresentation(error: Error & { statusCode?: number }) {
  if (isConnectivityError(error)) {
    return { statusCode: null, title: "The server cannot be reached", isConnectivityFailure: true };
  }
  if (error instanceof AuthenticationError) {
    return { statusCode: error.statusCode || 401, title: "You are not authenticated", isConnectivityFailure: false };
  }
  if (error instanceof AuthorizationError) {
    return {
      statusCode: error.statusCode || 403,
      title: "Sorry, you are not authorized to access this",
      isConnectivityFailure: false,
    };
  }
  return {
    statusCode: error?.statusCode || 400,
    title: error.message || error.name || "An unexpected error occurred",
    isConnectivityFailure: false,
  };
}

function RootErrorFallback({ error, resetErrorBoundary }: ErrorFallbackProps) {
  const brand = useBrand();
  const { statusCode, title, isConnectivityFailure } = getRootErrorPresentation(error);
  const pageTitle = `${brand.siteTitlePrefix}${statusCode ? `${statusCode}: ` : ""}${title}`;

  React.useEffect(() => {
    if (!isConnectivityFailure) return;
    window.addEventListener("online", resetErrorBoundary);
    return () => window.removeEventListener("online", resetErrorBoundary);
  }, [isConnectivityFailure, resetErrorBoundary]);

  return <>
    <Head><title>{pageTitle}</title></Head>
    <Box sx={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 3,
      color: "text.primary",
      backgroundColor: "background.default",
    }}>
      <Box sx={{ maxWidth: 720, textAlign: "center" }}>
        {(brand.siteLogoUrl || brand.siteTitle) && <Box sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 1.5,
          marginBottom: 3,
        }}>
          {brand.siteLogoUrl && <img
            src={brand.siteLogoUrl}
            alt=""
            style={{ display: "block", maxHeight: 48, maxWidth: 200 }}
          />}
          {brand.siteTitle && <Typography variant="h5">{brand.siteTitle}</Typography>}
        </Box>}
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          {isConnectivityFailure && <PowerOffIcon sx={{ fontSize: 32, marginRight: 2 }} />}
          {statusCode && <Typography variant="h5" component="h1" sx={{
            paddingRight: 2.5,
            marginRight: 2.5,
            borderRight: "1px solid",
            borderColor: "divider",
          }}>{statusCode}</Typography>}
          <Typography variant={statusCode ? "body1" : "h5"} component={statusCode ? "p" : "h1"}>{title}</Typography>
        </Box>
        {isConnectivityFailure && <>
          <Typography variant="body1" sx={{ marginTop: 2 }}>
            This page will try again when the connection returns. Previously loaded pages remain available while their tabs stay open.
          </Typography>
          <Button variant="contained" onClick={resetErrorBoundary} sx={{ marginTop: 3 }}>Try again</Button>
        </>}
      </Box>
    </Box>
  </>;
}

function getMainPaletteColor(color: PaletteColorOptions | undefined): SimplePaletteColorOptions | undefined {
  return color && "main" in color ? color : undefined;
}

// in order to emit css from the theme, this must be a CHILD of ThemeProvider.
function ThemedApp({ Component, pageProps }: Pick<MyAppProps, "Component" | "pageProps">) {
  const queryErrorResetBoundary = useQueryErrorResetBoundary();
  const getLayout = Component.getLayout || ((page: React.ReactElement) => page)
  // Persist brand across client navigations; only update when a new brand is provided
  const [brand, setBrand] = React.useState<DbBrandConfig>(pageProps?.brand ?? DefaultDbBrandConfig)
  React.useEffect(() => {
    if (pageProps?.brand) setBrand(pageProps.brand)
  }, [pageProps?.brand])
  const base = themeOptions;
  const basePrimary = getMainPaletteColor(base.palette?.primary);
  const baseSecondary = getMainPaletteColor(base.palette?.secondary);
  const theme = createTheme({
    ...base,
    palette: {
      ...base?.palette,
      mode: base?.palette?.mode ?? 'light',
      primary: {
        ...(base?.palette?.primary ?? {}),
        main: brand.theme?.primaryMain ?? basePrimary?.main ?? '#1976d2',
        contrastText: brand.theme?.contrastText ?? basePrimary?.contrastText,
      },
      secondary: {
        ...(base?.palette?.secondary ?? {}),
        main: brand.theme?.secondaryMain ?? baseSecondary?.main ?? '#9c27b0',
        contrastText: brand.theme?.contrastText ?? baseSecondary?.contrastText,
      },
      background: {
        ...(base?.palette?.background ?? {}),
        default: brand.theme?.backgroundDefault ?? base?.palette?.background?.default ?? '#fafafa',
        paper: brand.theme?.backgroundPaper ?? base?.palette?.background?.paper ?? '#ffffff',
      },
      ...(brand.theme?.textPrimary ? { text: { ...(base?.palette?.text ?? {}), primary: brand.theme.textPrimary } } : {}),
    },
  });

  React.useEffect(() => {
    document.documentElement.style.setProperty('--primary-color', theme.palette.primary.main);
    document.documentElement.style.setProperty('--secondary-color', theme.palette.secondary.main);
    document.documentElement.style.setProperty('--bg-default', theme.palette.background.default);
    document.documentElement.style.setProperty('--bg-paper', theme.palette.background.paper);
    document.documentElement.style.setProperty('--text-primary', theme.palette.text.primary);
    document.documentElement.style.setProperty('--contrast-text', theme.palette.primary.contrastText);
  }, [theme.palette.primary.main, theme.palette.primary.contrastText, theme.palette.secondary.main, theme.palette.secondary.contrastText, theme.palette.background.default, theme.palette.background.paper, theme.palette.text.primary]);

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Head>
          <meta name="theme-color" content={theme.palette.primary.main} />
          {brand.siteFaviconUrl && <link key="site-favicon" rel="icon" href={brand.siteFaviconUrl} />}
          <style id="brand-css-vars">{`
            :root{
            --primary-color: ${theme.palette.primary.main};
            --secondary-color: ${theme.palette.secondary.main};
            --bg-default: ${theme.palette.background.default};
            --bg-paper: ${theme.palette.background.paper};
            --text-primary: ${theme.palette.text.primary};
            --contrast-text: ${theme.palette.primary.contrastText};
          }`}</style>
        </Head>
        <ConnectionHealthMonitor queryClient={queryClient} />
        <SnackbarProvider>
          <BrandContext.Provider value={brand}>
            <ErrorBoundary FallbackComponent={RootErrorFallback} onReset={queryErrorResetBoundary.reset}>
              {getLayout(<Component {...pageProps} />)}
            </ErrorBoundary>
          </BrandContext.Provider>
        </SnackbarProvider>
      </ThemeProvider>
    </LocalizationProvider>
  );
}

export function MyApp({
  Component,
  pageProps,
  emotionCache = clientSideEmotionCache
}: MyAppProps) {
  return (
    <CacheProvider value={emotionCache}>
      <ThemedApp Component={Component} pageProps={pageProps} />
    </CacheProvider>
  );
}

// withBlitz preserves this hook; define it here so its Next types stay visible.
MyApp.getInitialProps = async (appCtx: AppContext): Promise<AppInitialProps<SharedPageProps>> => {
  const { req, res, pathname } = appCtx.ctx;
  if (req) {
    if (!res) throw new Error("Server page request is missing its response.");

    // getInitialProps also runs in the browser during navigation. Initialize
    // server authentication only for server requests, before reading a session.
    const { getSessionForRequest } = await import("src/blitz-server");
    const { authorizePageRequest } = await import("@/src/auth/server/pageRequestAuthorization");
    const session = await getSessionForRequest(req, res);
    try {
      await authorizePageRequest(pathname, session);
    } catch (error) {
      // Redirect unauthenticated users to the backstage login page.
      if (!(error instanceof AuthenticationError)) throw error;
      // also if you're already exactly at /backstage, don't redirect in an infinite loop
      if (pathname === "/backstage") {
        return { pageProps: {} };
      }
      res.writeHead(302, { Location: "/backstage" });
      res.end();
      return { pageProps: {} };
    }
  }

  // Authorize before invoking page loaders, including on requests we redirect.
  const appProps: AppInitialProps<SharedPageProps> = await NextApp.getInitialProps(appCtx);
  if (req) {

    // A request with no valid or last-known-good brand must fail instead of
    // rendering normal application content under the wrong site identity.
    const { loadDbBrandConfig } = await import("@/src/server/brand");
    const brand = await loadDbBrandConfig(req.headers.host);
    appProps.pageProps = { ...(appProps.pageProps || {}), brand };
  }

  return appProps;
};

export default withBlitz(MyApp);
