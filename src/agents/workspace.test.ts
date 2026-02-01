import { describe, expect, it } from "vitest";

import {
  DEFAULT_MEMORY_ALT_FILENAME,
  DEFAULT_MEMORY_FILENAME,
  DEFAULT_SITUATION_FILENAME,
  loadWorkspaceBootstrapFiles,
  filterBootstrapFilesForSession,
} from "./workspace.js";
import { makeTempWorkspace, writeWorkspaceFile } from "../test-helpers/workspace.js";

describe("loadWorkspaceBootstrapFiles", () => {
  it("includes MEMORY.md when present", async () => {
    const tempDir = await makeTempWorkspace("openclaw-workspace-");
    await writeWorkspaceFile({ dir: tempDir, name: "MEMORY.md", content: "memory" });

    const files = await loadWorkspaceBootstrapFiles(tempDir);
    const memoryEntries = files.filter((file) =>
      [DEFAULT_MEMORY_FILENAME, DEFAULT_MEMORY_ALT_FILENAME].includes(file.name),
    );

    expect(memoryEntries).toHaveLength(1);
    expect(memoryEntries[0]?.missing).toBe(false);
    expect(memoryEntries[0]?.content).toBe("memory");
  });

  it("includes memory.md when MEMORY.md is absent", async () => {
    const tempDir = await makeTempWorkspace("openclaw-workspace-");
    await writeWorkspaceFile({ dir: tempDir, name: "memory.md", content: "alt" });

    const files = await loadWorkspaceBootstrapFiles(tempDir);
    const memoryEntries = files.filter((file) =>
      [DEFAULT_MEMORY_FILENAME, DEFAULT_MEMORY_ALT_FILENAME].includes(file.name),
    );

    expect(memoryEntries).toHaveLength(1);
    expect(memoryEntries[0]?.missing).toBe(false);
    expect(memoryEntries[0]?.content).toBe("alt");
  });

  it("omits memory entries when no memory files exist", async () => {
    const tempDir = await makeTempWorkspace("openclaw-workspace-");

    const files = await loadWorkspaceBootstrapFiles(tempDir);
    const memoryEntries = files.filter((file) =>
      [DEFAULT_MEMORY_FILENAME, DEFAULT_MEMORY_ALT_FILENAME].includes(file.name),
    );

    expect(memoryEntries).toHaveLength(0);
  });

  it("includes SITUATION.md when present", async () => {
    const tempDir = await makeTempWorkspace("openclaw-workspace-");
    await writeWorkspaceFile({ dir: tempDir, name: "SITUATION.md", content: "# Situation\ntest" });

    const files = await loadWorkspaceBootstrapFiles(tempDir);
    const situationEntries = files.filter((file) => file.name === DEFAULT_SITUATION_FILENAME);

    expect(situationEntries).toHaveLength(1);
    expect(situationEntries[0]?.missing).toBe(false);
    expect(situationEntries[0]?.content).toContain("# Situation");
  });

  it("omits SITUATION.md when not present", async () => {
    const tempDir = await makeTempWorkspace("openclaw-workspace-");

    const files = await loadWorkspaceBootstrapFiles(tempDir);
    const situationEntries = files.filter((file) => file.name === DEFAULT_SITUATION_FILENAME);

    expect(situationEntries).toHaveLength(0);
  });

  it("includes SITUATION.md in subagent bootstrap allowlist", async () => {
    const tempDir = await makeTempWorkspace("openclaw-workspace-");
    await writeWorkspaceFile({ dir: tempDir, name: "SITUATION.md", content: "# Situation" });

    const files = await loadWorkspaceBootstrapFiles(tempDir);
    const filtered = filterBootstrapFilesForSession(files, "agent:test:sub1:main");
    const situation = filtered.find((f) => f.name === DEFAULT_SITUATION_FILENAME);

    expect(situation).toBeDefined();
    expect(situation?.missing).toBe(false);
  });
});
