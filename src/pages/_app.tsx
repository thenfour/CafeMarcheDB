import { AppProps, ErrorBoundary, ErrorFallbackProps } from "@blitzjs/next";
import { CacheProvider, EmotionCache } from "@emotion/react";
import { Box, CssBaseline, Typography } from "@mui/material";
import { LocalizationProvider } from "@mui/x-date-pickers";
//import CssBaseline from "@material-ui/core/CssBaseline";
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import '@xyflow/react/dist/style.css';
import { AuthenticationError, AuthorizationError } from "blitz";
import React from "react";
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { withBlitz } from "src/blitz-client";
import { SnackbarProvider } from "src/core/components/SnackbarContext";
import createEmotionCache from "src/core/createEmotionCache";
import { themeOptions } from "src/core/theme";
import Head from "next/head";
import { BrandContext, useBrand } from "@/shared/brandConfig";
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
import '../../public/style/tuner.css';
import '../../public/style/setlistPlan.css';
import '../../public/style/songSearch.css';
import '../../public/style/tabs.css';
import '../../public/style/workflow.css';
import '../../public/style/calendarPage.css';
import { DbBrandConfig, DefaultDbBrandConfig } from "@/shared/brandConfigBase";

// Client-side cache, shared for the whole session of the user in the browser.
const clientSideEmotionCache = createEmotionCache();

//const theme = createTheme(themeOptions);

export interface MyAppProps extends AppProps {
  emotionCache?: EmotionCache;
}


export function getRootErrorPresentation(error: Error & Record<any, any>) {
  if (error instanceof AuthenticationError) {
    return { statusCode: error.statusCode || 401, title: "You are not authenticated" };
  }
  if (error instanceof AuthorizationError) {
    return {
      statusCode: error.statusCode || 403,
      title: "Sorry, you are not authorized to access this",
    };
  }
  return {
    statusCode: error?.statusCode || 400,
    title: error.message || error.name || "An unexpected error occurred",
  };
}

function RootErrorFallback({ error }: ErrorFallbackProps) {
  const brand = useBrand();
  const { statusCode, title } = getRootErrorPresentation(error);
  const pageTitle = `${brand.siteTitlePrefix}${statusCode}: ${title}`;

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
          <Typography variant="h5" component="h1" sx={{
            paddingRight: 2.5,
            marginRight: 2.5,
            borderRight: "1px solid",
            borderColor: "divider",
          }}>{statusCode}</Typography>
          <Typography variant="body1">{title}</Typography>
        </Box>
      </Box>
    </Box>
  </>;
}

// in order to emit css from the theme, this must be a CHILD of ThemeProvider.
function ThemedApp({ Component, pageProps, emotionCache = clientSideEmotionCache }) {
  const getLayout = Component.getLayout || ((page) => page)
  // Persist brand across client navigations; only update when a new brand is provided
  const [brand, setBrand] = React.useState<DbBrandConfig>(pageProps?.brand ?? DefaultDbBrandConfig)
  React.useEffect(() => {
    if (pageProps?.brand) setBrand(pageProps.brand as DbBrandConfig)
  }, [pageProps?.brand])
  const base = themeOptions as any;
  const theme = createTheme({
    ...base,
    palette: {
      ...base?.palette,
      mode: base?.palette?.mode ?? 'light',
      primary: {
        ...(base?.palette?.primary ?? {}),
        main: brand.theme?.primaryMain ?? base?.palette?.primary?.main ?? '#1976d2',
        contrastText: brand.theme?.contrastText ?? base?.palette?.primary?.contrastText,
      },
      secondary: {
        ...(base?.palette?.secondary ?? {}),
        main: brand.theme?.secondaryMain ?? base?.palette?.secondary?.main ?? '#9c27b0',
        contrastText: brand.theme?.contrastText ?? base?.palette?.secondary?.contrastText,
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
        <SnackbarProvider>
          <BrandContext.Provider value={brand}>
            <ErrorBoundary FallbackComponent={RootErrorFallback}>
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
      <ThemedApp Component={Component} pageProps={pageProps} emotionCache={emotionCache} />
    </CacheProvider>
  );
}

// Ensure SSR per-request loads brand from DB and injects into pageProps
const BlitzedApp = withBlitz(MyApp);
const originalGetInitialProps = (BlitzedApp as any).getInitialProps as
  | ((ctx: any) => Promise<any>)
  | undefined;
(BlitzedApp as any).getInitialProps = async (appCtx) => {
  let appProps: any;
  if (typeof originalGetInitialProps === "function") {
    appProps = await originalGetInitialProps(appCtx);
  } else {
    const NextApp = (await import("next/app")).default as any;
    appProps = await NextApp.getInitialProps(appCtx);
  }

  const req = appCtx.ctx?.req as any;
  if (req) {
    const { getSession } = await import("@blitzjs/auth");
    const { authorizeBackstagePageRequest } = await import("@/src/auth/server/backstagePageRequestAuthorization");
    const session = await getSession(req, appCtx.ctx.res);
    await authorizeBackstagePageRequest(appCtx.ctx.pathname, session.userId);
  }

  if (req) {
    // A request with no valid or last-known-good brand must fail instead of
    // rendering normal application content under the wrong site identity.
    const { loadDbBrandConfig } = await import("@/src/server/brand");
    const host = req?.headers?.host as string | undefined;
    const brand = await loadDbBrandConfig(host);
    appProps.pageProps = { ...(appProps.pageProps || {}), brand };
  }

  return appProps;
};

export default BlitzedApp;
