import type { CommandDef } from "citty";
import { runCommand } from "citty";
import { afterEach, describe, expect, it, vi } from "vitest";

// resolveProject and bundleToSingleHtml are both reached via a dynamic
// `await import(...)` inside layout.ts's run() / runLayoutAudit(), so
// vi.mock intercepts them the same way it would a static import. Mocking
// resolveProject skips real filesystem project resolution; mocking
// bundleToSingleHtml gives a deterministic, fast failure well before any
// real browser or network work — exercising run()'s outer catch (the JSON
// failure envelope) without needing headless Chrome.
const FAKE_PROJECT = {
  dir: "/fake-project",
  name: "fake-project",
  indexPath: "/fake-project/index.html",
};

vi.mock("../utils/project.js", () => ({
  resolveProject: vi.fn(() => FAKE_PROJECT),
}));

vi.mock("@hyperframes/core/compiler", () => ({
  bundleToSingleHtml: vi.fn(async () => {
    throw new Error("bundling failed (test double)");
  }),
}));

import { createInspectCommand } from "./layout.js";

/**
 * citty's `meta` is `Resolvable<CommandMeta>` (object | promise | thunk).
 * This file's commands always define it as a synchronous object literal, so
 * narrow to that shape instead of asserting it with `as`.
 */
function metaDescription(command: CommandDef): string {
  const meta = command.meta;
  if (meta && typeof meta === "object" && "description" in meta) {
    return String(meta.description ?? "");
  }
  throw new Error("expected a synchronous meta object");
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("layout command deprecation (U5)", () => {
  it("marks both the layout and inspect command names' shared description as deprecated", () => {
    expect(metaDescription(createInspectCommand("layout"))).toContain("(deprecated, use check)");
    expect(metaDescription(createInspectCommand("inspect"))).toContain("(deprecated, use check)");
  });

  it("prints a one-line deprecation notice to stderr and never to stdout", async () => {
    const stderrWrites: string[] = [];
    const stdoutWrites: string[] = [];
    vi.spyOn(process.stderr, "write").mockImplementation((chunk: unknown) => {
      stderrWrites.push(String(chunk));
      return true;
    });
    vi.spyOn(process.stdout, "write").mockImplementation((chunk: unknown) => {
      stdoutWrites.push(String(chunk));
      return true;
    });
    vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
    vi.spyOn(console, "log").mockImplementation(() => {});

    await runCommand(createInspectCommand("layout"), { rawArgs: ["--json"] });

    const stderrText = stderrWrites.join("");
    expect(stderrText).toContain("hyperframes layout");
    expect(stderrText).toContain("hyperframes check");
    expect(stdoutWrites.join("")).toBe("");
  });

  it("--json output is valid JSON with _meta.deprecated === true on failure", async () => {
    vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await runCommand(createInspectCommand("layout"), { rawArgs: ["--json"] });

    const jsonCall = logSpy.mock.calls.find(
      ([arg]) => typeof arg === "string" && arg.trim().startsWith("{"),
    );
    expect(jsonCall).toBeDefined();
    const parsed = JSON.parse(String(jsonCall?.[0]));
    expect(parsed.ok).toBe(false);
    expect(parsed._meta.deprecated).toBe(true);
  });

  it("the inspect command name produces the same _meta.deprecated === true envelope", async () => {
    vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await runCommand(createInspectCommand("inspect"), { rawArgs: ["--json"] });

    const jsonCall = logSpy.mock.calls.find(
      ([arg]) => typeof arg === "string" && arg.trim().startsWith("{"),
    );
    const parsed = JSON.parse(String(jsonCall?.[0]));
    expect(parsed._meta.deprecated).toBe(true);
  });
});
