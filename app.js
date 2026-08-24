import { FFmpeg } from "./vendor/ffmpeg/ffmpeg/index.js";
import { fetchFile } from "./vendor/ffmpeg/util/index.js";
import {
  formatBytes,
  formatDuration,
  getCropFilter,
  getFileExtension,
  getTrimDurationArgs,
  getTrimInputArgs,
  parseTimeValue,
  safeBaseName,
} from "./converter-utils.js";
import { translations } from "./translations.js";
import {
  SUBTITLE_PRESETS,
  splitLyricsIntoWords,
  exportAss,
  exportSrt,
  exportLrc,
  parseLrc,
  parseSrt,
  KaraokeSyncEngine,
} from "./karaoke-sync.js";

const $ = (selector) => document.querySelector(selector);
const form = $("#converter-form");
const fileInput = $("#video-file");
const dropZone = $("#drop-zone");
const dropTitle = $("#drop-title");
const dropHint = $("#drop-hint");
const fileCard = $("#file-card");
const fileName = $("#file-name");
const fileSize = $("#file-size");
const fileList = $("#file-list");
const clearFilesButton = $("#clear-files");
const convertButton = $("#convert-button");
const cancelButton = $("#cancel-button");
const previewPanel = $("#preview-panel");
const previewTitle = $("#preview-title");
const previewMeta = $("#preview-meta");
const videoPreview = $("#video-preview");
const progressBar = $("#progress-bar");
const statusMessage = $("#status-message");
const errorMessage = $("#error-message");
const audioSettings = $("#audio-settings");
const mp4Settings = $("#mp4-settings");
const mp4Note = $("#mp4-note");
const gifSettings = $("#gif-settings");
const gifNote = $("#gif-note");
const videoQuality = $("#video-quality");
const videoResolution = $("#video-resolution");
const gifWidth = $("#gif-width");
const gifFps = $("#gif-fps");
const trimStart = $("#trim-start");
const trimEnd = $("#trim-end");
const resultsPanel = $("#results-panel");
const resultsList = $("#results-list");
const resultsSummary = $("#results-summary");
const downloadAllButton = $("#download-all");
const resetDefaultsButton = $("#reset-defaults");
const modeInputs = document.querySelectorAll('input[name="mode"]');
const preferenceInputs = document.querySelectorAll('input[name="mode"], input[name="format"], input[name="bitrate"], input[name="gif-output"], input[name="loudness-normalize"], #video-quality, #video-resolution, #gif-width, #gif-fps, #video-speed, #gif-speed, #mp4-audio-track, #mp4-color-filter, #karaoke-font-family, #karaoke-font-size, #karaoke-primary-color, #karaoke-active-color, #karaoke-position, #karaoke-uppercase');

const cropContainer = $("#crop-container");
const cropOverlay = $("#crop-overlay");
const cropBox = $("#crop-box");
const cropDimensions = $("#crop-dimensions");
const cropActions = $("#crop-actions");
const cropSelectButton = $("#crop-select-button");
const cropResetButton = $("#crop-reset-button");
const cropShadeTop = $("#crop-shade-top");
const cropShadeLeft = $("#crop-shade-left");
const cropShadeRight = $("#crop-shade-right");
const cropShadeBottom = $("#crop-shade-bottom");

const frameNav = $("#frame-nav");
const framePrev = $("#frame-prev");
const frameNext = $("#frame-next");
const timelineCanvas = $("#timeline-canvas");
const waveformCanvas = $("#waveform-canvas");
const timelineCtx = timelineCanvas.getContext("2d");
const waveformCtx = waveformCanvas.getContext("2d");

// Sprints DOM refs
const saveFrameBar = $("#save-frame-bar");
const saveFrameButton = $("#save-frame-button");
const presetsList = $("#presets-list");
const savePresetButton = $("#save-preset-button");
const savePresetInline = $("#save-preset-inline");
const presetNameInput = $("#preset-name-input");
const presetConfirm = $("#preset-confirm");
const presetCancel = $("#preset-cancel");
const loudnessNormalize = $("#loudness-normalize");
const videoSpeed = $("#video-speed");
const gifSpeed = $("#gif-speed");
const shareConfigButton = $("#share-config-button");
const mp4AudioTrack = $("#mp4-audio-track");
const mp4ColorFilter = $("#mp4-color-filter");

const subtitlesInput = $("#subtitles-file");
const subtitlesStatus = $("#subtitles-status");
const subtitlesName = $("#subtitles-name");
const subtitlesRemove = $("#subtitles-remove");

const externalAudioInput = $("#external-audio-file");
const externalAudioStatus = $("#external-audio-status");
const externalAudioName = $("#external-audio-name");
const externalAudioRemove = $("#external-audio-remove");

const historyToggle = $("#history-toggle");
const historyModal = $("#history-modal");
const historyBackdrop = $("#history-backdrop");
const historyClose = $("#history-close");
const historyClear = $("#history-clear");
const historyList = $("#history-list");
const historyStatsSubtitle = $("#history-stats-subtitle");
const historyBadge = $("#history-badge");

const languageSelect = $("#language-select");
const guideToggle = $("#guide-toggle");
const guideModal = $("#guide-modal");
const guideBackdrop = $("#guide-backdrop");
const guideClose = $("#guide-close");
const guideCloseBtn = $("#guide-close-btn");
const guideTabs = document.querySelectorAll(".guide-tab-button");
const guidePanes = document.querySelectorAll(".guide-pane");

// Karaoke & Dynamic Subtitles DOM refs
const karaokeSettings = $("#karaoke-settings");
const karaokeNote = $("#karaoke-note");
const karaokeTabPaste = $("#karaoke-tab-paste");
const karaokeTabImport = $("#karaoke-tab-import");
const karaokePanelPaste = $("#karaoke-panel-paste");
const karaokePanelImport = $("#karaoke-panel-import");
const karaokeLyricsInput = $("#karaoke-lyrics-input");
const karaokeWordsPerBlock = $("#karaoke-words-per-block");
const karaokePrepareBtn = $("#karaoke-prepare-btn");
const karaokeFileInput = $("#karaoke-file-input");
const karaokeWordsQueue = $("#karaoke-words-queue");
const karaokeTapBtn = $("#karaoke-tap-btn");
const karaokeUndoBtn = $("#karaoke-undo-btn");
const karaokeResetBtn = $("#karaoke-reset-btn");
const karaokeSyncCounter = $("#karaoke-sync-counter");
const karaokePresetCards = document.querySelectorAll(".karaoke-preset-card");
const karaokeFontFamily = $("#karaoke-font-family");
const karaokeFontSize = $("#karaoke-font-size");
const karaokePrimaryColor = $("#karaoke-primary-color");
const karaokeActiveColor = $("#karaoke-active-color");
const karaokePosition = $("#karaoke-position");
const karaokeUppercase = $("#karaoke-uppercase");
const karaokeDlLrc = $("#karaoke-dl-lrc");
const karaokeDlSrt = $("#karaoke-dl-srt");
const karaokeDlAss = $("#karaoke-dl-ass");
const dynamicSubtitleOverlay = $("#dynamic-subtitle-overlay");
const dynamicSubtitleBox = $("#dynamic-subtitle-box");

const LANG_KEY = "beetales-lang-v1";
let currentLang = localStorage.getItem(LANG_KEY) || "en";

let selectedSubtitlesFile = null;
let selectedExternalAudioFile = null;

const FRAME_STEP = 1 / 30;
const TIMELINE_THUMBNAILS = 12;
let thumbnailImages = [];
let timelineReady = false;
let audioContext = null;
let audioBuffer = null;
let waveformReady = false;

const ffmpeg = new FFmpeg();
let ffmpegReady = false;
let ffmpegLoadPromise = null;
let selectedFiles = [];
let resultUrls = [];
let activeFileIndex = 0;
let previewUrl = null;
let cancelRequested = false;
let completedResults = [];
let conversionInProgress = false;
const fileMetadata = new Map();
const fileStates = new Map();

let cropActive = false;
let cropDragging = false;
let cropResizing = false;
let cropResizeHandle = null;
let cropStartX = 0;
let cropStartY = 0;
let cropStartRect = null;
let cropRect = null;
let cachedNaturalCrop = null;

let trimOverlayActive = false;
let trimOverlayDragging = false;
let trimOverlayResizing = false;
let trimOverlayHandle = null;
let trimOverlayDragStartX = 0;
let trimOverlayDragStartRange = null;
let cachedAccentColor = "#91bd59";
let decodeAbortController = null;
let thumbnailAbortToken = 0;

// Karaoke Sync Engine Instance
const karaokeEngine = new KaraokeSyncEngine();
let activePresetId = "tiktok";

const FFMPEG_LOAD_TIMEOUT_MS = 60000;
const PREFERENCES_KEY = "beetales-converter-preferences-v1";
const ffmpegCoreURL = localAssetURL("./vendor/ffmpeg/core/ffmpeg-core.js");
const ffmpegWasmURL = localAssetURL("./vendor/ffmpeg/core/ffmpeg-core.wasm");
const outputMimeTypes = {
  mp3: "audio/mpeg",
  wav: "audio/wav",
  aac: "audio/aac",
  mp4: "video/mp4",
  gif: "image/gif",
  webp: "image/webp",
};
const audioOutputArgs = {
  mp3: ["-vn", "-map", "0:a:0", "-codec:a", "libmp3lame", "-f", "mp3"],
  wav: ["-vn", "-map", "0:a:0", "-codec:a", "pcm_s16le", "-f", "wav"],
  aac: ["-vn", "-map", "0:a:0", "-codec:a", "aac", "-f", "adts"],
};
const modeContent = {
  audio: {
    button: "Convert queue to audio",
    busy: "Extracting audio...",
    ready: "video(s) ready for audio extraction.",
    empty: "Choose one or more videos to get started.",
    dropTitle: "Select one or more video files",
    dropHint: "You can also drag and drop them here",
    accept: "video/*,.webm",
    download: "Download audio",
  },
  mp4: {
    button: "Convert queue to MP4",
    busy: "Converting to MP4...",
    ready: "video(s) ready for MP4 conversion or optimization.",
    empty: "Choose one or more WebM or MP4 videos to get started.",
    dropTitle: "Select WebM or MP4 videos",
    dropHint: "Drop .webm or .mp4 files here or choose them from your device",
    accept: "video/webm,video/mp4,.webm,.mp4",
    download: "Download MP4",
  },
  gif: {
    button: "Convert queue to GIF",
    busy: "Creating GIF...",
    ready: "video(s) ready for GIF creation.",
    empty: "Choose one or more videos to create GIF clips.",
    dropTitle: "Select videos for GIF",
    dropHint: "Choose a short clip with Trim for the best result",
    accept: "video/*,.webm,.mp4",
    download: "Download GIF",
  },
  karaoke: {
    button: "Burn & Export MP4",
    busy: "Generating subtitled video...",
    ready: "video(s) ready for subtitle creation & burning.",
    empty: "Select video or audio to start Karaoke & Subtitles.",
    dropTitle: "Select video or audio for Karaoke / Subtitles",
    dropHint: "Upload your video or song, then paste lyrics below to sync",
    accept: "video/*,audio/*,.webm,.mp4,.mp3,.wav,.m4a,.ogg",
    download: "Download Subtitled MP4",
  },
};

ffmpeg.on("progress", ({ progress }) => {
  if (!Number.isFinite(progress) || !selectedFiles.length) return;
  const filePercent = Math.min(100, Math.max(0, Math.round(progress * 100)));
  const globalPercent = Math.round(((activeFileIndex + filePercent / 100) / selectedFiles.length) * 100);
  setProgress(globalPercent);
  setStatus(`File ${activeFileIndex + 1} of ${selectedFiles.length} · ${filePercent}%`);
});

fileInput.addEventListener("change", () => handleFiles(fileInput.files));
modeInputs.forEach((input) => input.addEventListener("change", () => updateModeUI({ resetFiles: true })));
preferenceInputs.forEach((input) => input.addEventListener("change", savePreferences));
dropZone.addEventListener("dragover", (event) => {
  event.preventDefault();
  if (!conversionInProgress) dropZone.classList.add("is-dragging");
});
dropZone.addEventListener("dragleave", () => dropZone.classList.remove("is-dragging"));
dropZone.addEventListener("drop", (event) => {
  event.preventDefault();
  dropZone.classList.remove("is-dragging");
  if (conversionInProgress) return;
  handleFiles(event.dataTransfer.files);
});
clearFilesButton.addEventListener("click", clearSelection);
cancelButton.addEventListener("click", cancelConversion);
downloadAllButton.addEventListener("click", downloadAllResults);
resetDefaultsButton.addEventListener("click", restoreAllDefaults);
form.addEventListener("submit", async (event) => { event.preventDefault(); await convertQueue(); });
window.addEventListener("beforeunload", () => { resetResults(); resetPreview(); });
cropSelectButton.addEventListener("click", activateCrop);
cropResetButton.addEventListener("click", resetCrop);
framePrev.addEventListener("click", () => stepFrame(-1));
frameNext.addEventListener("click", () => stepFrame(1));
timelineCanvas.addEventListener("mousedown", handleTimelineMouseDown);
timelineCanvas.addEventListener("mousemove", handleTimelineHover);
timelineCanvas.addEventListener("mouseleave", handleTimelineHoverEnd);
trimStart.addEventListener("input", handleTrimInputChange);
trimEnd.addEventListener("input", handleTrimInputChange);

videoPreview.addEventListener("timeupdate", () => {
  if (timelineReady) drawTimeline();
  if (waveformReady) drawWaveform();
  if (getMode() === "karaoke") updateSubtitleOverlay();
});

videoPreview.addEventListener("seeked", () => {
  if (getMode() === "karaoke") updateSubtitleOverlay();
});

// Initialize sub-modules
initKaraokeStudio();
restorePreferences();
applyUrlParams();
setLanguage(currentLang);
updateModeUI({ resetFiles: false });
renderPresets();
updateHistoryBadge();

async function handleFiles(fileCollection) {
  if (conversionInProgress) return;
  clearError();
  resetResults();
  setProgress(0);
  const mode = getMode();
  const incoming = Array.from(fileCollection || []);
  const validFiles = incoming.filter((file) => isValidFileForMode(file, mode));
  const rejected = incoming.length - validFiles.length;
  selectedFiles = validFiles;
  fileMetadata.clear();
  fileStates.clear();
  selectedFiles.forEach((file) => fileStates.set(file, "Loading details..."));
  fileInput.value = "";
  renderQueue();

  if (!selectedFiles.length) {
    if (incoming.length) showError(getValidationMessage(mode));
    setStatus(modeContent[mode].empty);
    return;
  }
  if (rejected) showError(`${rejected} incompatible file${rejected === 1 ? " was" : "s were"} left out of the queue.`);
  setStatus(`${selectedFiles.length} ${modeContent[mode].ready}`);
  showPreview(selectedFiles[0]);
  if (mode === "gif") cropActions.classList.remove("is-hidden");
  await Promise.all(selectedFiles.map(loadMediaMetadata));
  renderQueue();
  updatePreviewMetadata(selectedFiles[0]);
  const currentMode = getMode();
  initPreviewTools(currentMode);
  thumbnailImages = [];
  timelineReady = false;
  waveformReady = false;
  if (audioContext) { try { audioContext.close(); } catch {} audioContext = null; }
  audioBuffer = null;
  if (currentMode === "gif" && selectedFiles[0]) generateThumbnails(selectedFiles[0]);
  if ((currentMode === "audio" || currentMode === "karaoke") && selectedFiles[0]) decodeAudio(selectedFiles[0]).catch(() => {});
}

let draggedIndex = null;

function renderQueue() {
  fileList.replaceChildren();
  fileCard.classList.toggle("is-hidden", selectedFiles.length === 0);
  if (!selectedFiles.length) return;
  fileName.textContent = `${selectedFiles.length} file${selectedFiles.length === 1 ? "" : "s"} selected`;
  fileSize.textContent = `${formatBytes(selectedFiles.reduce((total, file) => total + file.size, 0))} total`;
  selectedFiles.forEach((file, index) => {
    const item = document.createElement("li");
    item.draggable = !conversionInProgress;
    item.dataset.index = String(index);

    const handle = document.createElement("span");
    handle.className = "drag-handle";
    handle.setAttribute("aria-hidden", "true");
    handle.title = "Drag to reorder queue";
    handle.textContent = "⋮⋮";

    const details = document.createElement("span");
    const name = document.createElement("strong");
    const size = document.createElement("small");
    const state = document.createElement("em");
    name.textContent = file.name;
    size.textContent = formatBytes(file.size);
    state.innerHTML = fileStates.get(file) || formatMediaMetadata(fileMetadata.get(file));
    details.append(name, size, state);

    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "Remove";
    remove.disabled = conversionInProgress;
    remove.setAttribute("aria-label", `Remove ${file.name}`);
    remove.addEventListener("click", () => {
      selectedFiles.splice(index, 1);
      fileMetadata.delete(file);
      fileStates.delete(file);
      resetResults();
      renderQueue();
      showPreview(selectedFiles[0]);
      setStatus(selectedFiles.length ? `${selectedFiles.length} ${modeContent[getMode()].ready}` : modeContent[getMode()].empty);
    });

    item.addEventListener("dragstart", (e) => {
      if (conversionInProgress) return;
      draggedIndex = index;
      item.classList.add("is-dragging");
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", String(index));
    });

    item.addEventListener("dragover", (e) => {
      e.preventDefault();
      if (draggedIndex === null || draggedIndex === index) return;
      item.classList.add("drag-over");
      e.dataTransfer.dropEffect = "move";
    });

    item.addEventListener("dragleave", () => {
      item.classList.remove("drag-over");
    });

    item.addEventListener("drop", (e) => {
      e.preventDefault();
      item.classList.remove("drag-over");
      if (draggedIndex === null || draggedIndex === index) return;
      const movedItem = selectedFiles.splice(draggedIndex, 1)[0];
      selectedFiles.splice(index, 0, movedItem);
      draggedIndex = null;
      renderQueue();
      showPreview(selectedFiles[0]);
    });

    item.addEventListener("dragend", () => {
      item.classList.remove("is-dragging");
      item.classList.remove("drag-over");
      draggedIndex = null;
    });

    item.append(handle, details, remove);
    fileList.append(item);
  });
}

function clearSelection() {
  selectedFiles = [];
  fileInput.value = "";
  resetResults();
  resetPreview();
  fileMetadata.clear();
  fileStates.clear();
  clearError();
  setProgress(0);
  renderQueue();
  setStatus(modeContent[getMode()].empty);
}

async function convertQueue() {
  const mode = getMode();
  clearError();
  resetResults();
  setProgress(0);
  if (!selectedFiles.length) {
    showError(mode === "mp4" ? "Please select WebM or MP4 video files first." : "Please select media files first.");
    return;
  }

  if (mode === "karaoke" && !karaokeEngine.words.some((w) => w.start !== null)) {
    showError("Please sync at least one word in the Lyrics Studio before exporting.");
    return;
  }

  const trim = getTrimSettings();
  if (trim.error) {
    showError(trim.error);
    trimStart.focus();
    return;
  }
  const trimRangeError = getTrimRangeError(trim);
  if (trimRangeError) {
    showError(trimRangeError);
    trimEnd.focus();
    return;
  }
  const gifDurationError = getGifDurationError(trim);
  if (gifDurationError) {
    showError(gifDurationError);
    trimEnd.focus();
    return;
  }

  const results = [];
  try {
    cancelRequested = false;
    setBusy(true);
    thumbnailAbortToken++;
    releaseFfmpegMemory();
    await loadFfmpeg();
    for (activeFileIndex = 0; activeFileIndex < selectedFiles.length; activeFileIndex += 1) {
      const file = selectedFiles[activeFileIndex];
      fileStates.set(file, "Converting...");
      renderQueue();
      setStatus(`Preparing file ${activeFileIndex + 1} of ${selectedFiles.length}: ${file.name}`);
      try {
        results.push(await convertFile(file, mode, activeFileIndex, trim));
        fileStates.set(file, "Completed");
      } catch (error) {
        if (cancelRequested) throw new Error("conversion-cancelled");
        console.error(error);
        results.push({ file, error: getFriendlyError(error, mode) });
        fileStates.set(file, "Error");
      }
      renderQueue();
    }
    renderResults(results, mode);
    const completed = results.filter((result) => !result.error).length;
    setProgress(100);
    setStatus(`${completed} of ${results.length} file${results.length === 1 ? "" : "s"} converted successfully.`);
    if (completed < results.length) showError(`${results.length - completed} file${results.length - completed === 1 ? " could" : "s could"} not be converted. See results below.`);
  } catch (error) {
    console.error(error);
    if (cancelRequested || String(error?.message).includes("cancelled")) {
      fileStates.set(selectedFiles[activeFileIndex], "Cancelled");
      renderQueue();
      setStatus("Conversion cancelled. Completed downloads remain available.");
      if (results.length) renderResults(results, mode);
    } else {
      showError(getFriendlyError(error, mode));
      setStatus("The conversion queue stopped.");
    }
  } finally {
    releaseFfmpegMemory();
    setBusy(false);
  }
}

function cancelConversion() {
  if (cancelRequested) return;
  cancelRequested = true;
  cancelButton.disabled = true;
  setStatus("Cancelling current conversion...");
  releaseFfmpegMemory();
}

function showPreview(file) {
  resetPreview();
  if (!file) return;
  previewUrl = URL.createObjectURL(file);
  videoPreview.src = previewUrl;
  previewTitle.textContent = file.name;
  previewMeta.textContent = "Loading details...";
  previewPanel.classList.remove("is-hidden");
  if (getMode() !== "audio") saveFrameBar.classList.remove("is-hidden");
  if (getMode() === "karaoke") dynamicSubtitleOverlay.classList.remove("is-hidden");
}

function resetPreview() {
  videoPreview.pause();
  videoPreview.removeAttribute("src");
  videoPreview.load();
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = null;
  previewPanel.classList.add("is-hidden");
  resetCrop();
  cropActions.classList.add("is-hidden");
  revokeThumbnailUrls();
  thumbnailImages = [];
  timelineReady = false;
  timelineCanvas.classList.add("is-hidden");
  waveformReady = false;
  waveformCanvas.classList.add("is-hidden");
  trimOverlayActive = false;
  if (audioContext) { try { audioContext.close(); } catch {} audioContext = null; }
  audioBuffer = null;
  saveFrameBar.classList.add("is-hidden");
  if (dynamicSubtitleOverlay) dynamicSubtitleOverlay.classList.add("is-hidden");
}

function loadMediaMetadata(file) {
  return new Promise((resolve) => {
    const probe = document.createElement("video");
    const url = URL.createObjectURL(file);
    const codec = detectCodec(file);
    const finish = (metadata) => {
      if (metadata) {
        metadata.codec = codec;
        metadata.fps = metadata.fps || null;
      }
      fileMetadata.set(file, metadata);
      fileStates.set(file, formatMediaMetadata(metadata));
      URL.revokeObjectURL(url);
      probe.removeAttribute("src");
      resolve();
    };
    probe.preload = "metadata";
    probe.onloadedmetadata = () => {
      const meta = { duration: probe.duration, width: probe.videoWidth, height: probe.videoHeight, fps: null };
      finish(meta);
    };
    probe.onerror = () => finish(null);
    probe.src = url;
  });
}

function detectCodec(file) {
  const ext = getFileExtension(file.name);
  const type = file.type || "";
  if (type.includes("webm") || ext === "webm") return "VP8";
  if (type.includes("mp4") || ext === "mp4") return "H.264";
  if (type.includes("quicktime") || ext === "mov") return "H.264";
  if (ext === "mkv") return "VP9";
  if (ext === "avi") return "MPEG-4";
  if (ext === "ogv" || ext === "ogg") return "Theora";
  if (ext === "3gp") return "H.264";
  if (type.includes("audio") || ["mp3", "wav", "aac", "m4a", "flac"].includes(ext)) return "Audio";
  return "Media";
}

function updatePreviewMetadata(file) {
  if (!file || !previewUrl) return;
  previewMeta.innerHTML = formatMediaMetadata(fileMetadata.get(file));
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatMediaMetadata(metadata) {
  if (!metadata || !Number.isFinite(metadata.duration)) return "Details unavailable";
  const parts = [];
  if (metadata.codec) parts.push(`<span class="meta-tag">${escapeHtml(metadata.codec)}</span>`);
  if (metadata.width && metadata.height) parts.push(`<span class="meta-tag">${escapeHtml(metadata.height)}p</span>`);
  if (metadata.fps) parts.push(`<span class="meta-tag">${escapeHtml(metadata.fps)} fps</span>`);
  parts.push(`<span class="meta-tag">${escapeHtml(formatDuration(metadata.duration))}</span>`);
  return parts.join("");
}

function getTrimRangeError(trim) {
  const durations = selectedFiles.map((file) => fileMetadata.get(file)?.duration).filter(Number.isFinite);
  if (!durations.length) return "";
  const shortest = Math.min(...durations);
  if (trim.start !== undefined && trim.start >= shortest) return `Start time must be before ${formatDuration(shortest)}, the end of the shortest file.`;
  if (trim.end !== undefined && trim.end > shortest) return `End time cannot exceed ${formatDuration(shortest)}, the duration of the shortest file.`;
  return "";
}

async function convertFile(file, mode, index, trim) {
  if (mode === "gif" && getGifOutputExtension() === "webp") return convertToWebP(file, index, trim);
  const token = `${Date.now()}-${index}`;
  const inputName = `input-${token}.${getFileExtension(file.name) || "video"}`;
  const srtName = `subs-${token}.srt`;
  const assName = `subs-${token}.ass`;
  const extAudioName = selectedExternalAudioFile ? `extaudio-${token}.${getFileExtension(selectedExternalAudioFile.name) || "mp3"}` : null;
  const outputName = getOutputName(file.name, mode);
  let wroteInput = false;
  let wroteSrt = false;
  let wroteAss = false;
  let wroteExtAudio = false;
  let wroteOutput = false;
  try {
    await ffmpeg.writeFile(inputName, await fetchFile(file));
    wroteInput = true;

    if (mode === "mp4" && selectedSubtitlesFile) {
      await ffmpeg.writeFile(srtName, await fetchFile(selectedSubtitlesFile));
      wroteSrt = true;
    }
    if (mode === "mp4" && selectedExternalAudioFile && extAudioName) {
      await ffmpeg.writeFile(extAudioName, await fetchFile(selectedExternalAudioFile));
      wroteExtAudio = true;
    }

    if (mode === "karaoke") {
      const style = getActiveKaraokeStyle();
      const assData = exportAss(karaokeEngine.words, style);
      await ffmpeg.writeFile(assName, new TextEncoder().encode(assData));
      wroteAss = true;
    }

    let initialArgs;
    if (mode === "karaoke") {
      initialArgs = [
        "-hide_banner", "-y",
        ...getTrimInputArgs(trim),
        "-i", inputName,
        ...getTrimDurationArgs(trim),
        "-vf", `subtitles=${assName}`,
        "-c:v", "libx264",
        "-preset", "veryfast",
        "-crf", "22",
        "-c:a", "aac",
        "-b:a", "192k",
        "-pix_fmt", "yuv420p",
        "-movflags", "+faststart",
        "-f", "mp4",
        outputName,
      ];
    } else if (mode === "mp4") {
      initialArgs = getMp4Args(inputName, outputName, "h264", trim, wroteSrt ? srtName : null, wroteExtAudio ? extAudioName : null);
    } else if (mode === "gif") {
      initialArgs = getGifArgs(inputName, outputName, trim);
    } else {
      initialArgs = getAudioArgs(inputName, outputName, trim);
    }

    let exitCode = await ffmpeg.exec(initialArgs);
    if (mode === "mp4" && exitCode !== 0) {
      exitCode = await ffmpeg.exec(getMp4Args(inputName, outputName, "mpeg4", trim, wroteSrt ? srtName : null, wroteExtAudio ? extAudioName : null));
    }
    if (exitCode !== 0) throw new Error(`ffmpeg-exit-${exitCode}`);
    wroteOutput = true;
    const data = await ffmpeg.readFile(outputName);
    if (!data?.length) throw new Error("empty-output");
    const blob = new Blob([data], { type: outputMimeTypes[getOutputExtension(mode)] });
    const url = URL.createObjectURL(blob);
    resultUrls.push(url);

    recordConversionHistory({
      name: file.name,
      outputName,
      mode,
      inputSize: file.size,
      outputSize: blob.size,
      timestamp: Date.now(),
    });

    return { file, outputName, outputSize: blob.size, url };
  } finally {
    await cleanupFiles(
      ...(wroteInput ? [inputName] : []),
      ...(wroteSrt ? [srtName] : []),
      ...(wroteAss ? [assName] : []),
      ...(wroteExtAudio && extAudioName ? [extAudioName] : []),
      ...(wroteOutput ? [outputName] : [])
    );
  }
}

async function convertToWebP(file, index, trim) {
  const token = `${Date.now()}-${index}`;
  const inputName = `webp-input-${token}.${getFileExtension(file.name) || "video"}`;
  const outputName = getOutputName(file.name, "gif");
  let wroteInput = false;
  let wroteOutput = false;
  try {
    await ffmpeg.writeFile(inputName, await fetchFile(file));
    wroteInput = true;
    const cropFilter = cropActive && cropRect ? getGifCropFilter() : "";
    const speedVal = parseFloat(gifSpeed?.value) || 1;
    const speedPrefix = speedVal !== 1 ? `setpts=PTS/${speedVal},` : "";
    const baseFilter = `${speedPrefix}fps=${gifFps.value},scale=${gifWidth.value}:-1:flags=lanczos`;
    const filter = cropFilter ? `${cropFilter},${baseFilter}` : baseFilter;
    const args = ["-hide_banner", "-y", ...getTrimInputArgs(trim), "-i", inputName, ...getTrimDurationArgs(trim), "-filter_complex", `[0:v]${filter}`, "-loop", "0", "-f", "webp", "-lossless", "0", "-quality", "90", outputName];
    const exitCode = await ffmpeg.exec(args);
    if (exitCode !== 0) throw new Error(`ffmpeg-exit-${exitCode}`);
    wroteOutput = true;
    const data = await ffmpeg.readFile(outputName);
    if (!data?.length) throw new Error("empty-output");
    const blob = new Blob([data], { type: "image/webp" });
    const url = URL.createObjectURL(blob);
    resultUrls.push(url);
    return { file, outputName, outputSize: blob.size, url };
  } finally {
    await cleanupFiles(...(wroteInput ? [inputName] : []), ...(wroteOutput ? [outputName] : []));
  }
}

function renderResults(results, mode) {
  resultsList.replaceChildren();
  resultsPanel.classList.remove("is-hidden");
  resultsPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  const completed = results.filter((result) => !result.error);
  completedResults = completed;
  resultsSummary.textContent = `${completed.length}/${results.length} completed`;
  downloadAllButton.classList.toggle("is-hidden", completed.length < 2);
  results.forEach((result) => {
    const card = document.createElement("article");
    card.className = `result-card${result.error ? " has-error" : ""}`;
    const details = document.createElement("div");
    const title = document.createElement("strong");
    const meta = document.createElement("span");
    title.textContent = result.error ? result.file.name : result.outputName;
    meta.textContent = result.error ? result.error : getSizeComparison(result.file.size, result.outputSize);
    details.append(title, meta);
    card.append(details);
    if (!result.error) {
      const link = document.createElement("a");
      link.href = result.url;
      link.download = result.outputName;
      link.textContent = mode === "gif" ? `Download ${getGifOutputExtension().toUpperCase()}` : modeContent[mode].download;
      link.addEventListener("click", (event) => { event.preventDefault(); forceDownload(result.url, result.outputName); });
      card.append(link);
    }
    resultsList.append(card);
  });
}

function downloadAllResults() {
  if (!completedResults.length) return;
  downloadAllButton.disabled = true;
  setStatus(`Starting ${completedResults.length} downloads. Your browser may ask for permission to download multiple files.`);
  completedResults.forEach((result) => forceDownload(result.url, result.outputName));
  downloadAllButton.disabled = false;
}

function getAudioArgs(inputName, outputName, trim) {
  const format = getCheckedValue("format");
  const bitrate = getCheckedValue("bitrate");
  const loudnessArgs = loudnessNormalize?.checked
    ? ["-af", "loudnorm=I=-16:LRA=11:TP=-1.5"]
    : [];
  return ["-hide_banner", "-y", ...getTrimInputArgs(trim), "-i", inputName, ...getTrimDurationArgs(trim), ...audioOutputArgs[format], ...(format === "wav" ? [] : ["-b:a", bitrate]), ...loudnessArgs, outputName];
}

function getMp4Args(inputName, outputName, encoder, trim, srtName = null, extAudioName = null) {
  const crf = videoQuality.value;
  const fallbackQuality = crf === "18" ? "3" : crf === "28" ? "8" : "5";
  const videoArgs = encoder === "mpeg4" ? ["-c:v", "mpeg4", "-q:v", fallbackQuality] : ["-c:v", "libx264", "-preset", "veryfast", "-crf", crf];
  const speedVal = parseFloat(videoSpeed?.value) || 1;
  const videoFilters = [];
  if (speedVal !== 1) videoFilters.push(`setpts=PTS/${speedVal}`);
  if (videoResolution.value !== "original") videoFilters.push(`scale=w=-2:h=${videoResolution.value}:force_original_aspect_ratio=decrease`);

  const colorVal = mp4ColorFilter?.value || "none";
  if (colorVal === "vivid") {
    videoFilters.push("eq=saturation=1.35:contrast=1.08");
  } else if (colorVal === "contrast") {
    videoFilters.push("eq=contrast=1.25:brightness=-0.02");
  } else if (colorVal === "bw") {
    videoFilters.push("hue=s=0");
  } else if (colorVal === "warm") {
    videoFilters.push("colorbalance=rs=0.08:gs=0.02:bs=-0.08");
  }

  if (srtName) {
    videoFilters.push(`subtitles=${srtName}`);
  }

  const vfArgs = videoFilters.length ? ["-vf", videoFilters.join(",")] : [];

  const audioTrackVal = mp4AudioTrack?.value || "stereo";
  let audioInputs = [];
  let audioMappingAndCodec = [];

  if (extAudioName) {
    audioInputs = ["-i", extAudioName];
    const audioFilters = [];
    if (speedVal !== 1) audioFilters.push(getAtempoChain(speedVal));
    const afArgs = audioFilters.length ? ["-af", audioFilters.join(",")] : [];
    audioMappingAndCodec = ["-map", "1:a:0", ...afArgs, "-c:a", "aac", "-b:a", "160k", "-shortest"];
  } else if (audioTrackVal === "mute") {
    audioMappingAndCodec = ["-an"];
  } else {
    const audioFilters = [];
    if (speedVal !== 1) audioFilters.push(getAtempoChain(speedVal));
    const afArgs = audioFilters.length ? ["-af", audioFilters.join(",")] : [];
    const channelArgs = audioTrackVal === "mono" ? ["-ac", "1"] : [];
    audioMappingAndCodec = ["-map", "0:a:0?", ...afArgs, "-c:a", "aac", ...channelArgs, "-b:a", "160k"];
  }

  return [
    "-hide_banner",
    "-y",
    ...getTrimInputArgs(trim),
    "-i",
    inputName,
    ...audioInputs,
    ...getTrimDurationArgs(trim),
    "-map",
    "0:v:0",
    ...videoArgs,
    ...vfArgs,
    ...audioMappingAndCodec,
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    "-f",
    "mp4",
    outputName,
  ];
}

function getGifArgs(inputName, outputName, trim) {
  const cropFilter = cropActive && cropRect ? getGifCropFilter() : "";
  const speedVal = parseFloat(gifSpeed?.value) || 1;
  const speedPrefix = speedVal !== 1 ? `setpts=PTS/${speedVal},` : "";
  const baseFilter = `${speedPrefix}fps=${gifFps.value},scale=${gifWidth.value}:-1:flags=lanczos`;
  const filter = cropFilter ? `${cropFilter},${baseFilter}` : baseFilter;
  return ["-hide_banner", "-y", ...getTrimInputArgs(trim), "-i", inputName, ...getTrimDurationArgs(trim), "-filter_complex", `[0:v]${filter},split[s0][s1];[s0]palettegen=max_colors=256[p];[s1][p]paletteuse=dither=bayer:bayer_scale=3`, "-loop", "0", "-f", "gif", outputName];
}

function getGifCropFilter() {
  const nat = cachedNaturalCrop || getNaturalCrop();
  if (!nat) return "";
  return getCropFilter(nat.x, nat.y, nat.w, nat.h);
}

function getTrimSettings() {
  const start = parseTimeValue(trimStart.value);
  const end = parseTimeValue(trimEnd.value);
  if (start === null || end === null) return { error: "Enter trim times as MM:SS or HH:MM:SS, for example 01:30." };
  if (end !== undefined && end <= (start || 0)) return { error: "End time must be later than start time." };
  return { start, end };
}

function getGifDurationError(trim) {
  if (getMode() !== "gif") return "";
  const durations = selectedFiles.map((file) => fileMetadata.get(file)?.duration).filter(Number.isFinite);
  if (!durations.length) return "";
  const start = trim.start || 0;
  const requestedDuration = trim.end !== undefined
    ? trim.end - start
    : Math.max(...durations.map((duration) => Math.max(0, duration - start)));
  if (requestedDuration <= 0) return "The selected start time is past the end of all files.";
  return requestedDuration > 15 ? "GIF clips are limited to 15 seconds. Enter an End time no more than 15 seconds after Start time." : "";
}

async function loadFfmpeg() {
  if (ffmpegReady) return;
  if (ffmpegLoadPromise) return ffmpegLoadPromise;
  setStatus("Loading the local conversion engine. This may take a few seconds...");
  ffmpegLoadPromise = withTimeout(ffmpeg.load({ coreURL: ffmpegCoreURL, wasmURL: ffmpegWasmURL }), FFMPEG_LOAD_TIMEOUT_MS)
    .then(() => { ffmpegReady = true; })
    .catch((error) => { ffmpegReady = false; throw error; })
    .finally(() => { ffmpegLoadPromise = null; });
  return ffmpegLoadPromise;
}

function withTimeout(promise, timeoutMs) {
  return new Promise((resolve, reject) => {
    const id = window.setTimeout(() => reject(new Error(`timeout-${timeoutMs}`)), timeoutMs);
    promise.then((value) => { clearTimeout(id); resolve(value); }, (error) => { clearTimeout(id); reject(error); });
  });
}

async function cleanupFiles(...paths) {
  await Promise.all(paths.map(async (path) => { try { await ffmpeg.deleteFile(path); } catch { /* File may not exist. */ } }));
}

function releaseFfmpegMemory() {
  try { ffmpeg.terminate(); } catch { /* Worker may already be stopped. */ }
  ffmpegReady = false;
  ffmpegLoadPromise = null;
}

function resetResults() {
  resultUrls.forEach((url) => URL.revokeObjectURL(url));
  resultUrls = [];
  completedResults = [];
  resultsList.replaceChildren();
  resultsPanel.classList.add("is-hidden");
  downloadAllButton.classList.add("is-hidden");
}

function savePreferences() {
  const preferences = {
    mode: getMode(),
    format: getCheckedValue("format"),
    bitrate: getCheckedValue("bitrate"),
    gifOutput: getCheckedValue("gif-output"),
    quality: videoQuality.value,
    resolution: videoResolution.value,
    gifWidth: gifWidth.value,
    gifFps: gifFps.value,
    speed: videoSpeed?.value ?? "1",
    gifSpeedVal: gifSpeed?.value ?? "1",
    loudness: loudnessNormalize?.checked ?? false,
    mp4Audio: mp4AudioTrack?.value ?? "stereo",
    mp4Filter: mp4ColorFilter?.value ?? "none",
    karaokePreset: activePresetId,
    karaokeFont: karaokeFontFamily?.value,
    karaokeSize: karaokeFontSize?.value,
    karaokeColor: karaokePrimaryColor?.value,
    karaokeActiveColor: karaokeActiveColor?.value,
    karaokePos: karaokePosition?.value,
    karaokeUpper: karaokeUppercase?.checked ?? true,
  };
  try { localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences)); } catch { /* Storage may be disabled. */ }
}

function restorePreferences() {
  try {
    const preferences = JSON.parse(localStorage.getItem(PREFERENCES_KEY) || "null");
    if (!preferences) return;
    setCheckedValue("mode", preferences.mode);
    setCheckedValue("format", preferences.format);
    setCheckedValue("bitrate", preferences.bitrate);
    if (preferences.gifOutput) setCheckedValue("gif-output", preferences.gifOutput);
    setSelectValue(videoQuality, preferences.quality);
    setSelectValue(videoResolution, preferences.resolution);
    setSelectValue(gifWidth, preferences.gifWidth);
    setSelectValue(gifFps, preferences.gifFps);
    if (videoSpeed && preferences.speed) setSelectValue(videoSpeed, preferences.speed);
    if (gifSpeed && preferences.gifSpeedVal) setSelectValue(gifSpeed, preferences.gifSpeedVal);
    if (loudnessNormalize && preferences.loudness !== undefined) loudnessNormalize.checked = !!preferences.loudness;
    if (mp4AudioTrack && preferences.mp4Audio) setSelectValue(mp4AudioTrack, preferences.mp4Audio);
    if (mp4ColorFilter && preferences.mp4Filter) setSelectValue(mp4ColorFilter, preferences.mp4Filter);
    if (preferences.karaokePreset) applyKaraokePreset(preferences.karaokePreset);
    if (karaokeFontFamily && preferences.karaokeFont) setSelectValue(karaokeFontFamily, preferences.karaokeFont);
    if (karaokeFontSize && preferences.karaokeSize) setSelectValue(karaokeFontSize, preferences.karaokeSize);
    if (karaokePrimaryColor && preferences.karaokeColor) karaokePrimaryColor.value = preferences.karaokeColor;
    if (karaokeActiveColor && preferences.karaokeActiveColor) karaokeActiveColor.value = preferences.karaokeActiveColor;
    if (karaokePosition && preferences.karaokePos) setSelectValue(karaokePosition, preferences.karaokePos);
    if (karaokeUppercase && preferences.karaokeUpper !== undefined) karaokeUppercase.checked = preferences.karaokeUpper;
  } catch { /* Invalid or unavailable storage falls back to defaults. */ }
}

function restoreAllDefaults() {
  clearSelection();
  setCheckedValue("mode", "audio");
  setCheckedValue("format", "mp3");
  setCheckedValue("bitrate", "128k");
  setCheckedValue("gif-output", "gif");
  videoQuality.value = "23";
  videoResolution.value = "original";
  gifWidth.value = "480";
  gifFps.value = "12";
  if (videoSpeed) videoSpeed.value = "1";
  if (gifSpeed) gifSpeed.value = "1";
  if (loudnessNormalize) loudnessNormalize.checked = false;
  if (mp4AudioTrack) mp4AudioTrack.value = "stereo";
  if (mp4ColorFilter) mp4ColorFilter.value = "none";
  selectedSubtitlesFile = null;
  if (subtitlesInput) subtitlesInput.value = "";
  if (subtitlesStatus) subtitlesStatus.classList.add("is-hidden");
  if (subtitlesName) subtitlesName.textContent = "";
  selectedExternalAudioFile = null;
  if (externalAudioInput) externalAudioInput.value = "";
  if (externalAudioStatus) externalAudioStatus.classList.add("is-hidden");
  if (externalAudioName) externalAudioName.textContent = "";
  trimStart.value = "";
  trimEnd.value = "";

  // Reset Karaoke
  karaokeEngine.resetSync();
  karaokeEngine.setWords([]);
  applyKaraokePreset("tiktok");
  if (karaokeLyricsInput) karaokeLyricsInput.value = "";
  renderWordChipsQueue();

  try { localStorage.removeItem(PREFERENCES_KEY); } catch { /* Storage may be disabled. */ }
  resetCrop();
  cropActions.classList.add("is-hidden");
  updateModeUI({ resetFiles: false });
  clearError();
  setProgress(0);
  setStatus("All settings and files were restored to defaults.");
}

function setCheckedValue(name, value) {
  const input = Array.from(document.querySelectorAll(`input[name="${name}"]`)).find((candidate) => candidate.value === value);
  if (input) input.checked = true;
}

function setSelectValue(select, value) {
  if (Array.from(select.options).some((option) => option.value === value)) select.value = value;
}

function forceDownload(url, filename) {
  const link = document.createElement("a");
  link.href = url; link.download = filename; link.rel = "noopener"; link.style.display = "none";
  document.body.appendChild(link); link.click(); link.remove();
}

function updateModeUI({ resetFiles }) {
  const mode = getMode();
  const isMp4 = mode === "mp4";
  const isGif = mode === "gif";
  const isKaraoke = mode === "karaoke";

  audioSettings.classList.toggle("is-hidden", mode !== "audio");
  mp4Settings.classList.toggle("is-hidden", !isMp4);
  mp4Note.classList.toggle("is-hidden", !isMp4);
  gifSettings.classList.toggle("is-hidden", !isGif);
  gifNote.classList.toggle("is-hidden", !isGif);

  if (karaokeSettings) karaokeSettings.classList.toggle("is-hidden", !isKaraoke);
  if (karaokeNote) karaokeNote.classList.toggle("is-hidden", !isKaraoke);
  if (dynamicSubtitleOverlay) dynamicSubtitleOverlay.classList.toggle("is-hidden", !isKaraoke);

  fileInput.accept = modeContent[mode].accept;
  dropTitle.textContent = modeContent[mode].dropTitle;
  dropHint.textContent = modeContent[mode].dropHint;
  initPreviewTools(mode);

  if (isGif && selectedFiles.length) {
    cropActions.classList.remove("is-hidden");
  } else {
    cropActions.classList.add("is-hidden");
    resetCrop();
  }

  if (resetFiles) clearSelection();
  setBusy(false);
  setStatus(modeContent[mode].empty);

  if (!previewPanel.classList.contains("is-hidden") && mode !== "audio") {
    saveFrameBar.classList.remove("is-hidden");
  } else {
    saveFrameBar.classList.add("is-hidden");
  }
}

function setBusy(busy) {
  conversionInProgress = busy;
  convertButton.disabled = busy;
  form.querySelectorAll("input, select, textarea").forEach((control) => { control.disabled = busy; });
  clearFilesButton.disabled = busy;
  fileList.querySelectorAll("button").forEach((button) => { button.disabled = busy; });
  dropZone.classList.toggle("is-disabled", busy);
  dropZone.setAttribute("aria-disabled", String(busy));
  resetDefaultsButton.disabled = busy;
  cancelButton.classList.toggle("is-hidden", !busy);
  cancelButton.disabled = !busy;
  modeInputs.forEach((input) => { input.disabled = busy; });
  convertButton.textContent = busy ? modeContent[getMode()].busy : modeContent[getMode()].button;
  savePresetButton.disabled = busy;
  if (shareConfigButton) shareConfigButton.disabled = busy;
  saveFrameButton.disabled = busy;
}

function getFriendlyError(error, mode) {
  const message = String(error?.message || error || "").toLowerCase();
  if (message.includes("worker") || message.includes("securityerror")) return "The browser blocked the conversion engine. Refresh and try again.";
  if (message.includes("timeout") || message.includes("abort")) return "The conversion engine took too long to load. Refresh and try again.";
  if (message.includes("memory")) return "The browser ran out of memory. Try fewer or smaller files.";
  if (message.includes("empty-output")) return "No output file was generated.";
  if (mode === "gif") return `This video could not be converted to ${getGifOutputExtension().toUpperCase()}. Try a shorter clip or smaller size.`;
  if (message.includes("ffmpeg-exit") || message.includes("audio") || message.includes("stream") || message.includes("map")) {
    return mode === "mp4" || mode === "karaoke" ? "This video could not be converted or subtitled." : "No compatible audio track was found.";
  }
  return mode === "mp4" || mode === "karaoke" ? "This video could not be converted." : "This media file could not be converted.";
}

function getValidationMessage(mode) {
  if (mode === "mp4") return "Please select one or more .webm or .mp4 video files.";
  if (mode === "karaoke") return "Please select a video or audio file for Karaoke/Subtitles.";
  return "The selected files do not appear to be compatible media files.";
}

function getCheckedValue(name) { return document.querySelector(`input[name="${name}"]:checked`)?.value ?? ""; }
function getMode() { return getCheckedValue("mode"); }
function isValidFileForMode(file, mode) {
  if (mode === "mp4") return isMp4SourceFile(file);
  if (mode === "karaoke") return isVideoFile(file) || isAudioFile(file);
  return isVideoFile(file);
}

const VIDEO_EXTENSIONS = ["3gp", "avi", "m4v", "mkv", "mov", "mp4", "mpeg", "mpg", "ogv", "webm"];
const AUDIO_EXTENSIONS = ["mp3", "wav", "aac", "m4a", "ogg", "flac", "wma"];
const MP4_SOURCE_EXTENSIONS = ["webm", "mp4"];
const MP4_SOURCE_TYPES = ["video/webm", "video/mp4"];

function isVideoFile(file) { return file.type.startsWith("video/") || VIDEO_EXTENSIONS.includes(getFileExtension(file.name)); }
function isAudioFile(file) { return file.type.startsWith("audio/") || AUDIO_EXTENSIONS.includes(getFileExtension(file.name)); }
function isMp4SourceFile(file) { return MP4_SOURCE_TYPES.includes(file.type) || MP4_SOURCE_EXTENSIONS.includes(getFileExtension(file.name)); }

function getOutputName(name, mode) {
  if (mode === "gif") {
    const ext = getGifOutputExtension();
    return `${safeBaseName(name)}-clip.${ext}`;
  }
  if (mode === "karaoke") {
    return `${safeBaseName(name)}-subtitled.mp4`;
  }
  const suffix = mode === "mp4" && getFileExtension(name) === "mp4" ? "-optimized" : "";
  return `${safeBaseName(name)}${suffix}.${getOutputExtension(mode)}`;
}

function getOutputExtension(mode) {
  if (mode === "mp4" || mode === "karaoke") return "mp4";
  if (mode === "gif") return getGifOutputExtension();
  return getCheckedValue("format");
}

function getSizeComparison(input, output) {
  const difference = input ? Math.round((1 - output / input) * 100) : 0;
  const change = difference >= 0 ? `${difference}% smaller` : `${Math.abs(difference)}% larger`;
  return `${formatBytes(input)} → ${formatBytes(output)} · ${change}`;
}

function localAssetURL(path) { return new URL(path, window.location.href).href; }
function setProgress(percent) { progressBar.style.width = `${percent}%`; }
function setStatus(message) { statusMessage.textContent = message; }
function showError(message) { errorMessage.textContent = message; errorMessage.classList.remove("is-hidden"); }
function clearError() { errorMessage.textContent = ""; errorMessage.classList.add("is-hidden"); }

function activateCrop() {
  if (!videoPreview.videoWidth || !videoPreview.videoHeight) return;
  cropActive = true;
  cropOverlay.classList.remove("is-hidden");
  cropBox.classList.remove("is-hidden");
  cropSelectButton.classList.add("is-hidden");
  cropResetButton.classList.remove("is-hidden");
  videoPreview.pause();
  setDefaultCropRect();
}

function resetCrop() {
  cropActive = false;
  cropRect = null;
  cachedNaturalCrop = null;
  cropOverlay.classList.add("is-hidden");
  cropBox.classList.add("is-hidden");
  cropDimensions.classList.add("is-hidden");
  cropSelectButton.classList.remove("is-hidden");
  cropResetButton.classList.add("is-hidden");
}

function setDefaultCropRect() {
  const vr = getVideoRect();
  if (!vr.w || !vr.h) return;
  const margin = 0.15;
  cropRect = {
    x: Math.round(vr.x + vr.w * margin),
    y: Math.round(vr.y + vr.h * margin),
    w: Math.round(vr.w * (1 - 2 * margin)),
    h: Math.round(vr.h * (1 - 2 * margin)),
  };
  renderCropBox();
}

function renderCropBox() {
  if (!cropRect) return;
  cropBox.style.left = cropRect.x + "px";
  cropBox.style.top = cropRect.y + "px";
  cropBox.style.width = cropRect.w + "px";
  cropBox.style.height = cropRect.h + "px";
  const vr = getVideoRect();
  const vLeft = vr.x;
  const vRight = vr.x + vr.w;
  const vTop = vr.y;
  const vBottom = vr.y + vr.h;
  cropShadeTop.style.height = Math.max(0, cropRect.y - vTop) + "px";
  cropShadeLeft.style.top = cropRect.y + "px";
  cropShadeLeft.style.height = cropRect.h + "px";
  cropShadeLeft.style.width = Math.max(0, cropRect.x - vLeft) + "px";
  cropShadeRight.style.top = cropRect.y + "px";
  cropShadeRight.style.height = cropRect.h + "px";
  cropShadeRight.style.width = Math.max(0, vRight - (cropRect.x + cropRect.w)) + "px";
  cropShadeBottom.style.top = (cropRect.y + cropRect.h) + "px";
  cropShadeBottom.style.height = Math.max(0, vBottom - (cropRect.y + cropRect.h)) + "px";
  cropDimensions.classList.remove("is-hidden");
  updateCropDimensions();
  cachedNaturalCrop = getNaturalCrop();
}

function updateCropDimensions() {
  if (!cropRect) return;
  const nat = getNaturalCrop();
  cropDimensions.textContent = `${Math.round(nat.w)} × ${Math.round(nat.h)} px`;
}

function getVideoRect() {
  const ew = videoPreview.clientWidth;
  const eh = videoPreview.clientHeight;
  const nw = videoPreview.videoWidth;
  const nh = videoPreview.videoHeight;
  if (!ew || !eh || !nw || !nh) return { x: 0, y: 0, w: ew, h: eh };
  const elementRatio = ew / eh;
  const videoRatio = nw / nh;
  let renderW, renderH, offsetX, offsetY;
  if (videoRatio > elementRatio) {
    renderW = ew;
    renderH = ew / videoRatio;
    offsetX = 0;
    offsetY = (eh - renderH) / 2;
  } else {
    renderH = eh;
    renderW = eh * videoRatio;
    offsetX = (ew - renderW) / 2;
    offsetY = 0;
  }
  return { x: offsetX, y: offsetY, w: renderW, h: renderH };
}

function getNaturalCrop() {
  if (!cropRect) return null;
  const vr = getVideoRect();
  const nw = videoPreview.videoWidth;
  const nh = videoPreview.videoHeight;
  if (!vr.w || !vr.h || !nw || !nh) return null;
  return {
    x: Math.round((cropRect.x - vr.x) * (nw / vr.w)),
    y: Math.round((cropRect.y - vr.y) * (nh / vr.h)),
    w: Math.round(cropRect.w * (nw / vr.w)),
    h: Math.round(cropRect.h * (nh / vr.h)),
  };
}

cropBox.addEventListener("mousedown", (event) => {
  event.preventDefault();
  event.stopPropagation();
  if (!cropActive) return;
  cropDragging = true;
  cropStartX = event.clientX;
  cropStartY = event.clientY;
  cropStartRect = { ...cropRect };
  videoPreview.controls = false;
});

Array.from(cropBox.querySelectorAll(".crop-handle")).forEach((handle) => {
  handle.addEventListener("mousedown", (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (!cropActive) return;
    cropResizing = true;
    cropResizeHandle = handle.dataset.handle;
    cropStartX = event.clientX;
    cropStartY = event.clientY;
    cropStartRect = { ...cropRect };
    videoPreview.controls = false;
  });
});

document.addEventListener("mousemove", (event) => {
  if (cropDragging || cropResizing) {
    const dx = event.clientX - cropStartX;
    const dy = event.clientY - cropStartY;
    const vr = getVideoRect();
    if (cropDragging) {
      const maxX = vr.x + vr.w - cropStartRect.w;
      const maxY = vr.y + vr.h - cropStartRect.h;
      cropRect.x = clamp(cropStartRect.x + dx, vr.x, maxX);
      cropRect.y = clamp(cropStartRect.y + dy, vr.y, maxY);
    } else if (cropResizing) {
      applyResize(cropResizeHandle, dx, dy, vr);
    }
    renderCropBox();
  }

  if (trimOverlayDragging || trimOverlayResizing) {
    if (!videoPreview.duration || !trimOverlayDragStartRange) return;
    const rect = timelineCanvas.getBoundingClientRect();
    const deltaX = event.clientX - trimOverlayDragStartX;
    const deltaSec = (deltaX / rect.width) * videoPreview.duration;
    const duration = videoPreview.duration;
    const maxDur = getMaxTrimDuration();

    if (trimOverlayDragging) {
      const windowDur = trimOverlayDragStartRange.endSec - trimOverlayDragStartRange.startSec;
      let newStart = clamp(trimOverlayDragStartRange.startSec + deltaSec, 0, duration - windowDur);
      let newEnd = newStart + windowDur;
      applyTrimRange(newStart, newEnd);
    } else if (trimOverlayHandle === "left") {
      let newStart = clamp(trimOverlayDragStartRange.startSec + deltaSec, 0, trimOverlayDragStartRange.endSec - 1);
      if (trimOverlayDragStartRange.endSec - newStart > maxDur) {
        newStart = trimOverlayDragStartRange.endSec - maxDur;
      }
      applyTrimRange(newStart, trimOverlayDragStartRange.endSec);
    } else if (trimOverlayHandle === "right") {
      let newEnd = clamp(trimOverlayDragStartRange.endSec + deltaSec, trimOverlayDragStartRange.startSec + 1, duration);
      if (newEnd - trimOverlayDragStartRange.startSec > maxDur) {
        newEnd = trimOverlayDragStartRange.startSec + maxDur;
      }
      applyTrimRange(trimOverlayDragStartRange.startSec, newEnd);
    }
  }
});

document.addEventListener("mouseup", () => {
  if (cropDragging || cropResizing) {
    cropDragging = false;
    cropResizing = false;
    cropResizeHandle = null;
    videoPreview.controls = true;
  }
  if (trimOverlayDragging || trimOverlayResizing) {
    trimOverlayDragging = false;
    trimOverlayResizing = false;
    trimOverlayHandle = null;
    trimOverlayDragStartRange = null;
  }
});

function applyResize(handle, dx, dy, vr) {
  const minSize = 30;
  let { x, y, w, h } = cropStartRect;
  const maxX = vr.x + vr.w;
  const maxY = vr.y + vr.h;
  if (handle.includes("e")) w = clamp(w + dx, minSize, maxX - x);
  if (handle.includes("w")) { const newX = clamp(x + dx, vr.x, x + w - minSize); w = w - (newX - x); x = newX; }
  if (handle.includes("s")) h = clamp(h + dy, minSize, maxY - y);
  if (handle.includes("n")) { const newY = clamp(y + dy, vr.y, y + h - minSize); h = h - (newY - y); y = newY; }
  cropRect = { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) };
}

function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }

function stepFrame(direction) {
  if (!videoPreview.duration) return;
  videoPreview.pause();
  const step = direction * FRAME_STEP;
  videoPreview.currentTime = clamp(videoPreview.currentTime + step, 0, videoPreview.duration);
}

function handleTimelineSeek(event) {
  if (!videoPreview.duration) return;
  const rect = timelineCanvas.getBoundingClientRect();
  const ratio = (event.clientX - rect.left) / rect.width;
  videoPreview.currentTime = clamp(ratio * videoPreview.duration, 0, videoPreview.duration);
}

function handleTimelineMouseDown(event) {
  if (!videoPreview.duration) return;
  const rect = timelineCanvas.getBoundingClientRect();
  const canvasX = event.clientX - rect.left;
  if (!trimOverlayActive) {
    handleTimelineSeek(event);
    return;
  }
  const hit = hitTestTrimOverlay(canvasX);
  if (hit === "left" || hit === "right") {
    event.preventDefault();
    trimOverlayResizing = true;
    trimOverlayHandle = hit;
    trimOverlayDragStartX = event.clientX;
    trimOverlayDragStartRange = { ...getCurrentTrimRange() };
  } else if (hit === "body") {
    event.preventDefault();
    trimOverlayDragging = true;
    trimOverlayDragStartX = event.clientX;
    trimOverlayDragStartRange = { ...getCurrentTrimRange() };
  } else {
    handleTimelineSeek(event);
  }
}

function handleTimelineHover(event) {
  if (trimOverlayDragging || trimOverlayResizing) return;
  const rect = timelineCanvas.getBoundingClientRect();
  const canvasX = event.clientX - rect.left;
  const hit = hitTestTrimOverlay(canvasX);
  timelineCanvas.style.cursor =
    hit === "left" || hit === "right" ? "ew-resize" :
    hit === "body" ? "move" : "pointer";
}

function handleTimelineHoverEnd() {
  if (!trimOverlayDragging && !trimOverlayResizing) {
    timelineCanvas.style.cursor = "pointer";
  }
}

function revokeThumbnailUrls() {
  thumbnailImages.forEach((img) => {
    if (img?.src?.startsWith("blob:")) URL.revokeObjectURL(img.src);
  });
}

async function generateThumbnails(file) {
  if (!file || timelineReady) return;
  revokeThumbnailUrls();
  thumbnailImages = [];
  timelineReady = false;
  const myToken = ++thumbnailAbortToken;
  timelineCanvas.classList.remove("is-hidden");
  const dpr = window.devicePixelRatio || 1;
  timelineCanvas.width = timelineCanvas.clientWidth * dpr;
  timelineCanvas.height = timelineCanvas.clientHeight * dpr;
  timelineCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  timelineCtx.clearRect(0, 0, timelineCanvas.clientWidth, timelineCanvas.clientHeight);
  const cw = timelineCanvas.clientWidth;
  const ch = timelineCanvas.clientHeight;
  timelineCtx.fillStyle = "rgba(255,255,255,0.08)";
  timelineCtx.fillRect(0, 0, cw, ch);
  timelineCtx.fillStyle = "rgba(255,255,255,0.3)";
  timelineCtx.font = "10px sans-serif";
  timelineCtx.textAlign = "center";
  timelineCtx.fillText("Loading thumbnails...", cw / 2, ch / 2 + 3);

  const inputName = `thumb-input.${getFileExtension(file.name) || "video"}`;
  let wroteInput = false;
  try {
    await loadFfmpeg();
    if (thumbnailAbortToken !== myToken) return;
    await ffmpeg.writeFile(inputName, await fetchFile(file));
    wroteInput = true;
    if (thumbnailAbortToken !== myToken) return;
    const duration = fileMetadata.get(file)?.duration || videoPreview.duration || 10;
    const interval = duration / (TIMELINE_THUMBNAILS + 1);
    const promises = [];
    for (let i = 1; i <= TIMELINE_THUMBNAILS; i++) {
      const time = interval * i;
      const outName = `thumb-${i}.jpg`;
      promises.push(
        ffmpeg.exec(["-hide_banner", "-y", "-ss", String(time), "-i", inputName, "-frames:v", "1", "-vf", "scale=64:-1", outName])
          .then(() => ffmpeg.readFile(outName))
          .then((data) => {
            if (thumbnailAbortToken !== myToken) return;
            const blob = new Blob([data], { type: "image/jpeg" });
            const blobUrl = URL.createObjectURL(blob);
            const img = new Image();
            img.onload = () => URL.revokeObjectURL(blobUrl);
            img.src = blobUrl;
            thumbnailImages[i - 1] = img;
          })
          .catch(() => {})
      );
    }
    await Promise.all(promises);
    if (thumbnailAbortToken !== myToken) return;
    timelineReady = true;
    refreshAccentColor();
    initTrimOverlay();
    drawTimeline();
  } catch {
    timelineCtx.clearRect(0, 0, timelineCanvas.width, timelineCanvas.height);
  } finally {
    const cleanupTasks = Array.from({ length: TIMELINE_THUMBNAILS }, (_, i) =>
      ffmpeg.deleteFile(`thumb-${i + 1}.jpg`).catch(() => {})
    );
    if (wroteInput) cleanupTasks.push(cleanupFiles(inputName).catch(() => {}));
    await Promise.all(cleanupTasks);
  }
}

function drawTimeline() {
  const dpr = window.devicePixelRatio || 1;
  const w = timelineCanvas.clientWidth;
  const h = timelineCanvas.clientHeight;
  const expectedW = Math.round(w * dpr);
  const expectedH = Math.round(h * dpr);
  if (timelineCanvas.width !== expectedW || timelineCanvas.height !== expectedH) {
    timelineCanvas.width = expectedW;
    timelineCanvas.height = expectedH;
    timelineCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  timelineCtx.clearRect(0, 0, w, h);
  timelineCtx.fillStyle = "rgba(0,0,0,0.4)";
  timelineCtx.fillRect(0, 0, w, h);
  const thumbW = w / TIMELINE_THUMBNAILS;
  for (let i = 0; i < thumbnailImages.length; i++) {
    const img = thumbnailImages[i];
    if (img && img.complete && img.naturalWidth) {
      timelineCtx.drawImage(img, i * thumbW, 0, thumbW, h);
    }
  }
  drawTrimOverlay(timelineCtx, w, h);
  if (videoPreview.duration) {
    const pos = (videoPreview.currentTime / videoPreview.duration) * w;
    timelineCtx.fillStyle = "rgba(145, 189, 89, 0.8)";
    timelineCtx.fillRect(pos - 1, 0, 2, h);
  }
}

function drawWaveform() {
  const w = waveformCanvas.width;
  const h = waveformCanvas.height;
  waveformCtx.clearRect(0, 0, w, h);
  if (!audioBuffer) return;
  const data = audioBuffer.getChannelData(0);
  const step = Math.ceil(data.length / w);
  const mid = h / 2;
  waveformCtx.lineWidth = 1;
  waveformCtx.strokeStyle = "rgba(145, 189, 89, 0.7)";
  waveformCtx.beginPath();
  waveformCtx.moveTo(0, mid);
  for (let i = 0; i < w; i++) {
    let min = 1;
    let max = -1;
    for (let j = 0; j < step; j++) {
      const datum = data[(i * step) + j] || 0;
      if (datum < min) min = datum;
      if (datum > max) max = datum;
    }
    waveformCtx.lineTo(i, mid + min * mid);
    waveformCtx.lineTo(i, mid + max * mid);
  }
  waveformCtx.stroke();
  if (videoPreview.duration) {
    const pos = (videoPreview.currentTime / videoPreview.duration) * w;
    waveformCtx.fillStyle = "rgba(145, 189, 89, 0.8)";
    waveformCtx.fillRect(pos - 1, 0, 2, h);
  }
}

async function decodeAudio(file) {
  if (decodeAbortController) decodeAbortController.abort();
  decodeAbortController = new AbortController();
  const { signal } = decodeAbortController;

  if (audioContext) {
    try { await audioContext.close(); } catch { /* already closed */ }
    audioContext = null;
  }

  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  audioContext = ctx;

  try {
    const arrayBuffer = await file.arrayBuffer();
    if (signal.aborted) return;
    audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    if (signal.aborted) return;
    waveformReady = true;
    waveformCanvas.width = waveformCanvas.clientWidth * (window.devicePixelRatio || 1);
    waveformCanvas.height = waveformCanvas.clientHeight * (window.devicePixelRatio || 1);
    waveformCtx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);
    drawWaveform();
  } catch (err) {
    if (!signal.aborted) console.warn("Audio decode failed:", err);
  }
}

function getGifOutputExtension() { return getCheckedValue("gif-output") || "gif"; }

function refreshAccentColor() {
  cachedAccentColor = getComputedStyle(document.documentElement).getPropertyValue("--accent-strong").trim() || "#91bd59";
}

function getMaxTrimDuration() {
  const mode = getMode();
  if (mode !== "gif") return videoPreview.duration || 0;
  return 15;
}

function clampTrimRange(startSec, endSec) {
  const duration = videoPreview.duration || 0;
  const maxDur = getMaxTrimDuration();
  const minDur = 1;
  if (duration < minDur) return { startSec: 0, endSec: duration };
  if (endSec - startSec < minDur) {
    endSec = Math.min(startSec + minDur, duration);
    if (endSec - startSec < minDur) startSec = endSec - minDur;
  }
  if (endSec - startSec > maxDur) endSec = startSec + maxDur;
  startSec = clamp(startSec, 0, duration - minDur);
  endSec = clamp(endSec, minDur, duration);
  return { startSec, endSec };
}

function applyTrimRange(startSec, endSec) {
  const clamped = clampTrimRange(startSec, endSec);
  syncTrimInputs(clamped.startSec, clamped.endSec);
  drawTimeline();
}

function syncTrimInputs(startSec, endSec) {
  const duration = videoPreview.duration || 0;
  trimStart.value = startSec > 0 ? formatDuration(startSec) : "";
  trimEnd.value = endSec < duration ? formatDuration(endSec) : "";
}

function getCurrentTrimRange() {
  if (!videoPreview.duration) return null;
  const duration = videoPreview.duration;
  const parsed = getTrimSettings();
  if (parsed.error) return { startSec: 0, endSec: Math.min(duration, getMaxTrimDuration()) };
  return { startSec: parsed.start || 0, endSec: parsed.end || duration };
}

function initTrimOverlay() {
  if (!videoPreview.duration || videoPreview.duration < 1) return;
  const duration = videoPreview.duration;
  const maxDur = getMaxTrimDuration();
  trimOverlayActive = true;
  applyTrimRange(0, Math.min(duration, maxDur));
}

function hitTestTrimOverlay(canvasX) {
  if (!trimOverlayActive || !videoPreview.duration) return "none";
  const w = timelineCanvas.clientWidth;
  const duration = videoPreview.duration;
  const range = getCurrentTrimRange();
  if (!range) return "none";
  const startPx = (range.startSec / duration) * w;
  const endPx = (range.endSec / duration) * w;
  const HANDLE_ZONE = 8;
  if (canvasX >= startPx - HANDLE_ZONE && canvasX <= startPx + HANDLE_ZONE) return "left";
  if (canvasX >= endPx - HANDLE_ZONE && canvasX <= endPx + HANDLE_ZONE) return "right";
  if (canvasX > startPx + HANDLE_ZONE && canvasX < endPx - HANDLE_ZONE) return "body";
  return "none";
}

function drawTrimOverlay(ctx, w, h) {
  if (!trimOverlayActive || !videoPreview.duration) return;
  const duration = videoPreview.duration;
  const range = getCurrentTrimRange();
  if (!range) return;
  const startPx = (range.startSec / duration) * w;
  const endPx = (range.endSec / duration) * w;

  ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
  ctx.fillRect(0, 0, startPx, h);
  ctx.fillRect(endPx, 0, w - endPx, h);

  ctx.fillStyle = "rgba(145, 189, 89, 0.5)";
  ctx.fillRect(startPx, 0, endPx - startPx, 1);
  ctx.fillRect(startPx, h - 1, endPx - startPx, 1);

  ctx.fillStyle = cachedAccentColor;
  ctx.fillRect(startPx - 1, 0, 2, h);
  ctx.fillRect(endPx - 1, 0, 2, h);

  ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
  const gripY = Math.floor(h / 2) - 2;
  ctx.fillRect(startPx - 1, gripY, 2, 1);
  ctx.fillRect(startPx - 1, gripY + 3, 2, 1);
  ctx.fillRect(endPx - 1, gripY, 2, 1);
  ctx.fillRect(endPx - 1, gripY + 3, 2, 1);

  drawTimeLabel(ctx, startPx, h, formatDuration(range.startSec), "left");
  drawTimeLabel(ctx, endPx, h, formatDuration(range.endSec), "right");
}

function drawTimeLabel(ctx, x, h, text, align) {
  ctx.font = "bold 9px sans-serif";
  ctx.textAlign = align === "left" ? "left" : "right";
  const textX = align === "left" ? x + 5 : x - 5;
  const textY = 11;
  const metrics = ctx.measureText(text);
  const pad = 3;
  const bgX = align === "left" ? x + 2 : x - metrics.width - pad * 2 - 2;
  const bgW = metrics.width + pad * 2;
  ctx.fillStyle = "rgba(0, 0, 0, 0.75)";
  ctx.beginPath();
  ctx.roundRect(bgX, 1, bgW, 13, 3);
  ctx.fill();
  ctx.fillStyle = "rgba(220, 230, 255, 0.9)";
  ctx.fillText(text, textX, textY);
}

function handleTrimInputChange() {
  if (!trimOverlayActive || !videoPreview.duration) return;
  const parsed = getTrimSettings();
  if (parsed.error) return;
  const duration = videoPreview.duration;
  const startSec = parsed.start || 0;
  const endSec = parsed.end || duration;
  if (endSec <= startSec) return;
  const clamped = clampTrimRange(startSec, endSec);
  syncTrimInputs(clamped.startSec, clamped.endSec);
  drawTimeline();
}

function initPreviewTools(mode) {
  frameNav.classList.toggle("is-hidden", mode === "audio");
  if (mode === "audio") {
    timelineCanvas.classList.add("is-hidden");
    waveformCanvas.classList.remove("is-hidden");
    trimOverlayActive = false;
  } else if (mode === "gif") {
    waveformCanvas.classList.add("is-hidden");
    timelineCanvas.classList.remove("is-hidden");
    refreshAccentColor();
  } else {
    timelineCanvas.classList.add("is-hidden");
    waveformCanvas.classList.add("is-hidden");
    trimOverlayActive = false;
  }
}

// Event listeners
savePresetButton.addEventListener("click", toggleSavePresetInput);
presetConfirm.addEventListener("click", confirmSavePreset);
presetCancel.addEventListener("click", hideSavePresetInput);
presetNameInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") confirmSavePreset();
  if (e.key === "Escape") hideSavePresetInput();
});
saveFrameButton.addEventListener("click", saveCurrentFrame);
if (shareConfigButton) shareConfigButton.addEventListener("click", handleShareConfig);

if (subtitlesInput) {
  subtitlesInput.addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    selectedSubtitlesFile = file;
    if (subtitlesName) subtitlesName.textContent = file.name;
    if (subtitlesStatus) subtitlesStatus.classList.remove("is-hidden");
    setStatus(`Subtitles file "${file.name}" attached.`);
  });
}

if (subtitlesRemove) {
  subtitlesRemove.addEventListener("click", () => {
    selectedSubtitlesFile = null;
    if (subtitlesInput) subtitlesInput.value = "";
    if (subtitlesStatus) subtitlesStatus.classList.add("is-hidden");
    if (subtitlesName) subtitlesName.textContent = "";
  });
}

if (externalAudioInput) {
  externalAudioInput.addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    selectedExternalAudioFile = file;
    if (externalAudioName) externalAudioName.textContent = file.name;
    if (externalAudioStatus) externalAudioStatus.classList.remove("is-hidden");
    setStatus(`Custom audio track "${file.name}" attached.`);
  });
}

if (externalAudioRemove) {
  externalAudioRemove.addEventListener("click", () => {
    selectedExternalAudioFile = null;
    if (externalAudioInput) externalAudioInput.value = "";
    if (externalAudioStatus) externalAudioStatus.classList.add("is-hidden");
    if (externalAudioName) externalAudioName.textContent = "";
  });
}

if (historyToggle) historyToggle.addEventListener("click", openHistoryModal);
if (historyClose) historyClose.addEventListener("click", closeHistoryModal);
if (historyBackdrop) historyBackdrop.addEventListener("click", closeHistoryModal);
if (historyClear) historyClear.addEventListener("click", clearHistory);

// Conversion History
const HISTORY_KEY = "beetales-converter-history-v1";

function loadHistoryFromStorage() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]"); } catch { return []; }
}

function saveHistoryToStorage(history) {
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(history)); } catch { /* storage disabled */ }
}

function recordConversionHistory(entry) {
  const history = loadHistoryFromStorage();
  history.unshift(entry);
  if (history.length > 25) history.pop();
  saveHistoryToStorage(history);
  updateHistoryBadge();
}

function updateHistoryBadge() {
  const dict = translations[currentLang] || translations.en;
  const history = loadHistoryFromStorage();
  let totalSaved = 0;
  history.forEach((h) => {
    if (h.inputSize && h.outputSize && h.inputSize > h.outputSize) {
      totalSaved += (h.inputSize - h.outputSize);
    }
  });
  if (historyBadge) {
    historyBadge.textContent = history.length
      ? `${formatBytes(totalSaved)} ${dict.saved_history_badge || "saved"}`
      : (dict.history_button || "History");
  }
}

function renderHistoryModal() {
  const history = loadHistoryFromStorage();
  if (!historyList) return;
  historyList.replaceChildren();
  if (!history.length) {
    const empty = document.createElement("p");
    empty.className = "history-empty-text";
    empty.textContent = "No conversions recorded yet. Converted files will appear here along with space savings.";
    historyList.appendChild(empty);
    if (historyStatsSubtitle) historyStatsSubtitle.textContent = "0 files converted · 0 B saved";
    return;
  }
  let totalInput = 0;
  let totalOutput = 0;
  history.forEach((h) => {
    totalInput += (h.inputSize || 0);
    totalOutput += (h.outputSize || 0);

    const item = document.createElement("div");
    item.className = "history-item";

    const info = document.createElement("div");
    info.className = "history-item-info";
    const name = document.createElement("strong");
    name.textContent = h.outputName || h.name;
    const details = document.createElement("small");
    const diff = (h.inputSize || 0) - (h.outputSize || 0);
    const dateStr = new Date(h.timestamp || Date.now()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    details.textContent = `${formatBytes(h.inputSize || 0)} → ${formatBytes(h.outputSize || 0)} (${h.mode.toUpperCase()}) · ${dateStr}`;
    info.append(name, details);

    const badge = document.createElement("span");
    badge.className = "savings-badge";
    if (diff > 0) {
      const pct = Math.round((diff / (h.inputSize || 1)) * 100);
      badge.textContent = `-${pct}% (${formatBytes(diff)})`;
    } else {
      badge.textContent = "Converted";
    }

    item.append(info, badge);
    historyList.append(item);
  });

  const netSaved = Math.max(0, totalInput - totalOutput);
  if (historyStatsSubtitle) {
    historyStatsSubtitle.textContent = `${history.length} file${history.length === 1 ? "" : "s"} converted · ${formatBytes(netSaved)} saved`;
  }
}

function openHistoryModal() {
  renderHistoryModal();
  if (historyModal) historyModal.classList.remove("is-hidden");
}

function closeHistoryModal() {
  if (historyModal) historyModal.classList.add("is-hidden");
}

function clearHistory() {
  saveHistoryToStorage([]);
  renderHistoryModal();
  updateHistoryBadge();
  setStatus("Conversion history cleared.");
}

// Saved presets
const PRESETS_KEY = "beetales-converter-presets-v1";

function loadPresetsFromStorage() {
  try { return JSON.parse(localStorage.getItem(PRESETS_KEY) || "[]"); } catch { return []; }
}

function savePresetsToStorage(presets) {
  try { localStorage.setItem(PRESETS_KEY, JSON.stringify(presets)); } catch { /* storage disabled */ }
}

function renderPresets() {
  const dict = translations[currentLang] || translations.en;
  const presets = loadPresetsFromStorage();
  presetsList.replaceChildren();
  if (!presets.length) {
    const hint = document.createElement("span");
    hint.className = "presets-empty-hint";
    hint.textContent = dict.no_presets || "No saved presets yet";
    presetsList.appendChild(hint);
    return;
  }
  presets.forEach((preset, index) => {
    const pill = document.createElement("div");
    pill.className = "preset-pill";
    pill.setAttribute("role", "listitem");

    const applyBtn = document.createElement("button");
    applyBtn.type = "button";
    applyBtn.className = "preset-apply";
    applyBtn.textContent = preset.name;
    applyBtn.title = `Apply preset: ${preset.name}`;
    applyBtn.addEventListener("click", () => applyPreset(preset));

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "preset-delete";
    deleteBtn.setAttribute("aria-label", `Delete preset "${preset.name}"`);
    deleteBtn.textContent = "×";
    deleteBtn.addEventListener("click", () => {
      const updated = loadPresetsFromStorage().filter((_, i) => i !== index);
      savePresetsToStorage(updated);
      renderPresets();
    });

    pill.append(applyBtn, deleteBtn);
    presetsList.append(pill);
  });
}

function toggleSavePresetInput() {
  const hidden = savePresetInline.classList.toggle("is-hidden");
  if (!hidden) { presetNameInput.value = ""; presetNameInput.focus(); }
}

function hideSavePresetInput() {
  savePresetInline.classList.add("is-hidden");
  presetNameInput.value = "";
}

function confirmSavePreset() {
  const name = presetNameInput.value.trim();
  if (!name) { presetNameInput.focus(); return; }
  const preset = {
    name,
    mode:        getCheckedValue("mode"),
    format:      getCheckedValue("format"),
    bitrate:     getCheckedValue("bitrate"),
    gifOutput:   getCheckedValue("gif-output"),
    quality:     videoQuality.value,
    resolution:  videoResolution.value,
    gifWidth:    gifWidth.value,
    gifFps:      gifFps.value,
    speed:       videoSpeed?.value ?? "1",
    gifSpeedVal: gifSpeed?.value ?? "1",
    loudness:    loudnessNormalize?.checked ?? false,
    mp4Audio:    mp4AudioTrack?.value ?? "stereo",
    mp4Filter:   mp4ColorFilter?.value ?? "none",
    karaokePreset: activePresetId,
    karaokeFont: karaokeFontFamily?.value,
    karaokeSize: karaokeFontSize?.value,
    karaokeColor: karaokePrimaryColor?.value,
    karaokeActiveColor: karaokeActiveColor?.value,
    karaokePos: karaokePosition?.value,
    karaokeUpper: karaokeUppercase?.checked ?? true,
  };
  const all = loadPresetsFromStorage();
  const existing = all.findIndex((p) => p.name === name);
  if (existing >= 0) all[existing] = preset; else all.push(preset);
  savePresetsToStorage(all);
  renderPresets();
  hideSavePresetInput();
  setStatus(`Preset "${name}" saved.`);
}

function applyPreset(preset) {
  if (preset.mode)      setCheckedValue("mode", preset.mode);
  if (preset.format)    setCheckedValue("format", preset.format);
  if (preset.bitrate)   setCheckedValue("bitrate", preset.bitrate);
  if (preset.gifOutput) setCheckedValue("gif-output", preset.gifOutput);
  setSelectValue(videoQuality,  preset.quality);
  setSelectValue(videoResolution, preset.resolution);
  setSelectValue(gifWidth, preset.gifWidth);
  setSelectValue(gifFps,   preset.gifFps);
  if (videoSpeed && preset.speed)             setSelectValue(videoSpeed, preset.speed);
  if (gifSpeed   && preset.gifSpeedVal)       setSelectValue(gifSpeed,   preset.gifSpeedVal);
  if (loudnessNormalize) loudnessNormalize.checked = !!preset.loudness;
  if (mp4AudioTrack && preset.mp4Audio)       setSelectValue(mp4AudioTrack, preset.mp4Audio);
  if (mp4ColorFilter && preset.mp4Filter)     setSelectValue(mp4ColorFilter, preset.mp4Filter);
  if (preset.karaokePreset) applyKaraokePreset(preset.karaokePreset);
  if (karaokeFontFamily && preset.karaokeFont) setSelectValue(karaokeFontFamily, preset.karaokeFont);
  if (karaokeFontSize && preset.karaokeSize) setSelectValue(karaokeFontSize, preset.karaokeSize);
  if (karaokePrimaryColor && preset.karaokeColor) karaokePrimaryColor.value = preset.karaokeColor;
  if (karaokeActiveColor && preset.karaokeActiveColor) karaokeActiveColor.value = preset.karaokeActiveColor;
  if (karaokePosition && preset.karaokePos) setSelectValue(karaokePosition, preset.karaokePos);
  if (karaokeUppercase && preset.karaokeUpper !== undefined) karaokeUppercase.checked = preset.karaokeUpper;

  updateModeUI({ resetFiles: false });
  savePreferences();
  setStatus(`Preset "${preset.name}" applied.`);
}

// Share URL generation & parsing
function generateShareUrl() {
  const params = new URLSearchParams();
  const mode = getMode();
  params.set("mode", mode);
  if (mode === "audio") {
    params.set("format", getCheckedValue("format"));
    params.set("bitrate", getCheckedValue("bitrate"));
    if (loudnessNormalize?.checked) params.set("loudness", "1");
  } else if (mode === "mp4") {
    params.set("quality", videoQuality.value);
    params.set("res", videoResolution.value);
    if (videoSpeed?.value && videoSpeed.value !== "1") params.set("speed", videoSpeed.value);
    if (mp4AudioTrack?.value && mp4AudioTrack.value !== "stereo") params.set("audio", mp4AudioTrack.value);
    if (mp4ColorFilter?.value && mp4ColorFilter.value !== "none") params.set("filter", mp4ColorFilter.value);
  } else if (mode === "gif") {
    params.set("gif_out", getCheckedValue("gif-output"));
    params.set("width", gifWidth.value);
    params.set("fps", gifFps.value);
    if (gifSpeed?.value && gifSpeed.value !== "1") params.set("speed", gifSpeed.value);
  } else if (mode === "karaoke") {
    params.set("k_preset", activePresetId);
  }
  const url = new URL(window.location.href);
  url.search = params.toString();
  return url.toString();
}

async function handleShareConfig() {
  const shareUrl = generateShareUrl();
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(shareUrl);
    } else {
      const input = document.createElement("input");
      input.value = shareUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
    }
    const textSpan = document.getElementById("share-config-text");
    if (textSpan) textSpan.textContent = "Link copied!";
    if (shareConfigButton) shareConfigButton.classList.add("is-copied");
    setStatus("Configuration link copied to clipboard.");
    setTimeout(() => {
      if (textSpan) textSpan.textContent = "Share link";
      if (shareConfigButton) shareConfigButton.classList.remove("is-copied");
    }, 2500);
  } catch {
    prompt("Copy this configuration link:", shareUrl);
  }
}

function applyUrlParams() {
  const search = window.location.search;
  if (!search) return;
  try {
    const params = new URLSearchParams(search);
    const mode = params.get("mode");
    if (mode && ["audio", "mp4", "gif", "karaoke"].includes(mode)) {
      setCheckedValue("mode", mode);
    }
    if (params.has("format")) setCheckedValue("format", params.get("format"));
    if (params.has("bitrate")) setCheckedValue("bitrate", params.get("bitrate"));
    if (params.has("loudness") && loudnessNormalize) loudnessNormalize.checked = params.get("loudness") === "1";
    if (params.has("quality")) setSelectValue(videoQuality, params.get("quality"));
    if (params.has("res")) setSelectValue(videoResolution, params.get("res"));
    if (params.has("speed")) {
      if (videoSpeed) setSelectValue(videoSpeed, params.get("speed"));
      if (gifSpeed) setSelectValue(gifSpeed, params.get("speed"));
    }
    if (params.has("audio") && mp4AudioTrack) setSelectValue(mp4AudioTrack, params.get("audio"));
    if (params.has("filter") && mp4ColorFilter) setSelectValue(mp4ColorFilter, params.get("filter"));
    if (params.has("gif_out")) setCheckedValue("gif-output", params.get("gif_out"));
    if (params.has("width")) setSelectValue(gifWidth, params.get("width"));
    if (params.has("fps")) setSelectValue(gifFps, params.get("fps"));
    if (params.has("k_preset")) applyKaraokePreset(params.get("k_preset"));

    savePreferences();
    setStatus("Configuration loaded from URL link.");
  } catch {
    /* ignore malformed url params */
  }
}

// Frame snapshot
function saveCurrentFrame() {
  if (!videoPreview.videoWidth || !videoPreview.videoHeight) return;
  const canvas = document.createElement("canvas");
  canvas.width  = videoPreview.videoWidth;
  canvas.height = videoPreview.videoHeight;
  canvas.getContext("2d").drawImage(videoPreview, 0, 0);
  canvas.toBlob((blob) => {
    if (!blob) return;
    const t    = videoPreview.currentTime;
    const mins = String(Math.floor(t / 60)).padStart(2, "0");
    const secs = String(Math.floor(t % 60)).padStart(2, "0");
    const base = selectedFiles[0] ? safeBaseName(selectedFiles[0].name) : "frame";
    const url  = URL.createObjectURL(blob);
    forceDownload(url, `${base}-frame-${mins}m${secs}s.jpg`);
    setTimeout(() => URL.revokeObjectURL(url), 8000);
  }, "image/jpeg", 0.92);
}

function getAtempoChain(speed) {
  const filters = [];
  let s = speed;
  while (s < 0.5 - 1e-9) { filters.push("atempo=0.5"); s /= 0.5; }
  while (s > 2.0 + 1e-9) { filters.push("atempo=2.0"); s /= 2.0; }
  filters.push(`atempo=${s.toFixed(6)}`);
  return filters.join(",");
}

// =====================================================================
// Sprint 5 — Karaoke & Dynamic Subtitles Logic
// =====================================================================

function initKaraokeStudio() {
  if (!karaokeSettings) return;

  // Tabs switching
  if (karaokeTabPaste && karaokeTabImport) {
    karaokeTabPaste.addEventListener("click", () => {
      karaokeTabPaste.classList.add("is-active");
      karaokeTabImport.classList.remove("is-active");
      karaokePanelPaste.classList.remove("is-hidden");
      karaokePanelImport.classList.add("is-hidden");
    });
    karaokeTabImport.addEventListener("click", () => {
      karaokeTabImport.classList.add("is-active");
      karaokeTabPaste.classList.remove("is-active");
      karaokePanelImport.classList.remove("is-hidden");
      karaokePanelPaste.classList.add("is-hidden");
    });
  }

  // Parse lyrics button
  if (karaokePrepareBtn) {
    karaokePrepareBtn.addEventListener("click", () => {
      const text = (karaokeLyricsInput?.value || "").trim();
      if (!text) {
        showError("Please paste some lyrics or script in the text box.");
        karaokeLyricsInput?.focus();
        return;
      }
      clearError();
      const words = splitLyricsIntoWords(text, {
        wordsPerBlock: parseInt(karaokeWordsPerBlock?.value, 10) || 3,
        preserveLineBreaks: true,
      });
      karaokeEngine.setWords(words);
      renderWordChipsQueue();
      setStatus(`Prepared ${words.length} words for synchronization. Play the video and tap Space!`);
    });
  }

  // Subtitle File Import
  if (karaokeFileInput) {
    karaokeFileInput.addEventListener("change", async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const ext = getFileExtension(file.name);
        let words = [];
        if (ext === "lrc") {
          words = parseLrc(text);
        } else if (ext === "srt" || ext === "vtt") {
          words = parseSrt(text);
        } else if (ext === "json") {
          words = JSON.parse(text);
        } else {
          words = parseSrt(text);
        }

        if (!words.length) {
          showError("Could not find timestamped words in the imported file.");
          return;
        }

        karaokeEngine.setWords(words);
        renderWordChipsQueue();
        setStatus(`Imported ${words.length} synced words from "${file.name}".`);
      } catch (err) {
        showError(`Error reading subtitle file: ${err.message}`);
      }
    });
  }

  // Tap-to-Sync Controls
  if (karaokeTapBtn) {
    karaokeTapBtn.addEventListener("click", () => {
      handleSyncTap();
    });
  }

  if (karaokeUndoBtn) {
    karaokeUndoBtn.addEventListener("click", () => {
      if (karaokeEngine.undoTap()) {
        renderWordChipsQueue();
        updateSubtitleOverlay();
      }
    });
  }

  if (karaokeResetBtn) {
    karaokeResetBtn.addEventListener("click", () => {
      karaokeEngine.resetSync();
      renderWordChipsQueue();
      updateSubtitleOverlay();
      setStatus("Sync timestamps reset.");
    });
  }

  // Spacebar hotkey listener for tap-to-sync
  window.addEventListener("keydown", (e) => {
    if (e.code === "Space" && getMode() === "karaoke") {
      const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : "";
      if (activeTag === "textarea" || activeTag === "input") return; // Don't intercept while typing text
      if (karaokeEngine.words.length > 0) {
        e.preventDefault();
        handleSyncTap();
      }
    }
  });

  // Presets selector
  karaokePresetCards.forEach((card) => {
    card.addEventListener("click", () => {
      const presetId = card.dataset.preset;
      applyKaraokePreset(presetId);
    });
  });

  // Custom Controls Listeners
  [karaokeFontFamily, karaokeFontSize, karaokePrimaryColor, karaokeActiveColor, karaokePosition, karaokeUppercase].forEach((control) => {
    if (control) {
      control.addEventListener("input", () => {
        karaokeEngine.setStyle(getActiveKaraokeStyle());
        updateSubtitleOverlay();
        savePreferences();
      });
    }
  });

  // Download buttons
  if (karaokeDlLrc) {
    karaokeDlLrc.addEventListener("click", () => {
      if (!karaokeEngine.words.length) { showError("No words to export."); return; }
      const lrcContent = exportLrc(karaokeEngine.words, { title: selectedFiles[0] ? safeBaseName(selectedFiles[0].name) : "Track" });
      const blob = new Blob([lrcContent], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      forceDownload(url, `${selectedFiles[0] ? safeBaseName(selectedFiles[0].name) : "karaoke"}.lrc`);
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    });
  }

  if (karaokeDlSrt) {
    karaokeDlSrt.addEventListener("click", () => {
      if (!karaokeEngine.words.length) { showError("No words to export."); return; }
      const srtContent = exportSrt(karaokeEngine.words, { uppercase: karaokeUppercase?.checked });
      const blob = new Blob([srtContent], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      forceDownload(url, `${selectedFiles[0] ? safeBaseName(selectedFiles[0].name) : "subtitles"}.srt`);
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    });
  }

  if (karaokeDlAss) {
    karaokeDlAss.addEventListener("click", () => {
      if (!karaokeEngine.words.length) { showError("No words to export."); return; }
      const assContent = exportAss(karaokeEngine.words, getActiveKaraokeStyle());
      const blob = new Blob([assContent], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      forceDownload(url, `${selectedFiles[0] ? safeBaseName(selectedFiles[0].name) : "styled-subtitles"}.ass`);
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    });
  }
}

function handleSyncTap() {
  if (!karaokeEngine.words.length) return;
  const currentTime = videoPreview.currentTime || 0;
  const syncedWord = karaokeEngine.recordTap(currentTime);
  if (syncedWord) {
    renderWordChipsQueue();
    updateSubtitleOverlay();
  } else {
    setStatus("All words in the queue have been synchronized! You can now burn or export.");
  }
}

function getActiveKaraokeStyle() {
  const basePreset = SUBTITLE_PRESETS[activePresetId] || SUBTITLE_PRESETS.tiktok;
  return {
    ...basePreset,
    fontFamily: karaokeFontFamily?.value || basePreset.fontFamily,
    fontSize: parseInt(karaokeFontSize?.value, 10) || basePreset.fontSize,
    primaryColor: karaokePrimaryColor?.value || basePreset.primaryColor,
    activeColor: karaokeActiveColor?.value || basePreset.activeColor,
    position: karaokePosition?.value || basePreset.position,
    uppercase: karaokeUppercase?.checked ?? basePreset.uppercase,
  };
}

function applyKaraokePreset(presetId) {
  const preset = SUBTITLE_PRESETS[presetId];
  if (!preset) return;
  activePresetId = presetId;
  karaokePresetCards.forEach((c) => c.classList.toggle("is-active", c.dataset.preset === presetId));

  if (karaokeFontFamily) setSelectValue(karaokeFontFamily, preset.fontFamily);
  if (karaokeFontSize) setSelectValue(karaokeFontSize, String(preset.fontSize));
  if (karaokePrimaryColor) karaokePrimaryColor.value = preset.primaryColor;
  if (karaokeActiveColor) karaokeActiveColor.value = preset.activeColor;
  if (karaokePosition) setSelectValue(karaokePosition, preset.position);
  if (karaokeUppercase) karaokeUppercase.checked = !!preset.uppercase;

  karaokeEngine.setStyle(getActiveKaraokeStyle());
  updateSubtitleOverlay();
  savePreferences();
}

function renderWordChipsQueue() {
  if (!karaokeWordsQueue) return;
  karaokeWordsQueue.replaceChildren();

  const words = karaokeEngine.words;
  if (!words.length) {
    const hint = document.createElement("p");
    hint.className = "karaoke-empty-hint";
    hint.textContent = "Paste lyrics above and click 'Prepare Words for Sync' to start synchronizing.";
    karaokeWordsQueue.appendChild(hint);
    if (karaokeTapBtn) karaokeTapBtn.disabled = true;
    if (karaokeUndoBtn) karaokeUndoBtn.disabled = true;
    if (karaokeResetBtn) karaokeResetBtn.disabled = true;
    if (karaokeSyncCounter) karaokeSyncCounter.textContent = "0 / 0";
    return;
  }

  if (karaokeTapBtn) karaokeTapBtn.disabled = false;
  if (karaokeUndoBtn) karaokeUndoBtn.disabled = karaokeEngine.currentIndex === 0;
  if (karaokeResetBtn) karaokeResetBtn.disabled = false;

  const syncedCount = words.filter((w) => w.start !== null).length;
  if (karaokeSyncCounter) {
    karaokeSyncCounter.textContent = `${syncedCount} / ${words.length}`;
  }

  let activeChipEl = null;

  words.forEach((w, idx) => {
    const chip = document.createElement("span");
    chip.className = "word-chip";
    if (idx === karaokeEngine.currentIndex) {
      chip.classList.add("is-active");
      activeChipEl = chip;
    } else if (w.start !== null) {
      chip.classList.add("is-synced");
    } else {
      chip.classList.add("is-pending");
    }

    chip.textContent = w.text;

    if (w.start !== null) {
      const timeSpan = document.createElement("span");
      timeSpan.className = "chip-time";
      timeSpan.textContent = formatDuration(w.start);
      chip.appendChild(timeSpan);
    }

    // Click word chip to seek video and set as active word
    chip.addEventListener("click", () => {
      karaokeEngine.currentIndex = idx;
      if (w.start !== null) {
        videoPreview.currentTime = w.start;
      }
      renderWordChipsQueue();
      updateSubtitleOverlay();
    });

    karaokeWordsQueue.appendChild(chip);
  });

  if (activeChipEl) {
    activeChipEl.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }
}

function updateSubtitleOverlay() {
  if (!dynamicSubtitleOverlay || !dynamicSubtitleBox) return;
  if (getMode() !== "karaoke" || !karaokeEngine.words.length) {
    dynamicSubtitleBox.replaceChildren();
    return;
  }

  const currentTime = videoPreview.currentTime || 0;
  const state = karaokeEngine.getActiveRenderState(currentTime);
  const style = getActiveKaraokeStyle();

  // Position class on overlay
  dynamicSubtitleOverlay.className = `dynamic-subtitle-overlay pos-${style.position}`;

  if (!state || !state.blockWords || !state.blockWords.length) {
    dynamicSubtitleBox.replaceChildren();
    return;
  }

  dynamicSubtitleBox.replaceChildren();

  state.blockWords.forEach((w) => {
    const wordSpan = document.createElement("span");
    wordSpan.className = "sub-word";
    wordSpan.textContent = style.uppercase ? w.text.toUpperCase() : w.text;

    // Apply inline style properties
    wordSpan.style.fontFamily = style.fontFamily;
    wordSpan.style.fontSize = `${style.fontSize}px`;
    wordSpan.style.webkitTextStroke = `${style.strokeWidth}px ${style.strokeColor}`;
    wordSpan.style.textShadow = style.glow
      ? `0 0 16px ${style.activeColor}, 0 4px 8px rgba(0,0,0,0.8)`
      : `0 ${style.shadowDistance}px 10px ${style.shadowColor}`;

    const isCurrentActive = state.activeWord && state.activeWord.id === w.id;
    const isPassed = w.end !== null && currentTime > w.end;

    if (isCurrentActive) {
      wordSpan.classList.add("active");
      wordSpan.style.color = style.activeColor;
    } else if (isPassed) {
      wordSpan.classList.add("passed");
      wordSpan.style.color = style.activeColor;
      wordSpan.style.opacity = "0.9";
    } else {
      wordSpan.classList.add("upcoming");
      wordSpan.style.color = style.primaryColor;
      wordSpan.style.opacity = "0.75";
    }

    dynamicSubtitleBox.appendChild(wordSpan);
  });
}

// =====================================================================
// i18n & User Guide Modal
// =====================================================================

function setLanguage(lang) {
  if (!translations[lang]) lang = "en";
  currentLang = lang;
  document.documentElement.lang = lang;
  if (languageSelect) languageSelect.value = lang;
  try { localStorage.setItem(LANG_KEY, lang); } catch {}

  const dict = translations[lang] || translations.en;
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.dataset.i18n;
    if (dict[key]) {
      el.textContent = dict[key];
    }
  });

  if (presetNameInput) presetNameInput.placeholder = dict.preset_name_placeholder || "Preset name…";
  if (karaokeLyricsInput) karaokeLyricsInput.placeholder = dict.karaoke_lyrics_placeholder || "Paste your lyrics or script here...";

  updateLocalizedModeContent();
  updateModeUI({ resetFiles: false });
  updateHistoryBadge();
  renderPresets();
}

function updateLocalizedModeContent() {
  const dict = translations[currentLang] || translations.en;
  if (modeContent.audio) {
    modeContent.audio.button = dict.btn_convert_audio || "Convert to audio";
    modeContent.audio.empty = dict.status_ready || "Choose a video to get started.";
    modeContent.audio.dropTitle = dict.drop_title_audio || dict.drop_title || "Select one or more video files";
    modeContent.audio.dropHint = dict.drop_hint_audio || dict.drop_hint || "You can also drag and drop them here";
    modeContent.audio.busy = dict.busy_audio || "Extracting audio...";
    modeContent.audio.ready = dict.ready_audio || "video(s) ready for audio extraction.";
  }
  if (modeContent.mp4) {
    modeContent.mp4.button = dict.btn_convert_mp4 || "Convert to MP4";
    modeContent.mp4.empty = dict.status_ready || "Choose a video to get started.";
    modeContent.mp4.dropTitle = dict.drop_title_mp4 || "Select WebM or MP4 videos";
    modeContent.mp4.dropHint = dict.drop_hint_mp4 || "Drop .webm or .mp4 files here or choose them from your device";
    modeContent.mp4.busy = dict.busy_mp4 || "Converting to MP4...";
    modeContent.mp4.ready = dict.ready_mp4 || "video(s) ready for MP4 conversion or optimization.";
  }
  if (modeContent.gif) {
    modeContent.gif.button = dict.btn_convert_gif || "Convert to GIF";
    modeContent.gif.empty = dict.status_ready || "Choose a video to get started.";
    modeContent.gif.dropTitle = dict.drop_title_gif || "Select videos for GIF";
    modeContent.gif.dropHint = dict.drop_hint_gif || "Choose a short clip with Trim for the best result";
    modeContent.gif.busy = dict.busy_gif || "Creating GIF...";
    modeContent.gif.ready = dict.ready_gif || "video(s) ready for GIF creation.";
  }
  if (modeContent.karaoke) {
    modeContent.karaoke.button = dict.btn_convert_karaoke || "Burn & Export MP4";
    modeContent.karaoke.empty = dict.status_ready || "Select video or audio to start Karaoke & Subtitles.";
    modeContent.karaoke.dropTitle = dict.drop_title_karaoke || "Select video or audio for Karaoke / Subtitles";
    modeContent.karaoke.dropHint = dict.drop_hint_karaoke || "Upload your video or song, then paste lyrics below to sync";
    modeContent.karaoke.busy = dict.busy_karaoke || "Generating subtitled video...";
    modeContent.karaoke.ready = dict.ready_karaoke || "video(s) ready for subtitle creation & burning.";
  }
}

function openGuideModal() {
  if (guideModal) guideModal.classList.remove("is-hidden");
}

function closeGuideModal() {
  if (guideModal) guideModal.classList.add("is-hidden");
}

if (languageSelect) {
  languageSelect.addEventListener("change", (e) => {
    setLanguage(e.target.value);
  });
}

if (guideToggle) guideToggle.addEventListener("click", openGuideModal);
if (guideClose) guideClose.addEventListener("click", closeGuideModal);
if (guideCloseBtn) guideCloseBtn.addEventListener("click", closeGuideModal);
if (guideBackdrop) guideBackdrop.addEventListener("click", closeGuideModal);

window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeGuideModal();
    closeHistoryModal();
  }
});

guideTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    guideTabs.forEach((t) => {
      t.classList.remove("is-active");
      t.setAttribute("aria-selected", "false");
    });
    guidePanes.forEach((p) => p.classList.remove("is-active"));
    tab.classList.add("is-active");
    tab.setAttribute("aria-selected", "true");
    const targetPane = document.getElementById(`pane-${tab.dataset.tab}`);
    if (targetPane) targetPane.classList.add("is-active");
  });
});
