import type { CommandDef } from "citty";
import { runCommand } from "citty";
import { afterEach, describe, expect, it, vi } from "vitest";

// See layout.test.ts for why these two dynamic-import targets are mocked:
// resolveProject skips real filesystem resolution, and bundleToSingleHtml
// gives a fast, deterministic failure that exercises run()'s outer catch
// (the JSON failure envelope) without needing headless Chrome.
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

import inspectCommand from "./inspect.js";

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

describe("inspect command deprecation (U5)", () => {
  it("is the compatibility alias for layout, sharing its deprecated description", () => {
    expect(metaDescription(inspectCommand)).toContain("(deprecated, use check)");
  });

  it("prints a one-line deprecation notice naming 'inspect' on stderr, never stdout", async () => {
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

    await runCommand(inspectCommand, { rawArgs: ["--json"] });

    const stderrText = stderrWrites.join("");
    expect(stderrText).toContain("hyperframes inspect");
    expect(stderrText).toContain("hyperframes check");
    expect(stdoutWrites.join("")).toBe("");
  });

  it("--json output is valid JSON with _meta.deprecated === true on failure", async () => {
    vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await runCommand(inspectCommand, { rawArgs: ["--json"] });

    const jsonCall = logSpy.mock.calls.find(
      ([arg]) => typeof arg === "string" && arg.trim().startsWith("{"),
    );
    expect(jsonCall).toBeDefined();
    const parsed = JSON.parse(String(jsonCall?.[0]));
    expect(parsed.ok).toBe(false);
    expect(parsed._meta.deprecated).toBe(true);
  });
});
