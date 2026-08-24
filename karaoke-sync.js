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
 * Counts vowel count in a word for phonetic duration weighting
 */
function countVowels(text) {
  const matches = String(text).match(/[aeiouáéíóúüãõy]/gi);
  return matches ? matches.length : 1;
}

/**
 * Automatically calculates and aligns word timestamps with the audio waveform / voice activity
 * @param {Array<Object>} words - Array of word objects from splitLyricsIntoWords
 * @param {AudioBuffer|Object} audioData - Web Audio API AudioBuffer or object with { channelData, sampleRate, duration }
 * @param {Object} options - Custom tuning parameters
 * @returns {Array<Object>} Updated words array with populated start and end timestamps
 */
export function autoAlignLyricsWithAudio(words, audioData = {}, options = {}) {
  if (!words || !words.length) return [];
  const duration = Number(audioData.duration) || 30;
  if (duration <= 0) return words;

  let vocalSegments = [];

  // 1. Analyze waveform if channel data is available
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

  if (channel && channel.length > 0) {
    const frameSize = Math.max(256, Math.floor(sampleRate * 0.04)); // 40ms frame
    const totalFrames = Math.floor(channel.length / frameSize);
    const energies = new Float32Array(totalFrames);

    let maxEnergy = 0;
    let avgEnergy = 0;

    for (let f = 0; f < totalFrames; f++) {
      let sumSq = 0;
      const offset = f * frameSize;
      for (let i = 0; i < frameSize; i++) {
        const val = channel[offset + i];
        sumSq += val * val;
      }
      const rms = Math.sqrt(sumSq / frameSize);
      energies[f] = rms;
      if (rms > maxEnergy) maxEnergy = rms;
      avgEnergy += rms;
    }
    avgEnergy /= (totalFrames || 1);

    // Adaptive threshold for vocal presence
    const threshold = Math.max(0.008, avgEnergy * 0.85);

    let inVocal = false;
    let segStart = 0;
    const minSegFrames = Math.floor(0.25 / 0.04);
    const maxSilenceFrames = Math.floor(0.40 / 0.04);
    let silenceCount = 0;

    for (let f = 0; f < totalFrames; f++) {
      const isVoice = energies[f] >= threshold;
      const timeSec = (f * frameSize) / sampleRate;

      if (isVoice) {
        if (!inVocal) {
          inVocal = true;
          segStart = timeSec;
        }
        silenceCount = 0;
      } else {
        if (inVocal) {
          silenceCount++;
          if (silenceCount > maxSilenceFrames || f === totalFrames - 1) {
            const segEnd = timeSec - (silenceCount * 0.04);
            if (segEnd - segStart >= 0.2) {
              vocalSegments.push({ start: Math.max(0, segStart), end: Math.min(duration, segEnd) });
            }
            inVocal = false;
            silenceCount = 0;
          }
        }
      }
    }
  }

  // Fallback: If no distinct voice segments were found, create a uniform span
  if (!vocalSegments.length) {
    const leadIn = Math.min(1.0, duration * 0.05);
    const leadOut = Math.max(0.5, duration * 0.05);
    vocalSegments = [{ start: leadIn, end: Math.max(leadIn + 1, duration - leadOut) }];
  }

  // 2. Group words by line or block for natural phrasing
  const blocksMap = new Map();
  words.forEach((w) => {
    const bIdx = w.blockIndex !== undefined ? w.blockIndex : 0;
    if (!blocksMap.has(bIdx)) blocksMap.set(bIdx, []);
    blocksMap.get(bIdx).push(w);
  });

  const blockGroups = Array.from(blocksMap.values());

  // 3. Map word blocks across vocal segments
  const totalActiveDuration = vocalSegments.reduce((sum, seg) => sum + (seg.end - seg.start), 0);

  // Compute weight for each block based on total syllables/characters
  const blockWeights = blockGroups.map((group) => {
    return group.reduce((sum, w) => {
      const len = (w.text || "").length;
      const vowels = countVowels(w.text);
      return sum + len + vowels * 1.5;
    }, 0);
  });

  const sumBlockWeights = blockWeights.reduce((a, b) => a + b, 0) || 1;

  let currentSegIdx = 0;
  let currentSegOffset = vocalSegments[0].start;

  blockGroups.forEach((group, bIdx) => {
    const bWeight = blockWeights[bIdx];
    const blockDuration = Math.max(0.6, (bWeight / sumBlockWeights) * totalActiveDuration);

    let seg = vocalSegments[currentSegIdx];
    if (!seg) {
      seg = vocalSegments[vocalSegments.length - 1];
    }

    let bStart = currentSegOffset;
    let bEnd = bStart + blockDuration;

    // Advance to next segment if overflowing
    if (bEnd > seg.end && currentSegIdx < vocalSegments.length - 1) {
      currentSegIdx++;
      seg = vocalSegments[currentSegIdx];
      bStart = seg.start;
      bEnd = bStart + blockDuration;
    }

    currentSegOffset = bEnd + 0.15; // Small pause between blocks

    // Distribute individual words inside block
    const wordWeights = group.map((w) => (w.text || "").length + countVowels(w.text) * 1.5);
    const sumWordWeights = wordWeights.reduce((a, b) => a + b, 0) || 1;
    const blockSpan = Math.max(0.4, bEnd - bStart);

    let wCursor = bStart;
    group.forEach((w, wIdx) => {
      const wDur = Math.max(0.12, (wordWeights[wIdx] / sumWordWeights) * blockSpan);
      w.start = Number(wCursor.toFixed(2));
      w.end = Number((wCursor + wDur).toFixed(2));
      wCursor += wDur;
    });
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
