/**
 * BeeTales Media Converter — Karaoke & Dynamic Subtitle Sync Engine
 * Handles lyrics splitting, tap-to-sync timestamp recording,
 * subtitle parsing/exporting (LRC, SRT, ASS), and real-time animation styling.
 */

/**
 * Default style presets for dynamic subtitles and karaoke
 */
export const SUBTITLE_PRESETS = {
  tiktok: {
    id: "tiktok",
    name: "TikTok Pop",
    fontFamily: "'Montserrat', 'Arial Black', sans-serif",
    assFont: "Arial Black",
    fontSize: 48,
    primaryColor: "#FFFFFF",
    activeColor: "#FFE600", // Bright TikTok Yellow
    strokeColor: "#000000",
    strokeWidth: 4,
    shadowColor: "rgba(0, 0, 0, 0.8)",
    shadowDistance: 4,
    position: "middle", // top, middle, bottom
    animation: "pop",
    uppercase: true,
    wordsPerBlock: 3,
  },
  karaoke: {
    id: "karaoke",
    name: "Karaoke Glow",
    fontFamily: "'Montserrat', sans-serif",
    assFont: "Arial",
    fontSize: 42,
    primaryColor: "#F2E8C6", // BeeTales cream
    activeColor: "#6EC832", // BeeTales circuit green
    strokeColor: "#040C06",
    strokeWidth: 3,
    shadowColor: "rgba(110, 200, 50, 0.6)",
    shadowDistance: 0,
    glow: true,
    position: "bottom",
    animation: "karaoke-glow",
    uppercase: false,
    wordsPerBlock: 5,
  },
  mrbeast: {
    id: "mrbeast",
    name: "Creator / Shorts",
    fontFamily: "'Impact', 'Arial Black', sans-serif",
    assFont: "Impact",
    fontSize: 54,
    primaryColor: "#FFFFFF",
    activeColor: "#00FF66", // High-voltage green
    strokeColor: "#000000",
    strokeWidth: 5,
    shadowColor: "rgba(0, 0, 0, 0.95)",
    shadowDistance: 6,
    position: "middle",
    animation: "pop",
    uppercase: true,
    wordsPerBlock: 2,
  },
  cinematic: {
    id: "cinematic",
    name: "Cinematic Clean",
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    assFont: "Arial",
    fontSize: 32,
    primaryColor: "#FFFFFF",
    activeColor: "#F5A623", // Amber
    strokeColor: "transparent",
    strokeWidth: 0,
    shadowColor: "rgba(0, 0, 0, 0.8)",
    shadowDistance: 3,
    position: "bottom",
    animation: "fade",
    uppercase: false,
    wordsPerBlock: 8,
  },
};

/**
 * Splits raw pasted lyrics/script into structured words and blocks
 * @param {string} rawText
 * @param {Object} options
 * @returns {Array<Object>} Array of word objects
 */
export function splitLyricsIntoWords(rawText, options = {}) {
  if (!rawText || typeof rawText !== "string") return [];
  const wordsPerBlock = Math.max(1, parseInt(options.wordsPerBlock, 10) || 3);
  const preserveLineBreaks = options.preserveLineBreaks !== false;

  const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const wordsList = [];
  let globalWordId = 0;
  let blockIndex = 0;

  for (let lIdx = 0; lIdx < lines.length; lIdx++) {
    const rawWords = lines[lIdx].split(/\s+/).filter(Boolean);
    if (!rawWords.length) continue;

    if (preserveLineBreaks) {
      // Chunk within this line
      for (let i = 0; i < rawWords.length; i += wordsPerBlock) {
        const chunk = rawWords.slice(i, i + wordsPerBlock);
        for (const w of chunk) {
          wordsList.push({
            id: globalWordId++,
            text: w,
            start: null,
            end: null,
            blockIndex: blockIndex,
            lineIndex: lIdx,
          });
        }
        blockIndex++;
      }
    } else {
      // Treat all as continuous flow
      for (const w of rawWords) {
        const currentBlock = Math.floor(globalWordId / wordsPerBlock);
        wordsList.push({
          id: globalWordId++,
          text: w,
          start: null,
          end: null,
          blockIndex: currentBlock,
          lineIndex: lIdx,
        });
      }
    }
  }

  return wordsList;
}

/**
 * Format seconds to ASS time format: H:MM:SS.CC (Centiseconds)
 */
export function formatAssTime(seconds) {
  if (seconds == null || isNaN(seconds) || seconds < 0) seconds = 0;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const cs = Math.floor((seconds % 1) * 100);
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}

/**
 * Format seconds to SRT time format: HH:MM:SS,mmm (Milliseconds)
 */
export function formatSrtTime(seconds) {
  if (seconds == null || isNaN(seconds) || seconds < 0) seconds = 0;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
}

/**
 * Format seconds to LRC time format: [mm:ss.xx]
 */
export function formatLrcTime(seconds) {
  if (seconds == null || isNaN(seconds) || seconds < 0) seconds = 0;
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const cs = Math.floor((seconds % 1) * 100);
  return `[${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}]`;
}

/**
 * Convert HEX color (#RRGGBB) to ASS color format (&H00BBGGRR&)
 */
export function hexToAssColor(hex, alpha = 0) {
  if (!hex || hex === "transparent") return "&HFF000000&";
  let clean = hex.replace("#", "").trim();
  if (clean.length === 3) {
    clean = clean.split("").map((c) => c + c).join("");
  }
  if (clean.length !== 6) return "&H00FFFFFF&";
  const r = clean.substring(0, 2);
  const g = clean.substring(2, 4);
  const b = clean.substring(4, 6);
  const a = String(Math.floor(alpha * 255).toString(16)).padStart(2, "0").toUpperCase();
  return `&H${a}${b}${g}${r}&`.toUpperCase();
}

/**
 * Group list of word objects into distinct blocks
 */
export function groupWordsByBlock(words) {
  const blocksMap = new Map();
  for (const w of words) {
    if (!blocksMap.has(w.blockIndex)) {
      blocksMap.set(w.blockIndex, []);
    }
    blocksMap.get(w.blockIndex).push(w);
  }
  return Array.from(blocksMap.values());
}

/**
 * Generates an Advanced SubStation Alpha (.ass) subtitle string
 * Compatible with ffmpeg.wasm (-vf "subtitles=subs.ass")
 * Supports high-impact TikTok word-highlighting and Karaoke color wipes
 */
export function exportAss(words, style = {}) {
  const cfg = { ...SUBTITLE_PRESETS.tiktok, ...style };
  const blocks = groupWordsByBlock(words.filter((w) => w.start !== null && w.end !== null));

  // Determine alignment: 2 = bottom center, 5 = middle center, 8 = top center
  let alignment = 2;
  if (cfg.position === "middle") alignment = 5;
  if (cfg.position === "top") alignment = 8;

  const primaryAss = hexToAssColor(cfg.primaryColor);
  const secondaryAss = hexToAssColor(cfg.activeColor); // Highlight color
  const outlineAss = hexToAssColor(cfg.strokeColor);
  const backAss = hexToAssColor(cfg.shadowColor || "#000000", 0.5);

  let ass = `[Script Info]
Title: BeeTales Dynamic Subtitles
ScriptType: v4.00+
WrapStyle: 0
ScaledBorderAndShadow: yes
YCbCr Matrix: None
PlayResX: 1920
PlayResY: 1080

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${cfg.assFont || "Arial Black"},${Math.round(cfg.fontSize * 1.6)},${primaryAss},${secondaryAss},${outlineAss},${backAss},1,0,0,0,100,100,2,0,1,${cfg.strokeWidth * 2},${cfg.shadowDistance * 1.5},${alignment},40,40,60,1
Style: Highlight,${cfg.assFont || "Arial Black"},${Math.round(cfg.fontSize * 1.6)},${secondaryAss},${primaryAss},${outlineAss},${backAss},1,0,0,0,108,108,2,0,1,${cfg.strokeWidth * 2},${cfg.shadowDistance * 1.5},${alignment},40,40,60,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  for (const block of blocks) {
    if (!block.length) continue;
    const blockStart = Math.min(...block.map((w) => w.start));
    const blockEnd = Math.max(...block.map((w) => w.end));

    if (cfg.animation === "pop" || cfg.animation === "tiktok") {
      // Dynamic Pop / Highlight: Create separate timed event for each active word inside block
      for (let i = 0; i < block.length; i++) {
        const activeWord = block[i];
        const lineContent = block
          .map((w, idx) => {
            const rawText = cfg.uppercase ? w.text.toUpperCase() : w.text;
            if (idx === i) {
              return `{\\c${secondaryAss}\\t(0,100,\\fscx112\\fscy112)}${rawText}{\\fscx100\\fscy100\\c${primaryAss}}`;
            }
            return rawText;
          })
          .join(" ");

        ass += `Dialogue: 0,${formatAssTime(activeWord.start)},${formatAssTime(activeWord.end)},Default,,0,0,0,,${lineContent}\n`;
      }
    } else {
      // Karaoke Wipe (\k tags in centiseconds)
      let karaokeLine = "";
      for (const w of block) {
        const durationCs = Math.max(1, Math.round(((w.end || w.start + 0.3) - w.start) * 100));
        const rawText = cfg.uppercase ? w.text.toUpperCase() : w.text;
        karaokeLine += `{\\k${durationCs}}${rawText} `;
      }
      ass += `Dialogue: 0,${formatAssTime(blockStart)},${formatAssTime(blockEnd)},Default,,0,0,0,,${karaokeLine.trim()}\n`;
    }
  }

  return ass;
}

/**
 * Generates an SRT (SubRip) subtitle string from synchronized words
 */
export function exportSrt(words, options = {}) {
  const blocks = groupWordsByBlock(words.filter((w) => w.start !== null && w.end !== null));
  const uppercase = options.uppercase || false;
  let srt = "";
  let index = 1;

  for (const block of blocks) {
    if (!block.length) continue;
    const blockStart = Math.min(...block.map((w) => w.start));
    const blockEnd = Math.max(...block.map((w) => w.end));
    const text = block.map((w) => (uppercase ? w.text.toUpperCase() : w.text)).join(" ");

    srt += `${index++}\n`;
    srt += `${formatSrtTime(blockStart)} --> ${formatSrtTime(blockEnd)}\n`;
    srt += `${text}\n\n`;
  }

  return srt.trim() + "\n";
}

/**
 * Generates an LRC (Karaoke) string from synchronized words
 */
export function exportLrc(words, metadata = {}) {
  const blocks = groupWordsByBlock(words.filter((w) => w.start !== null && w.end !== null));
  let lrc = "";

  if (metadata.title) lrc += `[ti:${metadata.title}]\n`;
  if (metadata.artist) lrc += `[ar:${metadata.artist}]\n`;
  lrc += `[by:BeeTales Media Converter]\n`;

  for (const block of blocks) {
    if (!block.length) continue;
    const blockStart = Math.min(...block.map((w) => w.start));
    let lineWithWordTimestamps = formatLrcTime(blockStart);

    for (const w of block) {
      lineWithWordTimestamps += ` <${formatLrcTime(w.start).slice(1, -1)}>${w.text} <${formatLrcTime(w.end).slice(1, -1)}>`;
    }
    lrc += `${lineWithWordTimestamps.trim()}\n`;
  }

  return lrc;
}

/**
 * Parse an LRC file into word/block objects
 */
export function parseLrc(lrcText) {
  if (!lrcText || typeof lrcText !== "string") return [];
  const lines = lrcText.split(/\r?\n/);
  const words = [];
  let wordId = 0;
  let blockIndex = 0;

  const timeRegex = /\[(\d{1,2}):(\d{2})(?:\.(\d{2,3}))?\]/g;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("[ti:") || trimmed.startsWith("[ar:") || trimmed.startsWith("[by:") || trimmed.startsWith("[al:")) {
      continue;
    }

    const matches = Array.from(trimmed.matchAll(timeRegex));
    if (!matches.length) continue;

    const lastMatch = matches[matches.length - 1];
    let textContent = trimmed.substring(lastMatch.index + lastMatch[0].length).trim();
    if (!textContent) continue;

    const min = parseInt(lastMatch[1], 10);
    const sec = parseInt(lastMatch[2], 10);
    const ms = lastMatch[3] ? (lastMatch[3].length === 2 ? parseInt(lastMatch[3], 10) * 10 : parseInt(lastMatch[3], 10)) : 0;
    const startTime = min * 60 + sec + ms / 1000;

    // Strip inline <00:00.00> or <00:00> tags from textContent
    const cleanText = textContent.replace(/<[^>]+>/g, " ");
    const rawWords = cleanText.split(/\s+/).filter(Boolean);
    const wordDuration = 0.4;

    for (let i = 0; i < rawWords.length; i++) {
      const wStart = startTime + i * wordDuration;
      words.push({
        id: wordId++,
        text: rawWords[i],
        start: Number(wStart.toFixed(2)),
        end: Number((wStart + wordDuration).toFixed(2)),
        blockIndex: blockIndex,
        lineIndex: blockIndex,
      });
    }
    blockIndex++;
  }

  return words;
}

/**
 * Parse SRT file into words/blocks
 */
export function parseSrt(srtText) {
  if (!srtText || typeof srtText !== "string") return [];
  const normalized = srtText.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const entries = normalized.split(/\n\n+/);
  const words = [];
  let wordId = 0;
  let blockIndex = 0;

  const srtTimeRegex = /(\d{2}):(\d{2}):(\d{2}),(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2}),(\d{3})/;

  for (const entry of entries) {
    const lines = entry.trim().split("\n");
    if (lines.length < 2) continue;

    let timeLine = "";
    let textLines = [];

    for (const l of lines) {
      if (srtTimeRegex.test(l)) {
        timeLine = l;
      } else if (timeLine && l.trim()) {
        textLines.push(l.trim());
      }
    }

    const match = timeLine.match(srtTimeRegex);
    if (!match) continue;

    const start = parseInt(match[1], 10) * 3600 + parseInt(match[2], 10) * 60 + parseInt(match[3], 10) + parseInt(match[4], 10) / 1000;
    const end = parseInt(match[5], 10) * 3600 + parseInt(match[6], 10) * 60 + parseInt(match[7], 10) + parseInt(match[8], 10) / 1000;

    const rawText = textLines.join(" ").replace(/<[^>]+>/g, ""); // Strip HTML tags
    const rawWords = rawText.split(/\s+/).filter(Boolean);
    if (!rawWords.length) continue;

    const duration = Math.max(0.2, (end - start) / rawWords.length);

    for (let i = 0; i < rawWords.length; i++) {
      const wStart = start + i * duration;
      const wEnd = i === rawWords.length - 1 ? end : start + (i + 1) * duration;
      words.push({
        id: wordId++,
        text: rawWords[i],
        start: Number(wStart.toFixed(2)),
        end: Number(wEnd.toFixed(2)),
        blockIndex: blockIndex,
        lineIndex: blockIndex,
      });
    }
    blockIndex++;
  }

  return words;
}

/**
 * Interactive Tap-to-Sync State Machine
 */
export class KaraokeSyncEngine {
  constructor(words = []) {
    this.words = words;
    this.currentIndex = 0;
    this.history = [];
    this.activeStyle = { ...SUBTITLE_PRESETS.tiktok };
  }

  setWords(words) {
    this.words = words;
    this.currentIndex = 0;
    this.history = [];
  }

  setStyle(styleObj) {
    this.activeStyle = { ...this.activeStyle, ...styleObj };
  }

  /**
   * Record a timestamp tap for the current word
   * @param {number} currentTime Current video/audio time in seconds
   * @returns {Object|null} Synced word object or null if done
   */
  recordTap(currentTime) {
    if (this.currentIndex >= this.words.length) return null;

    const currentWord = this.words[this.currentIndex];
    const prevWord = this.currentIndex > 0 ? this.words[this.currentIndex - 1] : null;

    // Save previous state for undo
    this.history.push({
      index: this.currentIndex,
      prevEnd: prevWord ? prevWord.end : null,
    });

    // Close previous word duration to match the start of the new word
    if (prevWord) {
      prevWord.end = Number(Math.max(prevWord.start + 0.05, currentTime).toFixed(2));
    }

    currentWord.start = Number(currentTime.toFixed(2));
    // Default estimated end (0.35s) until next tap
    currentWord.end = Number((currentTime + 0.35).toFixed(2));

    this.currentIndex++;
    return currentWord;
  }

  /**
   * Undo the last recorded tap
   */
  undoTap() {
    if (!this.history.length || this.currentIndex === 0) return false;

    const lastAction = this.history.pop();
    this.currentIndex = lastAction.index;

    const currentWord = this.words[this.currentIndex];
    if (currentWord) {
      currentWord.start = null;
      currentWord.end = null;
    }

    const prevWord = this.currentIndex > 0 ? this.words[this.currentIndex - 1] : null;
    if (prevWord) {
      prevWord.end = lastAction.prevEnd;
    }

    return true;
  }

  /**
   * Reset all timestamps
   */
  resetSync() {
    this.currentIndex = 0;
    this.history = [];
    for (const w of this.words) {
      w.start = null;
      w.end = null;
    }
  }

  /**
   * Adjust word timestamps with fine offset
   */
  adjustWordOffset(wordId, deltaSeconds) {
    const word = this.words.find((w) => w.id === wordId);
    if (!word || word.start === null) return;
    word.start = Math.max(0, Number((word.start + deltaSeconds).toFixed(2)));
    if (word.end !== null) {
      word.end = Math.max(word.start + 0.05, Number((word.end + deltaSeconds).toFixed(2)));
    }
  }

  /**
   * Get active block and active word for given playback time
   */
  getActiveRenderState(currentTime) {
    const syncedWords = this.words.filter((w) => w.start !== null && w.end !== null);
    if (!syncedWords.length) return null;

    // Find word active at this exact second
    const activeWord = syncedWords.find((w) => currentTime >= w.start && currentTime <= w.end);
    if (activeWord) {
      const blockWords = syncedWords.filter((w) => w.blockIndex === activeWord.blockIndex);
      return {
        activeWord,
        blockWords,
        blockIndex: activeWord.blockIndex,
        isCompleted: false,
      };
    }

    // If between words in a block
    const activeBlock = syncedWords.filter((w) => {
      const blockMin = Math.min(...syncedWords.filter((sw) => sw.blockIndex === w.blockIndex).map((sw) => sw.start));
      const blockMax = Math.max(...syncedWords.filter((sw) => sw.blockIndex === w.blockIndex).map((sw) => sw.end));
      return currentTime >= blockMin && currentTime <= blockMax;
    });

    if (activeBlock.length) {
      const blockWords = syncedWords.filter((w) => w.blockIndex === activeBlock[0].blockIndex);
      return {
        activeWord: null,
        blockWords,
        blockIndex: activeBlock[0].blockIndex,
        isCompleted: false,
      };
    }

    return null;
  }
}

/**
 * Applies a 2nd-order cascaded Butterworth band-pass filter (300Hz - 3400Hz)
 * to isolate human vocal formants and eliminate sub-bass, kicks, and high-frequency cymbals/hiss.
 * @param {Float32Array|Array<number>} channelData - Raw PCM audio samples
 * @param {number} [sampleRate=44100] - Sampling rate in Hz (e.g. 44100, 48000)
 * @param {number} [lowCut=300] - Lower cutoff frequency in Hz
 * @param {number} [highCut=3400] - Upper cutoff frequency in Hz
 * @returns {Float32Array} Filtered PCM samples
 */
export function applyVocalBandpassFilter(channelData, sampleRate = 44100, lowCut = 300, highCut = 3400) {
  if (!channelData || !channelData.length) return new Float32Array(0);
  const len = channelData.length;
  const filtered = new Float32Array(len);

  // Guard cutoff frequencies within Nyquist limits
  const nyquist = (sampleRate || 44100) * 0.5;
  const safeLow = Math.max(20, Math.min(lowCut || 300, nyquist * 0.9));
  const safeHigh = Math.max(safeLow + 50, Math.min(highCut || 3400, nyquist * 0.95));
  const q = 0.7071067811865476; // 1 / sqrt(2) for Butterworth response

  // High-Pass Filter Coefficients
  const wHp = (2 * Math.PI * safeLow) / sampleRate;
  const cosHp = Math.cos(wHp);
  const sinHp = Math.sin(wHp);
  const alphaHp = sinHp / (2 * q);

  const b0Hp = (1 + cosHp) / 2;
  const b1Hp = -(1 + cosHp);
  const b2Hp = (1 + cosHp) / 2;
  const a0Hp = 1 + alphaHp;
  const a1Hp = -2 * cosHp;
  const a2Hp = 1 - alphaHp;

  const invA0Hp = 1 / a0Hp;
  const nb0Hp = b0Hp * invA0Hp;
  const nb1Hp = b1Hp * invA0Hp;
  const nb2Hp = b2Hp * invA0Hp;
  const na1Hp = a1Hp * invA0Hp;
  const na2Hp = a2Hp * invA0Hp;

  // Pass 1: High-pass
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < len; i++) {
    const x0 = channelData[i];
    const y0 = nb0Hp * x0 + nb1Hp * x1 + nb2Hp * x2 - na1Hp * y1 - na2Hp * y2;
    x2 = x1;
    x1 = x0;
    y2 = y1;
    y1 = y0;
    filtered[i] = y0;
  }

  // Low-Pass Filter Coefficients
  const wLp = (2 * Math.PI * safeHigh) / sampleRate;
  const cosLp = Math.cos(wLp);
  const sinLp = Math.sin(wLp);
  const alphaLp = sinLp / (2 * q);

  const b0Lp = (1 - cosLp) / 2;
  const b1Lp = 1 - cosLp;
  const b2Lp = (1 - cosLp) / 2;
  const a0Lp = 1 + alphaLp;
  const a1Lp = -2 * cosLp;
  const a2Lp = 1 - alphaLp;

  const invA0Lp = 1 / a0Lp;
  const nb0Lp = b0Lp * invA0Lp;
  const nb1Lp = b1Lp * invA0Lp;
  const nb2Lp = b2Lp * invA0Lp;
  const na1Lp = a1Lp * invA0Lp;
  const na2Lp = a2Lp * invA0Lp;

  // Pass 2: Low-pass (in-place on filtered buffer)
  x1 = 0; x2 = 0; y1 = 0; y2 = 0;
  for (let i = 0; i < len; i++) {
    const x0 = filtered[i];
    const y0 = nb0Lp * x0 + nb1Lp * x1 + nb2Lp * x2 - na1Lp * y1 - na2Lp * y2;
    x2 = x1;
    x1 = x0;
    y2 = y1;
    y1 = y0;
    filtered[i] = y0;
  }

  return filtered;
}

/**
 * Computes phonetic weight for a word and analyzes punctuation pauses.
 * Formula: w = consonants + 1.8 * vowels
 * @param {string} text - Raw or formatted word text
 * @returns {Object} { weight: number, pauseType: string, pauseDuration: number, cleanText: string }
 */
export function computePhoneticWeight(text) {
  if (!text || typeof text !== "string") {
    return { weight: 1.0, pauseType: "none", pauseDuration: 0.04, cleanText: "" };
  }

  const raw = text.trim();
  // Strip non-alphanumeric except accented characters
  const clean = raw.replace(/[^\p{L}\p{N}]/gu, "");

  // Vowels in Spanish, English, Portuguese, Polish, French, German, Italian, etc.
  const vowelsMatch = clean.match(/[aeiouyáéíóúüãõàèìòùâêîôûäëïöüąęó]/gi);
  const vowelCount = vowelsMatch ? vowelsMatch.length : 0;
  const totalLetters = clean.length;
  const consonantCount = Math.max(0, totalLetters - vowelCount);

  // Base formula: w = consonants + 1.8 * vowels
  let weight = consonantCount + 1.8 * vowelCount;
  if (weight < 1.0) weight = Math.max(1.0, totalLetters * 1.2 || 1.0);

  // Analyze punctuation for rhythm/breathing pauses
  let pauseType = "none";
  let pauseDuration = 0.04; // Standard spacing between words within a phrase

  if (/[,;—–]/.test(raw) || raw.endsWith("...")) {
    // Minor pause: breathing / comma
    pauseType = "minor";
    pauseDuration = 0.18;
  } else if (/[.!?]$/.test(raw)) {
    // Major pause: sentence end / period / exclamation
    pauseType = "major";
    pauseDuration = 0.38;
  }

  return {
    weight: Number(weight.toFixed(2)),
    pauseType,
    pauseDuration,
    cleanText: clean,
  };
}

/**
 * Detects onset transients and vocal attack times using Logarithmic Spectral Flux / Energy Differentials
 * @param {Float32Array|Array<number>} channelData - PCM audio samples
 * @param {number} [sampleRate=44100] - Sample rate in Hz
 * @param {Object} [options] - Tuning parameters
 * @returns {Array<number>} Timestamps of detected onsets in seconds
 */
export function detectAudioOnsets(channelData, sampleRate = 44100, options = {}) {
  if (!channelData || !channelData.length) return [];

  const frameMs = options.frameMs || 20; // 20ms frame
  const hopMs = options.hopMs || 10;     // 10ms hop
  const frameSize = Math.max(64, Math.floor(sampleRate * (frameMs / 1000)));
  const hopSize = Math.max(32, Math.floor(sampleRate * (hopMs / 1000)));
  const totalFrames = Math.floor((channelData.length - frameSize) / hopSize);

  if (totalFrames <= 0) return [];

  // 1. Calculate RMS energy per frame
  const energies = new Float32Array(totalFrames);
  for (let f = 0; f < totalFrames; f++) {
    const offset = f * hopSize;
    let sumSq = 0;
    for (let i = 0; i < frameSize; i++) {
      const v = channelData[offset + i];
      sumSq += v * v;
    }
    energies[f] = Math.sqrt(sumSq / frameSize);
  }

  // 2. Compute Logarithmic Energy Differentials (Spectral Flux proxy)
  const odf = new Float32Array(totalFrames);
  const eps = 1e-4;
  for (let f = 1; f < totalFrames; f++) {
    const diff = Math.log(energies[f] + eps) - Math.log(energies[f - 1] + eps);
    odf[f] = Math.max(0, diff);
  }

  // 3. Adaptive local thresholding and peak-picking
  const winHalf = 6; // ~60ms local window
  const minEnergy = options.minEnergy || 0.005;
  const sensitivity = options.sensitivity || 1.0;
  const onsets = [];
  let lastOnsetTime = -1;
  const minInterval = 0.07; // Min 70ms between onsets

  for (let f = 1; f < totalFrames - 1; f++) {
    if (energies[f] < minEnergy) continue;

    // Local mean of ODF
    let localSum = 0;
    let localCount = 0;
    const startW = Math.max(0, f - winHalf);
    const endW = Math.min(totalFrames - 1, f + winHalf);
    for (let j = startW; j <= endW; j++) {
      localSum += odf[j];
      localCount++;
    }
    const localMean = localSum / (localCount || 1);
    const threshold = localMean * (1.35 / sensitivity) + 0.02;

    // Peak condition: strictly greater than previous, >= next, and > adaptive threshold
    if (odf[f] > threshold && odf[f] > odf[f - 1] && odf[f] >= odf[f + 1]) {
      const timeSec = (f * hopSize) / sampleRate;
      if (timeSec - lastOnsetTime >= minInterval) {
        onsets.push(Number(timeSec.toFixed(3)));
        lastOnsetTime = timeSec;
      }
    }
  }

  return onsets;
}

/**
 * Identifies active vocal segments using adaptive percentile-based VAD with hysteresis
 * and syllabic rate envelope modulation (2Hz - 8Hz) to differentiate human voice from instrumental intros.
 * @param {Float32Array|Array<number>} channelData - Bandpass-filtered PCM audio samples
 * @param {number} [sampleRate=44100] - Sampling rate in Hz
 * @param {number} [duration=30] - Total duration in seconds
 * @param {Object} [options] - Tuning parameters (e.g. sensitivity, startTime)
 * @returns {Array<Object>} List of vocal segment ranges [{ start: number, end: number }]
 */
export function calculateVocalSegments(channelData, sampleRate = 44100, duration = 30, options = {}) {
  if (!channelData || !channelData.length || duration <= 0) {
    const leadIn = options.startTime !== undefined && options.startTime > 0 ? Number(options.startTime) : Math.min(1.0, duration * 0.05);
    const leadOut = Math.max(0.5, duration * 0.05);
    return [{ start: leadIn, end: Math.max(leadIn + 1, duration - leadOut) }];
  }

  const frameMs = 20; // 20ms frames
  const hopMs = 10;   // 10ms hop
  const frameSize = Math.max(64, Math.floor(sampleRate * (frameMs / 1000)));
  const hopSize = Math.max(32, Math.floor(sampleRate * (hopMs / 1000)));
  const totalFrames = Math.floor((channelData.length - frameSize) / hopSize);

  if (totalFrames <= 0) {
    const s = options.startTime || 0.5;
    return [{ start: s, end: Math.max(s + 1.5, duration - 0.5) }];
  }

  // 1. Compute RMS energy per frame
  const energies = new Float32Array(totalFrames);
  for (let f = 0; f < totalFrames; f++) {
    const offset = f * hopSize;
    let sumSq = 0;
    for (let i = 0; i < frameSize; i++) {
      const val = channelData[offset + i];
      sumSq += val * val;
    }
    energies[f] = Math.sqrt(sumSq / frameSize);
  }

  // 2. Percentile analysis for dynamic range
  const sampleStep = Math.max(1, Math.floor(totalFrames / 3000));
  const sampled = [];
  for (let i = 0; i < totalFrames; i += sampleStep) {
    sampled.push(energies[i]);
  }
  sampled.sort((a, b) => a - b);

  const p15 = sampled[Math.floor(sampled.length * 0.15)] || 0;
  const p85 = sampled[Math.floor(sampled.length * 0.85)] || 0;
  const dynamicRange = Math.max(1e-4, p85 - p15);

  const sensitivity = Math.max(0.2, Math.min(3.0, options.sensitivity || 1.0));
  const tOn = Math.max(0.005, p15 + dynamicRange * (0.18 / sensitivity));
  const tOff = Math.max(0.002, p15 + dynamicRange * (0.08 / sensitivity));

  // 3. Compute Syllabic Envelope Modulation (2Hz - 8Hz) to differentiate voice from instrumental intro
  const modWindow = Math.floor(1000 / hopMs); // ~1.0s window
  const halfMod = Math.floor(modWindow / 2);
  const voiceConfidence = new Float32Array(totalFrames);

  for (let f = 0; f < totalFrames; f++) {
    const startW = Math.max(0, f - halfMod);
    const endW = Math.min(totalFrames - 1, f + halfMod);
    const count = endW - startW + 1;

    let mean = 0;
    for (let i = startW; i <= endW; i++) mean += energies[i];
    mean /= (count || 1);

    let variance = 0;
    let localPeaks = 0;
    for (let i = startW; i <= endW; i++) {
      const diff = energies[i] - mean;
      variance += diff * diff;
      if (i > startW && i < endW && energies[i] > energies[i - 1] && energies[i] >= energies[i + 1] && energies[i] > mean * 1.08) {
        localPeaks++;
      }
    }
    const stdDev = Math.sqrt(variance / (count || 1));
    const cv = stdDev / (mean + 1e-4); // Coefficient of variation (vocal fluctuation)
    const peaksPerSec = (localPeaks / count) * (1000 / hopMs);

    // Human speech/singing has 1.5 - 8.5 syllables/sec and high envelope variation
    const isSyllabic = peaksPerSec >= 1.2 && peaksPerSec <= 9.0;
    const syllabicScore = isSyllabic ? 1.0 : (peaksPerSec > 9.0 ? 0.6 : 0.35);
    const energyScore = energies[f] >= tOn ? 1.0 : (energies[f] >= tOff ? 0.5 : 0.0);

    voiceConfidence[f] = energyScore * Math.min(1.2, cv * 1.6) * syllabicScore;
  }

  // 4. Extract voice segments with hysteresis
  const minSegFrames = Math.floor(0.20 / (hopMs / 1000));     // Min 200ms duration
  const maxSilenceFrames = Math.floor(0.38 / (hopMs / 1000)); // 380ms silence triggers break

  const rawSegments = [];
  let inVoice = false;
  let segStartFrame = 0;
  let silenceFrames = 0;

  for (let f = 0; f < totalFrames; f++) {
    const isVoice = inVoice
      ? (energies[f] >= tOff && (voiceConfidence[f] >= 0.15 || energies[f] >= tOn))
      : (energies[f] >= tOn && voiceConfidence[f] >= 0.25);

    if (isVoice) {
      if (!inVoice) {
        inVoice = true;
        segStartFrame = f;
      }
      silenceFrames = 0;
    } else {
      if (inVoice) {
        silenceFrames++;
        if (silenceFrames > maxSilenceFrames || f === totalFrames - 1) {
          const segEndFrame = f - silenceFrames;
          if (segEndFrame - segStartFrame >= minSegFrames) {
            const startSec = (segStartFrame * hopSize) / sampleRate;
            const endSec = (segEndFrame * hopSize) / sampleRate;
            rawSegments.push({
              start: Math.max(0, Number(startSec.toFixed(2))),
              end: Math.min(duration, Number(endSec.toFixed(2))),
            });
          }
          inVoice = false;
          silenceFrames = 0;
        }
      }
    }
  }

  if (inVoice && totalFrames - segStartFrame >= minSegFrames) {
    rawSegments.push({
      start: Math.max(0, Number(((segStartFrame * hopSize) / sampleRate).toFixed(2))),
      end: Math.min(duration, Number(((totalFrames * hopSize) / sampleRate).toFixed(2))),
    });
  }

  // Fallback: If no high-confidence segment was found, locate first prominent energy onset
  if (!rawSegments.length) {
    let firstBurst = 0;
    for (let f = 0; f < totalFrames; f++) {
      if (energies[f] >= tOn) {
        firstBurst = (f * hopSize) / sampleRate;
        break;
      }
    }
    const start = Math.max(0.5, firstBurst);
    rawSegments.push({ start, end: Math.max(start + 2, duration - 0.5) });
  }

  // Merge segments with short breath gaps (< 280ms)
  const mergedSegments = [rawSegments[0]];
  for (let i = 1; i < rawSegments.length; i++) {
    const prev = mergedSegments[mergedSegments.length - 1];
    const curr = rawSegments[i];
    if (curr.start - prev.end <= 0.28) {
      prev.end = Math.max(prev.end, curr.end);
    } else {
      mergedSegments.push(curr);
    }
  }

  // 5. Apply explicit startTime anchor if requested (e.g. user set start / playhead time)
  if (options.startTime !== undefined && options.startTime > 0) {
    const minStart = Number(options.startTime);
    const filtered = mergedSegments.filter((s) => s.end > minStart);
    if (filtered.length) {
      if (filtered[0].start < minStart) filtered[0].start = minStart;
      return filtered;
    }
    return [{ start: minStart, end: Math.max(minStart + 2, duration - 0.5) }];
  }

  return mergedSegments;
}

/**
 * Automatically calculates and aligns word timestamps with the audio waveform / voice activity.
 * Incorporates 300Hz-3400Hz vocal bandpass filtering, spectral flux onset detection,
 * percentile-based VAD hysteresis, phonetic syllabic weighting, punctuation pauses, and lead-in pre-roll.
 * @param {Array<Object>} words - Array of word objects from splitLyricsIntoWords
 * @param {AudioBuffer|Object} audioData - Web Audio API AudioBuffer or object with { channelData, sampleRate, duration }
 * @param {Object} [options] - Custom tuning parameters
 * @returns {Array<Object>} Updated words array with populated start and end timestamps
 */
export function autoAlignLyricsWithAudio(words, audioData = {}, options = {}) {
  if (!words || !words.length) return [];
  const duration = Number(audioData.duration) || 30;
  if (duration <= 0) return words;

  const leadInOffset = options.leadInOffset !== undefined ? Number(options.leadInOffset) : 0.12;
  const snapToOnsets = options.snapToOnsets !== false;
  const lowCut = options.lowCut || 300;
  const highCut = options.highCut || 3400;

  // 1. Extract and filter PCM channel
  let channel = null;
  let sampleRate = 44100;
  if (audioData.getChannelData) {
    try {
      channel = audioData.getChannelData(0);
      sampleRate = audioData.sampleRate || 44100;
    } catch {}
  } else if (audioData.channelData && audioData.channelData instanceof Float32Array) {
    channel = audioData.channelData;
    sampleRate = audioData.sampleRate || 44100;
  }

  let vocalSegments = [];
  let detectedOnsets = [];

  if (channel && channel.length > 0) {
    const filteredPCM = applyVocalBandpassFilter(channel, sampleRate, lowCut, highCut);
    vocalSegments = calculateVocalSegments(filteredPCM, sampleRate, duration, options);
    detectedOnsets = detectAudioOnsets(filteredPCM, sampleRate, options);
  } else {
    const leadIn = Math.min(1.0, duration * 0.05);
    const leadOut = Math.max(0.5, duration * 0.05);
    vocalSegments = [{ start: leadIn, end: Math.max(leadIn + 1, duration - leadOut) }];
  }

  // 2. Group words by block / phrase
  const blocksMap = new Map();
  words.forEach((w) => {
    const bIdx = w.blockIndex !== undefined ? w.blockIndex : 0;
    if (!blocksMap.has(bIdx)) blocksMap.set(bIdx, []);
    blocksMap.get(bIdx).push(w);
  });

  const blockGroups = Array.from(blocksMap.values());
  if (!blockGroups.length) return words;

  // 3. Compute phonetic weights and punctuation pauses for each word and block
  const blockPhonetics = blockGroups.map((group) => {
    const wordInfos = group.map((w) => computePhoneticWeight(w.text));
    const totalWeight = wordInfos.reduce((sum, item) => sum + item.weight, 0);
    const totalPause = wordInfos.reduce((sum, item) => sum + item.pauseDuration, 0);
    return {
      wordInfos,
      totalWeight: Math.max(1.0, totalWeight),
      totalPause,
      combinedWeight: totalWeight + totalPause * 3.0,
    };
  });

  const totalActiveDuration = vocalSegments.reduce((sum, seg) => sum + (seg.end - seg.start), 0);
  const sumCombinedWeights = blockPhonetics.reduce((sum, b) => sum + b.combinedWeight, 0) || 1;

  // 4. Distribute blocks across vocal segments
  let currentSegIdx = 0;
  let currentSegOffset = vocalSegments[0].start;

  blockGroups.forEach((group, bIdx) => {
    const bInfo = blockPhonetics[bIdx];
    const targetBlockDuration = Math.max(
      0.6,
      (bInfo.combinedWeight / sumCombinedWeights) * totalActiveDuration
    );

    let seg = vocalSegments[currentSegIdx] || vocalSegments[vocalSegments.length - 1];

    let bStart = currentSegOffset;
    let bEnd = bStart + targetBlockDuration;

    // Advance to next vocal segment if overflowing current segment and more segments exist
    if (bEnd > seg.end + 0.2 && currentSegIdx < vocalSegments.length - 1) {
      currentSegIdx++;
      seg = vocalSegments[currentSegIdx];
      bStart = seg.start;
      bEnd = bStart + targetBlockDuration;
    }

    // Determine pause after this block (larger if last word has major punctuation)
    const lastWordInfo = bInfo.wordInfos[bInfo.wordInfos.length - 1];
    const postBlockPause = lastWordInfo?.pauseType === "major" ? 0.35 : 0.15;
    currentSegOffset = bEnd + postBlockPause;

    // Distribute individual words inside block span
    const blockSpan = Math.max(0.4, bEnd - bStart);
    const sumWordWeights = bInfo.totalWeight;

    let wCursor = bStart;

    group.forEach((w, wIdx) => {
      const wInfo = bInfo.wordInfos[wIdx];
      const wDuration = Math.max(0.12, (wInfo.weight / sumWordWeights) * (blockSpan - bInfo.totalPause * 0.3));

      let calculatedStart = wCursor;
      let calculatedEnd = calculatedStart + wDuration;

      // Snap word start to nearest detected onset transient if within +/- 150ms window
      if (snapToOnsets && detectedOnsets.length > 0) {
        let bestOnset = null;
        let bestDiff = 0.15; // 150ms snap tolerance

        for (const onset of detectedOnsets) {
          const diff = Math.abs(onset - calculatedStart);
          if (diff < bestDiff) {
            bestDiff = diff;
            bestOnset = onset;
          }
        }

        if (bestOnset !== null) {
          calculatedStart = bestOnset;
          calculatedEnd = calculatedStart + wDuration;
        }
      }

      // Apply Lead-in latency compensation (so highlight coincides with perceived audio attack)
      const adjustedStart = Math.max(0, calculatedStart - leadInOffset);
      const adjustedEnd = Math.max(adjustedStart + 0.10, calculatedEnd - (leadInOffset * 0.5));

      w.start = Number(adjustedStart.toFixed(2));
      w.end = Number(Math.min(duration, Math.max(w.start + 0.10, adjustedEnd)).toFixed(2));

      // Advance cursor for next word, adding word-level punctuation pause
      wCursor = calculatedEnd + (wInfo.pauseDuration || 0.04);
    });

    // Post-pass on group to guarantee strict monotonicity: w[i].end <= w[i+1].start or clean abutting
    for (let i = 0; i < group.length - 1; i++) {
      const curr = group[i];
      const next = group[i + 1];
      if (curr.end > next.start) {
        curr.end = Number(Math.max(curr.start + 0.08, next.start).toFixed(2));
      }
    }
  });

  return words;
}

/**
 * Shifts all synced word timestamps by a given offset in seconds
 * @param {Array<Object>} words
 * @param {number} offsetSeconds
 */
export function shiftTimestamps(words, offsetSeconds) {
  if (!words || !words.length || !offsetSeconds) return;
  words.forEach((w) => {
    if (w.start !== null) {
      w.start = Math.max(0, Number((w.start + offsetSeconds).toFixed(2)));
    }
    if (w.end !== null) {
      w.end = Math.max(w.start + 0.05, Number((w.end + offsetSeconds).toFixed(2)));
    }
  });
}

/**
 * Draws dynamic styled subtitles directly onto an HTML5 2D canvas frame
 * Compatible with MediaRecorder and Canvas export pipelines
 */
export function drawKaraokeSubtitlesOnCanvas(ctx, width, height, currentTime, words, style = {}) {
  if (!ctx || !words || !words.length) return;
  const cfg = { ...SUBTITLE_PRESETS.tiktok, ...style };

  const syncedWords = words.filter((w) => w.start !== null && w.end !== null);
  if (!syncedWords.length) return;

  // Find active word or block
  let activeWord = syncedWords.find((w) => currentTime >= w.start && currentTime <= w.end);
  let activeBlockIndex = activeWord ? activeWord.blockIndex : null;

  if (activeBlockIndex === null) {
    const blocks = groupWordsByBlock(syncedWords);
    for (const block of blocks) {
      if (!block.length) continue;
      const bMin = Math.min(...block.map((w) => w.start));
      const bMax = Math.max(...block.map((w) => w.end));
      if (currentTime >= bMin && currentTime <= bMax + 0.3) {
        activeBlockIndex = block[0].blockIndex;
        break;
      }
    }
  }

  if (activeBlockIndex === null) return;

  const blockWords = syncedWords.filter((w) => w.blockIndex === activeBlockIndex);
  if (!blockWords.length) return;

  // Resolution scaling (base 1280x720)
  const scaleFactor = Math.min(width / 1280, height / 720);
  const fontSize = Math.round((cfg.fontSize || 48) * scaleFactor);
  const strokeWidth = Math.round((cfg.strokeWidth || 4) * scaleFactor);
  const fontFamily = cfg.fontFamily || "Montserrat, sans-serif";

  ctx.save();
  ctx.font = `900 ${fontSize}px ${fontFamily}`;
  ctx.textBaseline = "middle";

  const wordMetrics = blockWords.map((w) => {
    const text = cfg.uppercase ? w.text.toUpperCase() : w.text;
    const m = ctx.measureText(text);
    return {
      word: w,
      text,
      width: m.width,
    };
  });

  const spaceWidth = ctx.measureText(" ").width;
  const totalWidth = wordMetrics.reduce((sum, item) => sum + item.width, 0) + (wordMetrics.length - 1) * spaceWidth;

  // Vertical position
  let centerY = height * 0.82; // bottom
  if (cfg.position === "middle" || cfg.position === "center") {
    centerY = height * 0.5;
  } else if (cfg.position === "top") {
    centerY = height * 0.18;
  }

  // Draw semi-transparent background capsule for high contrast
  const padX = 24 * scaleFactor;
  const padY = 16 * scaleFactor;
  const boxX = (width - totalWidth) / 2 - padX;
  const boxY = centerY - (fontSize / 2) - padY;
  const boxW = totalWidth + (padX * 2);
  const boxH = fontSize + (padY * 2);

  ctx.fillStyle = "rgba(4, 12, 6, 0.65)";
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(boxX, boxY, boxW, boxH, 12 * scaleFactor);
  } else {
    ctx.rect(boxX, boxY, boxW, boxH);
  }
  ctx.fill();
  ctx.strokeStyle = "rgba(110, 200, 50, 0.25)";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Draw words
  let cursorX = (width - totalWidth) / 2;

  wordMetrics.forEach(({ word, text, width: wWidth }) => {
    const isActive = activeWord && activeWord.id === word.id;
    const isPassed = word.end !== null && currentTime > word.end;

    ctx.save();

    let fillColor = cfg.primaryColor || "#FFFFFF";
    let glowEffect = false;
    let wordScale = 1.0;

    if (isActive) {
      fillColor = cfg.activeColor || "#FFE600";
      glowEffect = true;
      wordScale = 1.14; // Pop jump effect
    } else if (isPassed) {
      fillColor = cfg.activeColor || "#FFE600";
      ctx.globalAlpha = 0.9;
    } else {
      fillColor = cfg.primaryColor || "#FFFFFF";
      ctx.globalAlpha = 0.75;
    }

    const wordCenterX = cursorX + (wWidth / 2);
    const wordCenterY = centerY;

    ctx.translate(wordCenterX, wordCenterY);
    if (wordScale !== 1.0) {
      ctx.scale(wordScale, wordScale);
    }

    // Shadow & Glow
    if (glowEffect && (cfg.glow || cfg.activeColor)) {
      ctx.shadowColor = cfg.activeColor || "#FFE600";
      ctx.shadowBlur = 18 * scaleFactor;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
    } else if (cfg.shadowDistance > 0) {
      ctx.shadowColor = cfg.shadowColor || "rgba(0,0,0,0.8)";
      ctx.shadowBlur = 8 * scaleFactor;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = (cfg.shadowDistance || 3) * scaleFactor;
    }

    // Stroke
    if (strokeWidth > 0 && cfg.strokeColor && cfg.strokeColor !== "transparent") {
      ctx.strokeStyle = cfg.strokeColor || "#000000";
      ctx.lineWidth = strokeWidth * 2;
      ctx.lineJoin = "round";
      ctx.strokeText(text, -wWidth / 2, 0);
    }

    // Fill
    ctx.fillStyle = fillColor;
    ctx.fillText(text, -wWidth / 2, 0);

    ctx.restore();

    cursorX += wWidth + spaceWidth;
  });

  ctx.restore();
}

/**
 * Draws animated neon circuit equalizer visualizer on 2D canvas for audio tracks
 */
export function drawAudioVisualizerBackground(ctx, width, height, currentTime) {
  if (!ctx) return;

  // Background gradient
  const bgGrad = ctx.createRadialGradient(width / 2, height / 2, 20, width / 2, height / 2, width / 1.5);
  bgGrad.addColorStop(0, "#0a2615");
  bgGrad.addColorStop(0.6, "#040f08");
  bgGrad.addColorStop(1, "#020603");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  const midY = height * 0.45;
  const bars = 44;
  const barWidth = (width * 0.75) / bars;
  const startX = (width - (bars * barWidth)) / 2;

  // Circuit ring
  ctx.strokeStyle = "rgba(110, 200, 50, 0.3)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(width / 2, midY, 140 + Math.sin(currentTime * 6) * 12, 0, Math.PI * 2);
  ctx.stroke();

  // Equalizer spectrum bars
  for (let i = 0; i < bars; i++) {
    const wave = Math.sin(currentTime * 7 + i * 0.45) * Math.cos(currentTime * 4.5 - i * 0.25) * 0.65 + 0.35;
    const barHeight = Math.max(8, Math.abs(wave) * 120);
    const x = startX + i * barWidth;

    const grad = ctx.createLinearGradient(0, midY - barHeight, 0, midY + barHeight);
    grad.addColorStop(0, "#6EC832");
    grad.addColorStop(0.5, "#FFE600");
    grad.addColorStop(1, "#6EC832");

    ctx.fillStyle = grad;
    ctx.beginPath();
    if (typeof ctx.roundRect === "function") {
      ctx.roundRect(x + 2, midY - barHeight, barWidth - 4, barHeight * 2, 4);
    } else {
      ctx.rect(x + 2, midY - barHeight, barWidth - 4, barHeight * 2);
    }
    ctx.fill();
  }
}
