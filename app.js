import { FFmpeg } from "./vendor/ffmpeg/ffmpeg/index.js";
import { fetchFile } from "./vendor/ffmpeg/util/index.js";

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
const videoQuality = $("#video-quality");
const videoResolution = $("#video-resolution");
const trimStart = $("#trim-start");
const trimEnd = $("#trim-end");
const resultsPanel = $("#results-panel");
const resultsList = $("#results-list");
const resultsSummary = $("#results-summary");
const downloadAllButton = $("#download-all");
const modeInputs = document.querySelectorAll('input[name="mode"]');
const preferenceInputs = document.querySelectorAll('input[name="mode"], input[name="format"], input[name="bitrate"], #video-quality, #video-resolution');

const ffmpeg = new FFmpeg();
let ffmpegReady = false;
let ffmpegLoadPromise = null;
let selectedFiles = [];
let resultUrls = [];
let activeFileIndex = 0;
let previewUrl = null;
let cancelRequested = false;
let completedResults = [];
const fileMetadata = new Map();
const fileStates = new Map();

const FFMPEG_LOAD_TIMEOUT_MS = 60000;
const PREFERENCES_KEY = "beetales-converter-preferences-v1";
const ffmpegCoreURL = localAssetURL("./vendor/ffmpeg/core/ffmpeg-core.js");
const ffmpegWasmURL = localAssetURL("./vendor/ffmpeg/core/ffmpeg-core.wasm");
const outputMimeTypes = { mp3: "audio/mpeg", wav: "audio/wav", aac: "audio/aac", mp4: "video/mp4" };
const audioOutputArgs = {
  mp3: ["-vn", "-map", "0:a:0", "-codec:a", "libmp3lame", "-f", "mp3"],
  wav: ["-vn", "-map", "0:a:0", "-codec:a", "pcm_s16le", "-f", "wav"],
  aac: ["-vn", "-map", "0:a:0", "-codec:a", "aac", "-f", "adts"],
};
const modeContent = {
  audio: {
    button: "Convert queue to audio", busy: "Extracting audio...", ready: "video(s) ready for audio extraction.",
    empty: "Choose one or more videos to get started.", dropTitle: "Select one or more video files",
    dropHint: "You can also drag and drop them here", accept: "video/*,.webm", download: "Download audio",
  },
  mp4: {
    button: "Convert queue to MP4", busy: "Converting to MP4...", ready: "video(s) ready for MP4 conversion or optimization.",
    empty: "Choose one or more WebM or MP4 videos to get started.", dropTitle: "Select WebM or MP4 videos",
    dropHint: "Drop .webm or .mp4 files here or choose them from your device", accept: "video/webm,video/mp4,.webm,.mp4", download: "Download MP4",
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
dropZone.addEventListener("dragover", (event) => { event.preventDefault(); dropZone.classList.add("is-dragging"); });
dropZone.addEventListener("dragleave", () => dropZone.classList.remove("is-dragging"));
dropZone.addEventListener("drop", (event) => {
  event.preventDefault();
  dropZone.classList.remove("is-dragging");
  handleFiles(event.dataTransfer.files);
});
clearFilesButton.addEventListener("click", clearSelection);
cancelButton.addEventListener("click", cancelConversion);
downloadAllButton.addEventListener("click", downloadAllResults);
form.addEventListener("submit", async (event) => { event.preventDefault(); await convertQueue(); });
window.addEventListener("beforeunload", () => { resetResults(); resetPreview(); });
restorePreferences();
updateModeUI({ resetFiles: false });

async function handleFiles(fileCollection) {
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
  await Promise.all(selectedFiles.map(loadMediaMetadata));
  renderQueue();
  updatePreviewMetadata(selectedFiles[0]);
}

function renderQueue() {
  fileList.replaceChildren();
  fileCard.classList.toggle("is-hidden", selectedFiles.length === 0);
  if (!selectedFiles.length) return;
  fileName.textContent = `${selectedFiles.length} file${selectedFiles.length === 1 ? "" : "s"} selected`;
  fileSize.textContent = `${formatBytes(selectedFiles.reduce((total, file) => total + file.size, 0))} total`;
  selectedFiles.forEach((file, index) => {
    const item = document.createElement("li");
    const details = document.createElement("span");
    const name = document.createElement("strong");
    const size = document.createElement("small");
    const state = document.createElement("em");
    const remove = document.createElement("button");
    name.textContent = file.name;
    size.textContent = formatBytes(file.size);
    state.textContent = fileStates.get(file) || formatMediaMetadata(fileMetadata.get(file));
    details.append(name, size, state);
    remove.type = "button";
    remove.textContent = "Remove";
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
    item.append(details, remove);
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
  if (!selectedFiles.length) { showError(mode === "mp4" ? "Please select WebM or MP4 video files first." : "Please select video files first."); return; }

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

  const results = [];
  try {
    cancelRequested = false;
    setBusy(true);
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
    if (completed < results.length) showError(`${results.length - completed} file${results.length - completed === 1 ? " could" : "s could"} not be converted. See the results below.`);
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
  setStatus("Cancelling the current conversion...");
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
}

function resetPreview() {
  videoPreview.pause();
  videoPreview.removeAttribute("src");
  videoPreview.load();
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = null;
  previewPanel.classList.add("is-hidden");
}

function loadMediaMetadata(file) {
  return new Promise((resolve) => {
    const probe = document.createElement("video");
    const url = URL.createObjectURL(file);
    const finish = (metadata) => {
      fileMetadata.set(file, metadata);
      fileStates.set(file, formatMediaMetadata(metadata));
      URL.revokeObjectURL(url);
      probe.removeAttribute("src");
      resolve();
    };
    probe.preload = "metadata";
    probe.onloadedmetadata = () => finish({ duration: probe.duration, width: probe.videoWidth, height: probe.videoHeight });
    probe.onerror = () => finish(null);
    probe.src = url;
  });
}

function updatePreviewMetadata(file) {
  if (!file || !previewUrl) return;
  previewMeta.textContent = formatMediaMetadata(fileMetadata.get(file));
}

function formatMediaMetadata(metadata) {
  if (!metadata || !Number.isFinite(metadata.duration)) return "Details unavailable";
  const dimensions = metadata.width && metadata.height ? ` · ${metadata.width}×${metadata.height}` : "";
  return `${formatDuration(metadata.duration)}${dimensions}`;
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
  const token = `${Date.now()}-${index}`;
  const inputName = `input-${token}.${getFileExtension(file.name) || "video"}`;
  const outputName = getOutputName(file.name, mode);
  let wroteInput = false;
  let wroteOutput = false;
  try {
    await ffmpeg.writeFile(inputName, await fetchFile(file));
    wroteInput = true;
    let exitCode = await ffmpeg.exec(mode === "mp4" ? getMp4Args(inputName, outputName, "h264", trim) : getAudioArgs(inputName, outputName, trim));
    if (mode === "mp4" && exitCode !== 0) exitCode = await ffmpeg.exec(getMp4Args(inputName, outputName, "mpeg4", trim));
    if (exitCode !== 0) throw new Error(`ffmpeg-exit-${exitCode}`);
    wroteOutput = true;
    const data = await ffmpeg.readFile(outputName);
    if (!data?.length) throw new Error("empty-output");
    const blob = new Blob([data], { type: outputMimeTypes[getOutputExtension(mode)] });
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
      link.textContent = modeContent[mode].download;
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
  return ["-hide_banner", "-y", ...getTrimInputArgs(trim), "-i", inputName, ...getTrimDurationArgs(trim), ...audioOutputArgs[format], ...(format === "wav" ? [] : ["-b:a", bitrate]), outputName];
}

function getMp4Args(inputName, outputName, encoder, trim) {
  const crf = videoQuality.value;
  const fallbackQuality = crf === "18" ? "3" : crf === "28" ? "8" : "5";
  const videoArgs = encoder === "mpeg4" ? ["-c:v", "mpeg4", "-q:v", fallbackQuality] : ["-c:v", "libx264", "-preset", "veryfast", "-crf", crf];
  const scaleArgs = videoResolution.value === "original" ? [] : ["-vf", `scale=w=-2:h=${videoResolution.value}:force_original_aspect_ratio=decrease`];
  return ["-hide_banner", "-y", ...getTrimInputArgs(trim), "-i", inputName, ...getTrimDurationArgs(trim), "-map", "0:v:0", "-map", "0:a:0?", ...videoArgs, ...scaleArgs, "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", "-f", "mp4", outputName];
}

function getTrimSettings() {
  const start = parseTimeValue(trimStart.value);
  const end = parseTimeValue(trimEnd.value);
  if (start === null || end === null) return { error: "Enter trim times as MM:SS or HH:MM:SS, for example 01:30." };
  if (end !== undefined && end <= (start || 0)) return { error: "End time must be later than start time." };
  return { start, end };
}

function parseTimeValue(value) {
  const clean = value.trim();
  if (!clean) return undefined;
  const parts = clean.split(":");
  if (parts.length < 1 || parts.length > 3 || parts.some((part) => !/^\d+(?:\.\d+)?$/.test(part))) return null;
  if (parts.length > 1 && parts.slice(1).some((part) => Number(part) >= 60)) return null;
  return parts.reduce((seconds, part) => seconds * 60 + Number(part), 0);
}

function getTrimInputArgs(trim) {
  return trim.start !== undefined ? ["-ss", String(trim.start)] : [];
}

function getTrimDurationArgs(trim) {
  if (trim.end === undefined) return [];
  return ["-t", String(trim.end - (trim.start || 0))];
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
    quality: videoQuality.value,
    resolution: videoResolution.value,
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
    setSelectValue(videoQuality, preferences.quality);
    setSelectValue(videoResolution, preferences.resolution);
  } catch { /* Invalid or unavailable storage falls back to defaults. */ }
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
  audioSettings.classList.toggle("is-hidden", isMp4);
  mp4Settings.classList.toggle("is-hidden", !isMp4);
  mp4Note.classList.toggle("is-hidden", !isMp4);
  fileInput.accept = modeContent[mode].accept;
  dropTitle.textContent = modeContent[mode].dropTitle;
  dropHint.textContent = modeContent[mode].dropHint;
  if (resetFiles) clearSelection();
  setBusy(false);
  setStatus(modeContent[mode].empty);
}

function setBusy(busy) {
  convertButton.disabled = busy;
  fileInput.disabled = busy;
  clearFilesButton.disabled = busy;
  videoQuality.disabled = busy;
  videoResolution.disabled = busy;
  trimStart.disabled = busy;
  trimEnd.disabled = busy;
  cancelButton.classList.toggle("is-hidden", !busy);
  cancelButton.disabled = !busy;
  modeInputs.forEach((input) => { input.disabled = busy; });
  convertButton.textContent = busy ? modeContent[getMode()].busy : modeContent[getMode()].button;
}

function getFriendlyError(error, mode) {
  const message = String(error?.message || error || "").toLowerCase();
  if (message.includes("worker") || message.includes("securityerror")) return "The browser blocked the conversion engine. Refresh and try again.";
  if (message.includes("timeout") || message.includes("abort")) return "The conversion engine took too long to load. Refresh and try again.";
  if (message.includes("memory")) return "The browser ran out of memory. Try fewer or smaller files.";
  if (message.includes("empty-output")) return "No output file was generated.";
  if (message.includes("ffmpeg-exit") || message.includes("audio") || message.includes("stream") || message.includes("map")) return mode === "mp4" ? "This video could not be converted or optimized as MP4." : "No compatible audio track was found.";
  return mode === "mp4" ? "This video could not be converted or optimized as MP4." : "This video could not be converted.";
}

function getValidationMessage(mode) { return mode === "mp4" ? "Please select one or more .webm or .mp4 video files." : "The selected files do not appear to be compatible videos."; }
function getCheckedValue(name) { return document.querySelector(`input[name="${name}"]:checked`).value; }
function getMode() { return getCheckedValue("mode"); }
function isValidFileForMode(file, mode) { return mode === "mp4" ? isMp4SourceFile(file) : isVideoFile(file); }
function isVideoFile(file) { return file.type.startsWith("video/") || ["3gp", "avi", "m4v", "mkv", "mov", "mp4", "mpeg", "mpg", "ogv", "webm"].includes(getFileExtension(file.name)); }
function isWebmFile(file) { return file.type === "video/webm" || getFileExtension(file.name) === "webm"; }
function isMp4SourceFile(file) { return isWebmFile(file) || file.type === "video/mp4" || getFileExtension(file.name) === "mp4"; }
function getOutputName(name, mode) { const suffix = mode === "mp4" && getFileExtension(name) === "mp4" ? "-optimized" : ""; return `${safeBaseName(name)}${suffix}.${getOutputExtension(mode)}`; }
function getOutputExtension(mode) { return mode === "mp4" ? "mp4" : getCheckedValue("format"); }
function getSizeComparison(input, output) {
  const difference = input ? Math.round((1 - output / input) * 100) : 0;
  const change = difference >= 0 ? `${difference}% smaller` : `${Math.abs(difference)}% larger`;
  return `${formatBytes(input)} → ${formatBytes(output)} · ${change}`;
}
function formatBytes(bytes) { if (!bytes) return "0 B"; const units = ["B", "KB", "MB", "GB"]; const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1); const value = bytes / 1024 ** index; return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`; }
function formatDuration(seconds) { const total = Math.max(0, Math.floor(seconds)); const hours = Math.floor(total / 3600); const minutes = Math.floor((total % 3600) / 60); const secs = total % 60; return hours ? `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}` : `${minutes}:${String(secs).padStart(2, "0")}`; }
function getFileExtension(name) { return name.includes(".") ? name.split(".").pop().toLowerCase() : ""; }
function safeBaseName(name) { return name.replace(/\.[^/.]+$/, "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "converted-media"; }
function localAssetURL(path) { return new URL(path, window.location.href).href; }
function setProgress(percent) { progressBar.style.width = `${percent}%`; }
function setStatus(message) { statusMessage.textContent = message; }
function showError(message) { errorMessage.textContent = message; errorMessage.classList.remove("is-hidden"); }
function clearError() { errorMessage.textContent = ""; errorMessage.classList.add("is-hidden"); }
