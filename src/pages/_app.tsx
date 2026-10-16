import { AppProps, BlitzPage, ErrorBoundary, ErrorFallbackProps } from "@blitzjs/next";
import { CacheProvider, EmotionCache } from "@emotion/react";
import PowerOffIcon from "@mui/icons-material/PowerOff";
import { Box, CssBaseline, Typography } from "@mui/material";
import { LocalizationProvider } from "@mui/x-date-pickers";
//import CssBaseline from "@material-ui/core/CssBaseline";
import { BrandContext, useBrand } from "@/shared/brandConfig";
import { createTheme, PaletteColorOptions, SimplePaletteColorOptions, ThemeProvider } from '@mui/material/styles';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { AuthenticationError, AuthorizationError, NotFoundError } from "blitz";
import NextApp, { AppContext, AppInitialProps } from "next/app";
import Head from "next/head";
import React from "react";
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { queryClient, withBlitz } from "src/blitz-client";
import { CMButton } from "src/core/components/CMCoreComponents2";
import { SnackbarProvider } from "src/core/components/SnackbarContext";
import createEmotionCache from "src/core/createEmotionCache";
import { themeOptions } from "src/core/theme";
import { ZodError } from "zod";

import { DbBrandConfig, DefaultDbBrandConfig } from "@/shared/brandConfigBase";
import { PortalRoutingProvider } from "@/src/route/useCmdbRouter";
import { invoke, useQueryErrorResetBoundary } from "@blitzjs/rpc";
import Router from "next/router";
import getPageBootstrap, { PageBootstrapInput } from "src/auth/queries/getPageBootstrap";
import { ServerStartupStateContext } from "src/core/components/ServerStartupStateContext";
import { ConnectionHealthMonitor } from "src/core/connectivity/ConnectionHealthComponents";
import { isConnectivityError } from "src/core/connectivity/connectionHealth";
import { PresentationProvider } from "src/locale/components/PresentationProvider";
import { parseAcceptLanguage } from "src/locale/shared/localePreferences";
import { deserializePortalPath, replacePortalPathname, type PortalPath } from "src/route/portalRouting";
import 'src/styles/main.css';
import '../../public/frontpage.css';
import { DashboardContextProvider } from "../core/components/dashboardContext/DashboardContext";

// Client-side cache, shared for the whole session of the user in the browser.
const clientSideEmotionCache = createEmotionCache();

//const theme = createTheme(themeOptions);

type BootstrapData = Awaited<ReturnType<typeof getPageBootstrap>>;
type RootErrorPresentation = ReturnType<typeof getRootErrorPresentation>;

type AppBootstrap =
  | { readonly status: "ready"; readonly data: BootstrapData }
  | ({ readonly status: "error" } & RootErrorPresentation);

interface SharedPageProps {
  readonly appBootstrap: AppBootstrap;
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
  return <RootErrorView presentation={getRootErrorPresentation(error)} resetErrorBoundary={resetErrorBoundary} />;
}

function RootErrorView({ presentation, resetErrorBoundary }: {
  readonly presentation: RootErrorPresentation;
  readonly resetErrorBoundary: () => void;
}) {
  const brand = useBrand();
  const { statusCode, title, isConnectivityFailure } = presentation;
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
          <CMButton onClick={resetErrorBoundary}>Try again</CMButton>
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
  const state = pageProps.appBootstrap;
  const bootstrap = state.status === "ready" ? state.data : null;
  const queryErrorResetBoundary = useQueryErrorResetBoundary();
  const getLayout = Component.getLayout || ((page: React.ReactElement) => page)
  // Persist brand across client navigations; only update when a new brand is provided
  const [brand, setBrand] = React.useState<DbBrandConfig>(bootstrap?.brand ?? DefaultDbBrandConfig)
  React.useEffect(() => {
    if (bootstrap) setBrand(bootstrap.brand)
  }, [bootstrap?.brand])
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
            {state.status === "ready" ? <PortalRoutingProvider config={state.data.routing}>
              <ServerStartupStateContext.Provider value={state.data.serverStartupState}>
                <ErrorBoundary FallbackComponent={RootErrorFallback} onReset={queryErrorResetBoundary.reset}>
                  {/* lsmb todo: less intrusive suspense fallback. also is this necessary? the presentationProvider also has a suspense and this might not be needed. */}
                  <React.Suspense fallback={<span role="status">Loading…</span>}>
                    <PresentationProvider
                      initial={state.data.presentation}
                      bandPublicId={state.data.routing.requestPath.bandPublicId}
                      routeLocale={state.data.routing.requestPath.routeLocale}
                    >
                      <DashboardContextProvider>
                        {getLayout(<Component {...pageProps} />)}
                      </DashboardContextProvider>
                    </PresentationProvider>
                  </React.Suspense>
                </ErrorBoundary>
              </ServerStartupStateContext.Provider>
            </PortalRoutingProvider> : <RootErrorView
              presentation={state}
              resetErrorBoundary={() => { window.location.reload(); }}
            />}
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

// Next error rendering has no page bootstrap or guaranteed rewrite metadata.
function getFrameworkErrorPresentation({ err, pathname }: Pick<AppContext["ctx"], "err" | "pathname">): RootErrorPresentation | null {
  if (!err && pathname !== "/_error" && pathname !== "/404") {
    return null;
  }
  if (!err) {
    return {
      statusCode: pathname === "/404" ? 404 : 500,
      title: pathname === "/404" ? "This page could not be found" : "An unexpected error occurred",
      isConnectivityFailure: false,
    };
  }
  const presentation = getRootErrorPresentation(err);
  return { ...presentation, statusCode: presentation.isConnectivityFailure ? null : err.statusCode ?? 500 };
}

// withBlitz preserves this hook
// https://nextjs.org/docs/pages/api-reference/functions/get-initial-props
// client-side nav is possible through Router.push / replace.
// the main point of this hook is to call getPageBootstrap, making that data available to all pages.
MyApp.getInitialProps = async (appCtx: AppContext): Promise<AppInitialProps<SharedPageProps>> => {
  const { req, res, pathname } = appCtx.ctx;
  const frameworkError = getFrameworkErrorPresentation(appCtx.ctx);
  if (frameworkError) {
    if (res) {
      res.statusCode = frameworkError.statusCode ?? 503;
      res.setHeader("Cache-Control", "no-store");
    }
    return { pageProps: { appBootstrap: { status: "error", ...frameworkError } } };
  }
  let requestPath: PortalPath | undefined;
  let bootstrap: BootstrapData;
  try {
    requestPath = deserializePortalPath(appCtx.ctx.query);
    const input: PageBootstrapInput = {
      pagePattern: pathname,
      requestPath,
      browserLanguages: req ? parseAcceptLanguage(req.headers["accept-language"]) : [...navigator.languages],
    };
    bootstrap = req ? await getPageBootstrap(input, appCtx.ctx) : await invoke(getPageBootstrap, input);
  } catch (error) {
    const statusCode = error instanceof AuthenticationError ? 401
      : error instanceof AuthorizationError ? 403
        : error instanceof NotFoundError || error instanceof ZodError || error instanceof RangeError ? 404 : null;
    if (statusCode === null) {
      throw error;
    }
    if (res) {
      res.statusCode = statusCode;
      res.setHeader("Cache-Control", "no-store");
    }
    // Each dashboard root owns its sign-in UI; it must not redirect to itself.
    const loginPattern = requestPath?.hasBandPrefix ? "/backstage" : "/platform";
    if (error instanceof AuthenticationError && pathname !== loginPattern && requestPath) {
      const loginPath = replacePortalPathname(requestPath, loginPattern);
      if (res) {
        res.writeHead(302, { Location: loginPath });
        res.end();
      } else {
        await Router.replace(loginPath);
      }
    }
    return {
      pageProps: {
        appBootstrap: {
          status: "error", statusCode, isConnectivityFailure: false,
          title: statusCode === 404 ? "This page could not be found" : getRootErrorPresentation(error).title,
        }
      }
    };
  }
  const appProps = await NextApp.getInitialProps(appCtx);
  return { ...appProps, pageProps: { ...appProps.pageProps, appBootstrap: { status: "ready", data: bootstrap } } };
};

export default withBlitz(MyApp);
