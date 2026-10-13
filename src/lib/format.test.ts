import { describe, expect, it } from "vitest";
import { baseName, dirName, formatBytes, relativeTime, tildePath } from "./format";

describe("format", () => {
  it("formats relative time", () => {
    const now = 1_000_000_000_000;
    const s = now / 1000;
    expect(relativeTime(s - 7200, now)).toBe("2 hours ago");
    expect(relativeTime(s - 86400, now)).toBe("1 day ago");
    expect(relativeTime(s - 5, now)).toBe("just now");
  });

  it("formats bytes", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(823 * 1024 * 1024)).toBe("823 MB");
  });

  it("splits paths", () => {
    expect(baseName("src/components/Note.tsx")).toBe("Note.tsx");
    expect(dirName("src/components/Note.tsx")).toBe("src/components");
    expect(dirName("README.md")).toBe("");
    expect(tildePath("/home/ana/Projects/x")).toBe("~/Projects/x");
  });
});
