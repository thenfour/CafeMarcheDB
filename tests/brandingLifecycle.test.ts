// @vitest-environment jsdom

import React from "react"
import { act } from "react-dom/test-utils"
import { createRoot, Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@blitzjs/next", async () => {
  const ReactModule = await vi.importActual<typeof import("react")>("react")
  const boundaries = new Set<any>()

  class TestErrorBoundary extends ReactModule.Component<any, { error: Error | null }> {
    state = { error: null }

    static getDerivedStateFromError(error: Error) {
      return { error }
    }

    componentDidMount() {
      boundaries.add(this)
    }

    componentWillUnmount() {
      boundaries.delete(this)
    }

    reset() {
      this.setState({ error: null })
    }

    render() {
      if (this.state.error) {
        const FallbackComponent = this.props.FallbackComponent
        return ReactModule.createElement(FallbackComponent, {
          error: this.state.error,
          resetErrorBoundary: () => this.reset(),
        })
      }
      return this.props.children
    }
  }

  return {
    ErrorBoundary: TestErrorBoundary,
    __resetTestErrorBoundaries: () => boundaries.forEach(boundary => boundary.reset()),
  }
})

vi.mock("@emotion/react", async () => {
  const ReactModule = await vi.importActual<typeof import("react")>("react")
  return {
    CacheProvider: ({ children }: React.PropsWithChildren) => ReactModule.createElement(ReactModule.Fragment, null, children),
  }
})

vi.mock("@mui/material", async () => {
  const ReactModule = await vi.importActual<typeof import("react")>("react")
  const Provider = ({ children }: React.PropsWithChildren) => ReactModule.createElement(ReactModule.Fragment, null, children)
  return {
    Box: Provider,
    CssBaseline: () => null,
    Typography: Provider,
  }
})

vi.mock("@mui/material/styles", async () => {
  const ReactModule = await vi.importActual<typeof import("react")>("react")
  return {
    ThemeProvider: ({ children }: React.PropsWithChildren) => ReactModule.createElement(ReactModule.Fragment, null, children),
    createTheme: (options: any) => ({
      ...options,
      palette: {
        ...options.palette,
        text: options.palette.text || { primary: "#111111" },
      },
    }),
  }
})

vi.mock("@mui/x-date-pickers", async () => {
  const ReactModule = await vi.importActual<typeof import("react")>("react")
  return {
    LocalizationProvider: ({ children }: React.PropsWithChildren) => ReactModule.createElement(ReactModule.Fragment, null, children),
  }
})

vi.mock("@mui/x-date-pickers/AdapterDayjs", () => ({ AdapterDayjs: class AdapterDayjs {} }))
vi.mock("next/head", async () => {
  const ReactModule = await vi.importActual<typeof import("react")>("react")
  return {
    default: ({ children }: React.PropsWithChildren) => ReactModule.createElement(ReactModule.Fragment, null, children),
  }
})
vi.mock("src/blitz-client", () => ({
  withBlitz: (component: any) => component,
  queryClient: {
    getQueryCache: () => ({ subscribe: () => () => undefined }),
    getMutationCache: () => ({ subscribe: () => () => undefined }),
  },
}))
vi.mock("src/core/components/SnackbarContext", async () => {
  const ReactModule = await vi.importActual<typeof import("react")>("react")
  return {
    SnackbarProvider: ({ children }: React.PropsWithChildren) => ReactModule.createElement(ReactModule.Fragment, null, children),
  }
})
vi.mock("src/core/createEmotionCache", () => ({ default: () => ({}) }))

let root: Root | undefined
const originalActEnvironment = Object.getOwnPropertyDescriptor(globalThis, "IS_REACT_ACT_ENVIRONMENT")

beforeEach(() => {
  document.body.innerHTML = '<div id="root"></div>'
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true)
})

afterEach(async () => {
  if (root) await act(async () => root?.unmount())
  root = undefined
  document.body.replaceChildren()
  if (originalActEnvironment) Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", originalActEnvironment)
  else Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT")
})

describe("application branding lifecycle", () => {
  it("does not present a transport failure as HTTP 400", async () => {
    const { getRootErrorPresentation } = await import("src/pages/_app")
    expect(getRootErrorPresentation(new TypeError("NetworkError when attempting to fetch resource."))).toEqual({
      statusCode: null,
      title: "The server cannot be reached",
      isConnectivityFailure: true,
    })
  })

  it("keeps the loaded brand when a page error is followed by client navigation", async () => {
    const { MyApp } = await import("src/pages/_app")
    const { useBrand } = await import("shared/brandConfig")
    const blitz = await import("@blitzjs/next") as any
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined)
    const container = document.getElementById("root")!
    const mountedRoot = createRoot(container)
    root = mountedRoot
    const brand = {
      hostingMode: "GenericSingleTenant",
      siteTitle: "Persistent Band",
      siteTitlePrefix: "PB: ",
      siteFaviconUrl: "/persistent.png",
      siteLogoUrl: "/persistent-logo.png",
      theme: {
        primaryMain: "#123456",
        secondaryMain: "#654321",
        backgroundDefault: "#fafafa",
        backgroundPaper: "#ffffff",
        contrastText: "#ffffff",
      },
    }
    let renderedBrandTitle: string | undefined

    const CaptureBrand = () => {
      renderedBrandTitle = useBrand().siteTitle
      return React.createElement("div", null, renderedBrandTitle)
    }
    const ThrowPage = () => {
      throw new Error("page failed")
    }

    await act(async () => {
      mountedRoot.render(React.createElement(MyApp as any, {
        Component: CaptureBrand,
        pageProps: { brand },
      }))
    })
    expect(renderedBrandTitle).toBe("Persistent Band")

    await act(async () => {
      mountedRoot.render(React.createElement(MyApp as any, {
        Component: ThrowPage,
        pageProps: {},
      }))
    })
    expect(container.textContent).toContain("Persistent Band")
    expect(container.textContent).toContain("page failed")

    await act(async () => {
      mountedRoot.render(React.createElement(MyApp as any, {
        Component: CaptureBrand,
        pageProps: {},
      }))
      blitz.__resetTestErrorBoundaries()
    })

    expect(renderedBrandTitle).toBe("Persistent Band")
    errorLog.mockRestore()
  })
})
