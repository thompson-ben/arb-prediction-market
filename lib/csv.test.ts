import { describe, expect, it } from "vitest";
import { toCSV } from "@/lib/csv";

describe("toCSV", () => {
  it("emits a header row and ordered columns", () => {
    const csv = toCSV(
      [{ a: 1, b: "x" }, { a: 2, b: "y" }],
      [
        { key: "a", label: "A" },
        { key: "b", label: "B" },
      ],
    );
    expect(csv).toBe("A,B\n1,x\n2,y");
  });

  it("quotes cells containing commas, quotes, or newlines", () => {
    const csv = toCSV(
      [{ q: 'Will "X" happen, or not?' }],
      [{ key: "q", label: "Question" }],
    );
    expect(csv).toBe('Question\n"Will ""X"" happen, or not?"');
  });

  it("renders null/undefined as empty cells", () => {
    const csv = toCSV(
      [{ a: null, b: undefined }],
      [
        { key: "a", label: "A" },
        { key: "b", label: "B" },
      ],
    );
    expect(csv).toBe("A,B\n,");
  });
});
