import { describe, it, expect } from "vitest";
import { mapRows } from "./import.mjs";

describe("import dry run", () => {
  it("defaults unknown states to pending and reports duplicate text and invalid rows", () => {
    const report = mapRows([
      { id: 7, text: "  Víc je víc než míň. ", status: "approved" },
      { id: 8, text: "víc je víc než míň.", status: "legacy" },
      { id: 8, text: "duplicitní identifikátor" },
      { id: 9, text: "" },
    ]);
    expect(report.valid).toHaveLength(2);
    expect(report.valid[1].status).toBe("pending");
    expect(report.duplicates).toEqual([{ id: "8", other: "7" }]);
    expect(report.errors).toHaveLength(2);
  });
});
