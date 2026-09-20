import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { renderAbcToSvg } from "../src/pages/api/abc/render"

const browserGlobalNames = ["window", "document", "navigator"] as const
type BrowserGlobalName = typeof browserGlobalNames[number]

const validNotation = `X:1
T:Test
M:4/4
K:C
CDEF|GABc|`

function snapshotBrowserGlobals() {
  return new Map<BrowserGlobalName, PropertyDescriptor | undefined>(
    browserGlobalNames.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)])
  )
}

function restoreBrowserGlobals(
  descriptors: Map<BrowserGlobalName, PropertyDescriptor | undefined>
) {
  for (const name of browserGlobalNames) {
    const descriptor = descriptors.get(name)
    if (descriptor) {
      Object.defineProperty(globalThis, name, descriptor)
    } else {
      Reflect.deleteProperty(globalThis, name)
    }
  }
}

function expectBrowserGlobalsToMatch(
  descriptors: Map<BrowserGlobalName, PropertyDescriptor | undefined>
) {
  for (const name of browserGlobalNames) {
    expect(Object.getOwnPropertyDescriptor(globalThis, name)).toEqual(descriptors.get(name))
  }
}

describe("renderAbcToSvg", () => {
  let originalDescriptors: Map<BrowserGlobalName, PropertyDescriptor | undefined>

  beforeEach(() => {
    originalDescriptors = snapshotBrowserGlobals()

    const nodeNavigator = { userAgent: "Node.js" }
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      enumerable: true,
      get: () => nodeNavigator,
    })
  })

  afterEach(() => {
    restoreBrowserGlobals(originalDescriptors)
  })

  it("renders under a getter-only navigator and restores every browser global", () => {
    const expectedDescriptors = snapshotBrowserGlobals()

    const svg = renderAbcToSvg(validNotation)

    expect(svg).toMatch(/^<svg\b/)
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"')
    expectBrowserGlobalsToMatch(expectedDescriptors)
  })

  it("restores every browser global when abcjs throws", () => {
    const expectedDescriptors = snapshotBrowserGlobals()

    expect(() => renderAbcToSvg(validNotation, {
      afterParsing: () => {
        throw new Error("forced ABC rendering failure")
      },
    })).toThrow("forced ABC rendering failure")

    expectBrowserGlobalsToMatch(expectedDescriptors)
  })
})
