import test from "node:test";
import assert from "node:assert/strict";
import {
  splitLyricsIntoWords,
  formatAssTime,
  formatSrtTime,
  formatLrcTime,
  hexToAssColor,
  exportAss,
  exportSrt,
  exportLrc,
  parseLrc,
  parseSrt,
  KaraokeSyncEngine,
  SUBTITLE_PRESETS,
  autoAlignLyricsWithAudio,
  shiftTimestamps,
  drawKaraokeSubtitlesOnCanvas,
  drawAudioVisualizerBackground,
} from "../karaoke-sync.js";

test("splitLyricsIntoWords divides text into structured word objects with blocks", () => {
  const lyrics = "Hello world\nThis is a test of lyrics";
  const words = splitLyricsIntoWords(lyrics, { wordsPerBlock: 2 });
  assert.equal(words.length, 8);
  assert.equal(words[0].text, "Hello");
  assert.equal(words[0].blockIndex, 0);
  assert.equal(words[1].text, "world");
  assert.equal(words[1].blockIndex, 0);
  assert.equal(words[2].text, "This");
  assert.equal(words[2].blockIndex, 1);
  assert.equal(words[2].lineIndex, 1);
});

test("time formatters produce accurate strings", () => {
  assert.equal(formatAssTime(0), "0:00:00.00");
  assert.equal(formatAssTime(65.45), "0:01:05.45");
  assert.equal(formatAssTime(3661.05), "1:01:01.05");

  assert.equal(formatSrtTime(0), "00:00:00,000");
  assert.equal(formatSrtTime(65.45), "00:01:05,450");
  assert.equal(formatSrtTime(3661.05), "01:01:01,050");

  assert.equal(formatLrcTime(0), "[00:00.00]");
  assert.equal(formatLrcTime(65.45), "[01:05.45]");
});

test("hexToAssColor converts hex colors to ASS BGR format with alpha", () => {
  assert.equal(hexToAssColor("#FFFFFF"), "&H00FFFFFF&");
  assert.equal(hexToAssColor("#FFE600"), "&H0000E6FF&"); // Red FF, Green E6, Blue 00 -> BGR &H0000E6FF&
  assert.equal(hexToAssColor("#6EC832"), "&H0032C86E&"); // BGR &H0032C86E&
});

test("KaraokeSyncEngine manages tap recording and undo", () => {
  const words = splitLyricsIntoWords("One two three", { wordsPerBlock: 3 });
  const engine = new KaraokeSyncEngine(words);

  assert.equal(engine.currentIndex, 0);

  // First tap at 1.0s
  engine.recordTap(1.0);
  assert.equal(engine.currentIndex, 1);
  assert.equal(engine.words[0].start, 1.0);

  // Second tap at 2.5s
  engine.recordTap(2.5);
  assert.equal(engine.currentIndex, 2);
  assert.equal(engine.words[0].end, 2.5);
  assert.equal(engine.words[1].start, 2.5);

  // Test undo
  assert.equal(engine.undoTap(), true);
  assert.equal(engine.currentIndex, 1);
  assert.equal(engine.words[1].start, null);

  // Test active render state
  engine.recordTap(3.0);
  const state = engine.getActiveRenderState(2.0);
  assert.ok(state);
  assert.equal(state.activeWord.text, "One");
});

test("exportAss produces valid ASS header and dialogue events with styling", () => {
  const words = [
    { id: 0, text: "TikTok", start: 1.0, end: 1.5, blockIndex: 0 },
    { id: 1, text: "Subtitles", start: 1.5, end: 2.0, blockIndex: 0 },
  ];

  const assPop = exportAss(words, SUBTITLE_PRESETS.tiktok);
  assert.ok(assPop.includes("[Script Info]"));
  assert.ok(assPop.includes("[V4+ Styles]"));
  assert.ok(assPop.includes("[Events]"));
  assert.ok(assPop.includes("Dialogue: 0,0:00:01.00,0:00:01.50"));
  assert.ok(assPop.includes("TIKTOK"));

  const assKaraoke = exportAss(words, SUBTITLE_PRESETS.karaoke);
  assert.ok(assKaraoke.includes("{\\k50}TikTok"));
});

test("exportSrt and parseSrt round-trip subtitles correctly", () => {
  const words = [
    { id: 0, text: "Hello", start: 1.0, end: 2.0, blockIndex: 0 },
    { id: 1, text: "World", start: 2.0, end: 3.0, blockIndex: 0 },
  ];

  const srt = exportSrt(words);
  assert.ok(srt.includes("00:00:01,000 --> 00:00:03,000"));
  assert.ok(srt.includes("Hello World"));

  const parsed = parseSrt(srt);
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].text, "Hello");
  assert.equal(parsed[1].text, "World");
  assert.equal(parsed[0].start, 1.0);
});

test("exportLrc and parseLrc handle karaoke timestamp formats", () => {
  const words = [
    { id: 0, text: "Sing", start: 1.0, end: 2.0, blockIndex: 0 },
    { id: 1, text: "Song", start: 2.0, end: 3.0, blockIndex: 0 },
  ];

  const lrc = exportLrc(words, { title: "Test Song", artist: "BeeTales" });
  assert.ok(lrc.includes("[ti:Test Song]"));
  assert.ok(lrc.includes("[00:01.00]"));

  const parsed = parseLrc(lrc);
  assert.ok(parsed.length >= 2);
  assert.equal(parsed[0].text, "Sing");
});

test("autoAlignLyricsWithAudio computes valid timestamps for words based on audio duration", () => {
  const words = splitLyricsIntoWords("I wanna sing a song for you today", { wordsPerBlock: 3 });
  assert.equal(words.every((w) => w.start === null), true);

  // Fake audio waveform buffer
  const sampleRate = 44100;
  const duration = 10;
  const channelData = new Float32Array(sampleRate * duration);
  // Add some signal in seconds 1.0 to 9.0
  for (let i = sampleRate * 1; i < sampleRate * 9; i++) {
    channelData[i] = Math.sin(i / 10) * 0.5;
  }

  const aligned = autoAlignLyricsWithAudio(words, { channelData, sampleRate, duration });
  assert.equal(aligned.length, words.length);
  assert.ok(aligned.every((w) => w.start !== null && w.end !== null && w.end > w.start));
  assert.ok(aligned[0].start >= 0);
  assert.ok(aligned[aligned.length - 1].end <= duration);
});

test("shiftTimestamps nudges all word timings forward or backward", () => {
  const words = [
    { id: 0, text: "Hello", start: 1.0, end: 2.0 },
    { id: 1, text: "World", start: 2.0, end: 3.0 },
  ];

  shiftTimestamps(words, 0.5);
  assert.equal(words[0].start, 1.5);
  assert.equal(words[0].end, 2.5);

  shiftTimestamps(words, -0.3);
  assert.equal(words[0].start, 1.2);
  assert.equal(words[0].end, 2.2);
});

test("drawKaraokeSubtitlesOnCanvas and drawAudioVisualizerBackground execute on mock 2D context", () => {
  const words = [
    { id: 0, text: "Hello", start: 1.0, end: 2.0, blockIndex: 0 },
    { id: 1, text: "World", start: 2.0, end: 3.0, blockIndex: 0 },
  ];

  const calls = [];
  const mockCtx = {
    save: () => calls.push("save"),
    restore: () => calls.push("restore"),
    beginPath: () => calls.push("beginPath"),
    rect: () => calls.push("rect"),
    roundRect: () => calls.push("roundRect"),
    fill: () => calls.push("fill"),
    stroke: () => calls.push("stroke"),
    arc: () => calls.push("arc"),
    fillText: (text) => calls.push(`fillText:${text}`),
    strokeText: (text) => calls.push(`strokeText:${text}`),
    measureText: (text) => ({ width: text.length * 10 }),
    translate: () => calls.push("translate"),
    scale: () => calls.push("scale"),
    clearRect: () => calls.push("clearRect"),
    fillRect: () => calls.push("fillRect"),
    createRadialGradient: () => ({ addColorStop: () => {} }),
    createLinearGradient: () => ({ addColorStop: () => {} }),
  };

  // Subtitle drawing test
  drawKaraokeSubtitlesOnCanvas(mockCtx, 1280, 720, 1.5, words, SUBTITLE_PRESETS.tiktok);
  assert.ok(calls.includes("save"));
  assert.ok(calls.includes("restore"));
  assert.ok(calls.some((c) => c.startsWith("fillText")));

  // Visualizer background test
  calls.length = 0;
  drawAudioVisualizerBackground(mockCtx, 1280, 720, 1.5);
  assert.ok(calls.includes("fillRect"));
  assert.ok(calls.includes("arc"));
});
