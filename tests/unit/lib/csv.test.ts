import { describe, expect, it } from "vitest";

import { buildCsv } from "@/lib/csv";

describe("buildCsv", () => {
  it("joins headers and rows with CRLF", () => {
    expect(buildCsv(["a", "b"], [["1", "2"]])).toBe("a,b\r\n1,2");
  });

  it("quotes cells containing commas", () => {
    expect(buildCsv(["h"], [["a,b"]])).toBe('h\r\n"a,b"');
  });

  it("doubles internal quotes", () => {
    expect(buildCsv(["h"], [['he said "hi"']])).toBe('h\r\n"he said ""hi"""');
  });

  it("quotes cells containing newlines", () => {
    expect(buildCsv(["h"], [["line1\nline2"]])).toBe('h\r\n"line1\nline2"');
  });

  it("neutralizes formula-injection triggers with a leading quote", () => {
    expect(buildCsv(["h"], [["=SUM(A1)"]])).toBe("h\r\n'=SUM(A1)");
    expect(buildCsv(["h"], [["+1"]])).toBe("h\r\n'+1");
    expect(buildCsv(["h"], [["-1"]])).toBe("h\r\n'-1");
    expect(buildCsv(["h"], [["@cmd"]])).toBe("h\r\n'@cmd");
  });

  it("leaves safe cells untouched", () => {
    expect(buildCsv(["h"], [["plain text"]])).toBe("h\r\nplain text");
  });
});
