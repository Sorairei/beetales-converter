import test from "node:test";
import assert from "node:assert/strict";

import {
  formatBytes,
  formatDuration,
  getFileExtension,
  getTrimDurationArgs,
  getTrimInputArgs,
  parseTimeValue,
  safeBaseName,
} from "../converter-utils.js";

test("parseTimeValue accepts supported time formats", () => {
  assert.equal(parseTimeValue(""), undefined);
  assert.equal(parseTimeValue("45"), 45);
  assert.equal(parseTimeValue("01:30"), 90);
  assert.equal(parseTimeValue("1:02:03.5"), 3723.5);
});

test("parseTimeValue rejects malformed or out-of-range components", () => {
  assert.equal(parseTimeValue("1:60"), null);
  assert.equal(parseTimeValue("1:2:60"), null);
  assert.equal(parseTimeValue("1::2"), null);
  assert.equal(parseTimeValue("not-a-time"), null);
});

test("trim arguments preserve start and calculate duration", () => {
  assert.deepEqual(getTrimInputArgs({ start: 12.5 }), ["-ss", "12.5"]);
  assert.deepEqual(getTrimInputArgs({}), []);
  assert.deepEqual(getTrimDurationArgs({ start: 10, end: 25 }), ["-t", "15"]);
  assert.deepEqual(getTrimDurationArgs({ end: 25 }), ["-t", "25"]);
  assert.deepEqual(getTrimDurationArgs({ start: 10 }), []);
});

test("formatters produce compact user-facing values", () => {
  assert.equal(formatBytes(0), "0 B");
  assert.equal(formatBytes(1536), "1.5 KB");
  assert.equal(formatDuration(65.9), "1:05");
  assert.equal(formatDuration(3723), "1:02:03");
});

test("filename helpers normalize safe output names", () => {
  assert.equal(getFileExtension("CLIP.MP4"), "mp4");
  assert.equal(getFileExtension("README"), "");
  assert.equal(safeBaseName("  Canción final (v2).mov"), "Cancion-final-v2");
  assert.equal(safeBaseName("***.mp4"), "converted-media");
  assert.equal(safeBaseName(`${"a".repeat(100)}.mp4`).length, 80);
});
