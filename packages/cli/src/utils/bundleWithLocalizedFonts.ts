/**
 * Bundle a project to a single HTML string AND localize its fonts — fetch and
 * embed `@font-face` rules for every requested family (including families
 * declared only via a remote `<link>`, e.g. Google Fonts) as data URIs.
 *
 * Why the audit/snapshot paths need this: core's `bundleToSingleHtml` inlines
 * only LOCAL stylesheets and leaves remote font `<link>`s as-is, so a snapshot
 * depends on loading the remote font at capture time. The render pipeline
 * instead localizes fonts in its compile stage, which is why a render embeds
 * (say) League Gothic correctly while a snapshot of the same composition can
 * fall back to an un-styled system sans when the remote font loses the race
 * against the capture. Running the SAME localization the render path uses makes
 * snapshot/check captures font-faithful and deterministic — no network race.
 *
 * Fail-open: if a family can't be fetched (offline, unknown font), the
 * underlying injector leaves the HTML unchanged, so this never makes a bundle
 * worse than plain `bundleToSingleHtml`.
 */
export async function bundleWithLocalizedFonts(projectDir: string): Promise<string> {
  const { bundleToSingleHtml } = await import("@hyperframes/core/compiler");
  const html = await bundleToSingleHtml(projectDir);
  try {
    const { injectDeterministicFontFaces } = await import("@hyperframes/producer");
    return await injectDeterministicFontFaces(html);
  } catch {
    // Producer/font localization unavailable (or a fetch layer threw) — fall
    // back to the plain bundle. Fonts declared via remote <link> still load at
    // capture time as before; we just lose the deterministic embed.
    return html;
  }
}
