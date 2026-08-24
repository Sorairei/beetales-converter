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
  applyVocalBandpassFilter,
  computePhoneticWeight,
  detectAudioOnsets,
  calculateVocalSegments,
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

test("applyVocalBandpassFilter attenuates out-of-band bass and high treble while passing vocal band", () => {
  const sampleRate = 44100;
  const numSamples = sampleRate * 1; // 1 second
  const bassInput = new Float32Array(numSamples);   // 60 Hz bass tone
  const vocalInput = new Float32Array(numSamples);  // 1000 Hz vocal tone
  const trebleInput = new Float32Array(numSamples); // 9000 Hz cymbal sizzle tone

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    bassInput[i] = Math.sin(2 * Math.PI * 60 * t);
    vocalInput[i] = Math.sin(2 * Math.PI * 1000 * t);
    trebleInput[i] = Math.sin(2 * Math.PI * 9000 * t);
  }

  const filteredBass = applyVocalBandpassFilter(bassInput, sampleRate, 300, 3400);
  const filteredVocal = applyVocalBandpassFilter(vocalInput, sampleRate, 300, 3400);
  const filteredTreble = applyVocalBandpassFilter(trebleInput, sampleRate, 300, 3400);

  // Compute RMS for each after stabilization (skip first 500 samples)
  const rms = (arr) => {
    let sum = 0;
    for (let i = 500; i < arr.length; i++) sum += arr[i] * arr[i];
    return Math.sqrt(sum / (arr.length - 500));
  };

  const bassEnergy = rms(filteredBass);
  const vocalEnergy = rms(filteredVocal);
  const trebleEnergy = rms(filteredTreble);

  // Vocal band energy (~1000Hz) should be preserved close to 0.707 (original sine RMS is 0.707)
  assert.ok(vocalEnergy > 0.5, `Vocal energy should remain strong: ${vocalEnergy}`);
  // Bass (<300Hz) and treble (>3400Hz) should be significantly attenuated
  assert.ok(bassEnergy < 0.15, `Bass energy should be strongly attenuated: ${bassEnergy}`);
  assert.ok(trebleEnergy < 0.25, `Treble energy should be strongly attenuated: ${trebleEnergy}`);
  assert.ok(vocalEnergy > bassEnergy * 3, "Vocal band must have significantly higher gain than bass");
});

test("computePhoneticWeight calculates accurate syllabic weights and detects punctuation pauses", () => {
  // Test Spanish word with vowels & consonants
  const c1 = computePhoneticWeight("corazón,");
  // "corazón" -> c, r, z, n (4 consonants) + o, a, ó (3 vowels) -> 4 + 3 * 1.8 = 9.4
  assert.equal(c1.weight, 9.4);
  assert.equal(c1.pauseType, "minor");
  assert.equal(c1.pauseDuration, 0.18);

  // Test sentence-ending word
  const c2 = computePhoneticWeight("cantar!");
  // "cantar" -> c, n, t, r (4 consonants) + a, a (2 vowels) -> 4 + 2 * 1.8 = 7.6
  assert.equal(c2.weight, 7.6);
  assert.equal(c2.pauseType, "major");
  assert.equal(c2.pauseDuration, 0.38);

  // Test short english word
  const c3 = computePhoneticWeight("I");
  assert.ok(c3.weight >= 1.0);
  assert.equal(c3.pauseType, "none");
});

test("detectAudioOnsets identifies transient attacks and syllable spikes", () => {
  const sampleRate = 44100;
  const duration = 3;
  const channelData = new Float32Array(sampleRate * duration);

  // Inject sharp bursts at 0.5s, 1.2s, 2.0s
  const burstTimes = [0.5, 1.2, 2.0];
  burstTimes.forEach((t) => {
    const startIdx = Math.floor(t * sampleRate);
    const burstLen = Math.floor(0.08 * sampleRate);
    for (let i = 0; i < burstLen; i++) {
      channelData[startIdx + i] = Math.sin(i / 5) * 0.8;
    }
  });

  const onsets = detectAudioOnsets(channelData, sampleRate, { minEnergy: 0.01 });
  assert.ok(onsets.length >= 3, `Expected at least 3 onsets, got ${onsets.length}`);

  // Verify onsets are within ~50ms of each burst
  burstTimes.forEach((bt) => {
    const matched = onsets.some((o) => Math.abs(o - bt) <= 0.06);
    assert.ok(matched, `Burst at ${bt}s was detected in onsets: ${JSON.stringify(onsets)}`);
  });
});

test("calculateVocalSegments identifies phrases and ignores intro/outro silences", () => {
  const sampleRate = 44100;
  const duration = 8;
  const channelData = new Float32Array(sampleRate * duration);

  // Phrase 1: 1.0s to 3.5s
  for (let i = Math.floor(sampleRate * 1.0); i < Math.floor(sampleRate * 3.5); i++) {
    channelData[i] = Math.sin(2 * Math.PI * 800 * (i / sampleRate)) * 0.6;
  }

  // Phrase 2: 5.0s to 7.0s (instrumental solo / silence between 3.5s and 5.0s)
  for (let i = Math.floor(sampleRate * 5.0); i < Math.floor(sampleRate * 7.0); i++) {
    channelData[i] = Math.sin(2 * Math.PI * 800 * (i / sampleRate)) * 0.6;
  }

  const segments = calculateVocalSegments(channelData, sampleRate, duration);
  assert.ok(segments.length >= 2, `Expected at least 2 segments, got ${segments.length}`);
  assert.ok(segments[0].start >= 0.8 && segments[0].start <= 1.2, `Segment 1 start ~1.0s: ${segments[0].start}`);
  assert.ok(segments[segments.length - 1].end >= 6.8, `Last segment end ~7.0s: ${segments[segments.length - 1].end}`);
});

test("autoAlignLyricsWithAudio computes valid timestamps with lead-in and monotonic ordering", () => {
  const words = splitLyricsIntoWords("I wanna sing a song, for you today!", { wordsPerBlock: 3 });
  assert.equal(words.every((w) => w.start === null), true);

  // Synthetic audio waveform with vocal bursts
  const sampleRate = 44100;
  const duration = 10;
  const channelData = new Float32Array(sampleRate * duration);
  // Add vocal band signal in seconds 1.0 to 8.5
  for (let i = sampleRate * 1; i < sampleRate * 8.5; i++) {
    channelData[i] = Math.sin(2 * Math.PI * 600 * (i / sampleRate)) * 0.5;
  }

  const aligned = autoAlignLyricsWithAudio(words, { channelData, sampleRate, duration }, {
    leadInOffset: 0.12,
    snapToOnsets: true,
  });

  assert.equal(aligned.length, words.length);
  assert.ok(aligned.every((w) => w.start !== null && w.end !== null && w.end > w.start));
  assert.ok(aligned[0].start >= 0);
  assert.ok(aligned[aligned.length - 1].end <= duration);

  // Verify strictly monotonic or non-overlapping within each block
  for (let i = 0; i < aligned.length - 1; i++) {
    if (aligned[i].blockIndex === aligned[i + 1].blockIndex) {
      assert.ok(
        aligned[i].start <= aligned[i + 1].start,
        `Word ${i} (${aligned[i].text}: ${aligned[i].start}) should start before word ${i + 1} (${aligned[i + 1].text}: ${aligned[i + 1].start})`
      );
    }
  }
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

test("autoAlignLyricsWithAudio supports Web Audio API AudioBuffer interface with multilingual lyrics", () => {
  const lyrics = "Bailando bajo la lluvia,\nSintiendo el ritmo en el corazón.";
  const words = splitLyricsIntoWords(lyrics, { wordsPerBlock: 3 });

  const sampleRate = 48000;
  const duration = 12;
  const channelData = new Float32Array(sampleRate * duration);
  // Add vocal harmonics
  for (let i = sampleRate * 1.5; i < sampleRate * 10.5; i++) {
    const t = i / sampleRate;
    channelData[i] = Math.sin(2 * Math.PI * 440 * t) * 0.4 + Math.sin(2 * Math.PI * 880 * t) * 0.2;
  }

  // Mock AudioBuffer
  const mockAudioBuffer = {
    sampleRate,
    duration,
    numberOfChannels: 1,
    getChannelData: (ch) => (ch === 0 ? channelData : null),
  };

  const aligned = autoAlignLyricsWithAudio(words, mockAudioBuffer, {
    leadInOffset: 0.10,
    snapToOnsets: true,
  });

  assert.equal(aligned.length, words.length);
  assert.ok(aligned.every((w) => w.start !== null && w.end !== null && w.end > w.start));
  assert.ok(aligned[0].start >= 0);
  assert.ok(aligned[aligned.length - 1].end <= duration);
});

test("autoAlignLyricsWithAudio correctly respects delayed vocal entrance and avoids starting at 0:00", () => {
  const lyrics = "De carácter fuerte y de humilde cuna\nTrabajó la tierra que era su fortuna";
  const words = splitLyricsIntoWords(lyrics, { wordsPerBlock: 4 });

  const sampleRate = 44100;
  const duration = 30; // 30s track
  const channelData = new Float32Array(sampleRate * duration);

  // 0s to 12s: intro with low steady drone (no syllabic voice modulation)
  for (let i = 0; i < sampleRate * 12; i++) {
    channelData[i] = Math.sin(2 * Math.PI * 100 * (i / sampleRate)) * 0.05;
  }

  // 12s to 26s: voice entrance with vocal formants and syllabic amplitude modulation
  for (let i = sampleRate * 12; i < sampleRate * 26; i++) {
    const t = i / sampleRate;
    const syllabicMod = 0.5 + 0.5 * Math.sin(2 * Math.PI * 4 * t); // 4Hz syllabic rate
    channelData[i] = Math.sin(2 * Math.PI * 650 * t) * 0.6 * syllabicMod;
  }

  const aligned = autoAlignLyricsWithAudio(words, { channelData, sampleRate, duration }, {
    leadInOffset: 0.12,
    snapToOnsets: true,
  });

  assert.equal(aligned.length, words.length);
  // The first word should NOT start at 0:00. It must start at or near the 12s vocal entrance (>= 11.5s)
  assert.ok(
    aligned[0].start >= 11.5,
    `First word "De" must start near 12s vocal entrance, but started at: ${aligned[0].start}s`
  );
  assert.ok(aligned[aligned.length - 1].end <= duration);
});



