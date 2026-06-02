import assert from "node:assert/strict";
import test from "node:test";
import { getLineNumber } from "../../src/utils/getLineNumber.ts";

test("getLineNumber finds the first matching line from the provided offset", () => {
  const content = ["first line", "second line", "third line"].join("\n");

  assert.equal(getLineNumber(content, "second"), 2);
  assert.equal(getLineNumber(content, "third", 2), 3);
  assert.equal(getLineNumber(content, "missing"), undefined);
});
