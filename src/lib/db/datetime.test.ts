import { expect, it } from "vitest";
import { mysqlDateTime } from "./datetime";

it("stores the imported November 24 publication date as UTC MySQL datetime", () => {
  expect(mysqlDateTime("2026-11-24T06:30:00.000Z")).toBe("2026-11-24 06:30:00");
});
it("preserves null dates and normalises scheduled timezone offsets", () => {
  expect(mysqlDateTime(null)).toBeNull();
  expect(mysqlDateTime("2026-11-25T12:00:00+05:30")).toBe("2026-11-25 06:30:00");
});
