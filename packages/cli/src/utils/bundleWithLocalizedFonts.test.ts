import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@hyperframes/core/compiler", () => ({
  bundleToSingleHtml: vi.fn(async () => "<html><body>bundled</body></html>"),
}));

const injectMock = vi.fn(async (html: string) => html.replace("bundled", "bundled+fonts"));
vi.mock("@hyperframes/producer", () => ({
  injectDeterministicFontFaces: (html: string) => injectMock(html),
}));

import { bundleWithLocalizedFonts } from "./bundleWithLocalizedFonts.js";

afterEach(() => {
  vi.clearAllMocks();
});

describe("bundleWithLocalizedFonts", () => {
  it("localizes fonts on top of the plain bundle", async () => {
    const html = await bundleWithLocalizedFonts("/project");
    expect(injectMock).toHaveBeenCalledOnce();
    expect(html).toBe("<html><body>bundled+fonts</body></html>");
  });

  it("falls open to the plain bundle when font localization throws", async () => {
    injectMock.mockRejectedValueOnce(new Error("offline / fetch layer unavailable"));
    const html = await bundleWithLocalizedFonts("/project");
    // Never worse than a plain bundleToSingleHtml — the remote <link> still
    // loads at capture time as before.
    expect(html).toBe("<html><body>bundled</body></html>");
  });
});
