import { FFmpeg } from "./vendor/ffmpeg/ffmpeg/index.js";
import { fetchFile } from "./vendor/ffmpeg/util/index.js";

const form = document.querySelector("#converter-form");
const fileInput = document.querySelector("#video-file");
const dropZone = document.querySelector("#drop-zone");
const dropTitle = document.querySelector("#drop-title");
const dropHint = document.querySelector("#drop-hint");
const fileCard = document.querySelector("#file-card");
const fileName = document.querySelector("#file-name");
const fileSize = document.querySelector("#file-size");
const convertButton = document.querySelector("#convert-button");
const downloadLink = document.querySelector("#download-link");
const openLink = document.querySelector("#open-link");
const progressBar = document.querySelector("#progress-bar");
const statusMessage = document.querySelector("#status-message");
const errorMessage = document.querySelector("#error-message");
const audioSettings = document.querySelector("#audio-settings");
const mp4Note = document.querySelector("#mp4-note");
const modeInputs = document.querySelectorAll('input[name="mode"]');

const ffmpeg = new FFmpeg();
let ffmpegReady = false;
let ffmpegLoadPromise = null;
let selectedFile = null;
let audioUrl = null;

const FFMPEG_LOAD_TIMEOUT_MS = 60000;
const ffmpegCoreURL = localAssetURL("./vendor/ffmpeg/core/ffmpeg-core.js");
const ffmpegWasmURL = localAssetURL("./vendor/ffmpeg/core/ffmpeg-core.wasm");

const outputMimeTypes = {
  mp3: "audio/mpeg",
  wav: "audio/wav",
  aac: "audio/aac",
  mp4: "video/mp4",
};

const audioOutputArgs = {
  mp3: ["-vn", "-map", "0:a:0", "-codec:a", "libmp3lame", "-f", "mp3"],
  wav: ["-vn", "-map", "0:a:0", "-codec:a", "pcm_s16le", "-f", "wav"],
  aac: ["-vn", "-map", "0:a:0", "-codec:a", "aac", "-f", "adts"],
};

const modeContent = {
  audio: {
    button: "Convert to audio",
    busy: "Extracting audio...",
    ready: "Video ready for audio extraction.",
    empty: "Choose a video to get started.",
    dropTitle: "Select a video file",
    dropHint: "You can also drag and drop it here",
    accept: "video/*,.webm",
    download: "Download audio",
  },
  mp4: {
    button: "Convert WebM to MP4",
    busy: "Converting to MP4...",
    ready: "WebM video ready for MP4 conversion.",
    empty: "Choose a WebM video to get started.",
    dropTitle: "Select a WebM video",
    dropHint: "Drop a .webm file here or choose one from your device",
    accept: "video/webm,.webm",
    download: "Download MP4",
  },
};

ffmpeg.on("progress", ({ progress }) => {
  if (!Number.isFinite(progress)) return;

  const percent = Math.min(100, Math.max(0, Math.round(progress * 100)));
  setProgress(percent);
  setStatus(`Converting... ${percent}%`);
});

fileInput.addEventListener("change", () => {
  handleFile(fileInput.files?.[0]);
});

modeInputs.forEach((input) => {
  input.addEventListener("change", () => {
    updateModeUI({ resetFile: true });
  });
});

dropZone.addEventListener("dragover", (event) => {
  event.preventDefault();
  dropZone.classList.add("is-dragging");
});

dropZone.addEventListener("dragleave", () => {
  dropZone.classList.remove("is-dragging");
});

dropZone.addEventListener("drop", (event) => {
  event.preventDefault();
  dropZone.classList.remove("is-dragging");
  handleFile(event.dataTransfer.files?.[0]);
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  await convertSelectedVideo();
});

downloadLink.addEventListener("click", (event) => {
  if (!audioUrl || !downloadLink.download) return;

  event.preventDefault();
  forceDownload(audioUrl, downloadLink.download);
  setStatus(`Download started for ${downloadLink.download}. If it does not appear, use Open converted file.`);
});

window.addEventListener("beforeunload", resetDownload);
updateModeUI({ resetFile: false });

function handleFile(file) {
  const mode = getMode();

  clearError();
  resetDownload();
  setProgress(0);

  if (!file) {
    selectedFile = null;
    fileCard.classList.add("is-hidden");
    setStatus(modeContent[mode].empty);
    return;
  }

  if (!isValidFileForMode(file, mode)) {
    selectedFile = null;
    fileInput.value = "";
    fileCard.classList.add("is-hidden");
    showError(getValidationMessage(mode));
    setStatus(mode === "mp4" ? "Select a valid WebM video file." : "Select a valid video file.");
    return;
  }

  selectedFile = file;
  fileName.textContent = file.name;
  fileSize.textContent = formatBytes(file.size);
  fileCard.classList.remove("is-hidden");
  setStatus(modeContent[mode].ready);
}

async function convertSelectedVideo() {
  const mode = getMode();

  clearError();
  resetDownload();
  setProgress(0);

  if (!selectedFile) {
    showError(mode === "mp4" ? "Please select a WebM video file first." : "Please select a video file first.");
    return;
  }

  if (!isValidFileForMode(selectedFile, mode)) {
    showError(getValidationMessage(mode));
    return;
  }

  const inputName = `input-${Date.now()}.${getFileExtension(selectedFile.name) || "video"}`;
  const outputName = getOutputName(selectedFile.name, mode);
  let wroteInput = false;
  let wroteOutput = false;

  try {
    setBusy(true);
    await loadFfmpeg();

    setStatus("Reading the video in your browser...");
    await ffmpeg.writeFile(inputName, await fetchFile(selectedFile));
    wroteInput = true;

    const args = mode === "mp4" ? getMp4Args(inputName, outputName, "h264") : getAudioArgs(inputName, outputName);

    setStatus(mode === "mp4" ? "Converting WebM to MP4..." : "Extracting audio...");
    let exitCode = await ffmpeg.exec(args);
    if (mode === "mp4" && exitCode !== 0) {
      setStatus("Retrying MP4 conversion with a compatibility encoder...");
      exitCode = await ffmpeg.exec(getMp4Args(inputName, outputName, "mpeg4"));
    }
    if (exitCode !== 0) {
      throw new Error(`ffmpeg-exit-${exitCode}`);
    }
    wroteOutput = true;

    const data = await ffmpeg.readFile(outputName);
    if (!data || data.length === 0) {
      throw new Error("empty-output");
    }

    const blob = new Blob([data], { type: outputMimeTypes[getOutputExtension(mode)] });
    audioUrl = URL.createObjectURL(blob);

    downloadLink.href = audioUrl;
    downloadLink.download = outputName;
    downloadLink.textContent = modeContent[mode].download;
    downloadLink.classList.remove("is-hidden");
    openLink.href = audioUrl;
    openLink.classList.remove("is-hidden");
    setProgress(100);
    setStatus(`Conversion complete. Your file is ready: ${outputName}`);
  } catch (error) {
    console.error(error);
    showError(getFriendlyError(error, mode));
    setStatus("The conversion stopped.");
  } finally {
    await cleanupFiles(
      ...(wroteInput ? [inputName] : []),
      ...(wroteOutput ? [outputName] : []),
    );
    releaseFfmpegMemory();
    setBusy(false);
  }
}

function getAudioArgs(inputName, outputName) {
  const format = getCheckedValue("format");
  const bitrate = getCheckedValue("bitrate");

  return [
    "-hide_banner",
    "-y",
    "-i",
    inputName,
    ...audioOutputArgs[format],
    ...(format === "wav" ? [] : ["-b:a", bitrate]),
    outputName,
  ];
}

function getMp4Args(inputName, outputName, encoder) {
  const videoCodecArgs =
    encoder === "mpeg4"
      ? ["-c:v", "mpeg4", "-q:v", "5"]
      : ["-c:v", "libx264", "-preset", "veryfast", "-crf", "23"];

  return [
    "-hide_banner",
    "-y",
    "-i",
    inputName,
    "-map",
    "0:v:0",
    "-map",
    "0:a:0?",
    ...videoCodecArgs,
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-b:a",
    "160k",
    "-movflags",
    "+faststart",
    "-f",
    "mp4",
    outputName,
  ];
}

async function loadFfmpeg() {
  if (ffmpegReady) return;
  if (ffmpegLoadPromise) return ffmpegLoadPromise;

  ffmpegLoadPromise = loadFfmpegWithFallbacks()
    .then(() => {
      ffmpegReady = true;
    })
    .catch((error) => {
      ffmpegReady = false;
      throw error;
    })
    .finally(() => {
      ffmpegLoadPromise = null;
    });

  return ffmpegLoadPromise;
}

async function loadFfmpegWithFallbacks() {
  setStatus("Loading the local conversion engine. This may take a few seconds...");

  await withTimeout(
    ffmpeg.load({
      coreURL: ffmpegCoreURL,
      wasmURL: ffmpegWasmURL,
    }),
    FFMPEG_LOAD_TIMEOUT_MS,
  );
}

function withTimeout(promise, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      reject(new Error(`timeout-${timeoutMs}`));
    }, timeoutMs);

    promise.then(
      (value) => {
        window.clearTimeout(timeoutId);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timeoutId);
        reject(error);
      },
    );
  });
}

async function cleanupFiles(...paths) {
  await Promise.all(
    paths.map(async (path) => {
      try {
        await ffmpeg.deleteFile(path);
      } catch {
        // The virtual file may not exist if conversion stopped early.
      }
    }),
  );
}

function releaseFfmpegMemory() {
  try {
    ffmpeg.terminate();
  } catch {
    // The worker may already be stopped after a failed load.
  } finally {
    ffmpegReady = false;
    ffmpegLoadPromise = null;
  }
}

function resetDownload() {
  if (audioUrl) {
    URL.revokeObjectURL(audioUrl);
    audioUrl = null;
  }

  downloadLink.removeAttribute("href");
  downloadLink.removeAttribute("download");
  downloadLink.classList.add("is-hidden");
  openLink.removeAttribute("href");
  openLink.classList.add("is-hidden");
}

function forceDownload(url, filename) {
  const temporaryLink = document.createElement("a");
  temporaryLink.href = url;
  temporaryLink.download = filename;
  temporaryLink.rel = "noopener";
  temporaryLink.style.display = "none";
  document.body.appendChild(temporaryLink);
  temporaryLink.click();
  temporaryLink.remove();
}

function updateModeUI({ resetFile }) {
  const mode = getMode();
  const isMp4Mode = mode === "mp4";

  audioSettings.classList.toggle("is-hidden", isMp4Mode);
  mp4Note.classList.toggle("is-hidden", !isMp4Mode);
  fileInput.accept = modeContent[mode].accept;
  dropTitle.textContent = modeContent[mode].dropTitle;
  dropHint.textContent = modeContent[mode].dropHint;
  downloadLink.textContent = modeContent[mode].download;

  if (resetFile) {
    selectedFile = null;
    fileInput.value = "";
    fileCard.classList.add("is-hidden");
    resetDownload();
    clearError();
    setProgress(0);
  }

  setBusy(false);
  setStatus(modeContent[mode].empty);
}

function setBusy(isBusy) {
  const mode = getMode();

  convertButton.disabled = isBusy;
  fileInput.disabled = isBusy;
  modeInputs.forEach((input) => {
    input.disabled = isBusy;
  });
  convertButton.textContent = isBusy ? "Processing..." : modeContent[mode].button;
}

function setProgress(percent) {
  progressBar.style.width = `${percent}%`;
}

function setStatus(message) {
  statusMessage.textContent = message;
}

function showError(message) {
  errorMessage.textContent = message;
  errorMessage.classList.remove("is-hidden");
}

function clearError() {
  errorMessage.textContent = "";
  errorMessage.classList.add("is-hidden");
}

function getFriendlyError(error, mode) {
  const message = String(error?.message || error || "").toLowerCase();

  if (message.includes("worker") || message.includes("securityerror")) {
    return "The browser blocked the conversion engine from loading. Refresh the page and try again.";
  }

  if (message.includes("ffmpeg-load-timeout") || message.includes("timeout") || message.includes("abort")) {
    return "The conversion engine took too long to load. Check your connection and refresh the page to try again.";
  }

  if (message.includes("memory")) {
    return "The browser ran out of memory while processing this video. Try a smaller file or close other tabs before converting.";
  }

  if (mode === "mp4" && message.includes("unknown encoder")) {
    return "This ffmpeg.wasm build cannot encode MP4 video with the required codec. Use a WebM file with a smaller resolution or try audio extraction instead.";
  }

  if (message.includes("audio") || message.includes("stream") || message.includes("map")) {
    return mode === "mp4"
      ? "The WebM file could not be mapped into an MP4 output. Try another WebM file."
      : "No compatible audio track was found in this video. Try another file or a different output format.";
  }

  if (message.includes("ffmpeg-exit")) {
    return mode === "mp4"
      ? "ffmpeg could not convert this WebM file to MP4. Try a smaller WebM file or a different source."
      : "ffmpeg could not extract audio from this video. Make sure the file contains audio and try another output format.";
  }

  if (message.includes("network") || message.includes("fetch")) {
    return "ffmpeg.wasm could not be loaded. Check that the local vendor files are available and try again.";
  }

  if (message.includes("empty-output")) {
    return "The conversion finished without generating a file. Try another output format or source file.";
  }

  return mode === "mp4"
    ? "We could not convert this WebM video to MP4. Try a smaller or different WebM file."
    : "We could not convert this video. Try another output format or a different video file.";
}

function getValidationMessage(mode) {
  if (mode === "mp4") {
    return "Please select a WebM video file. This mode is specifically for converting .webm files to MP4.";
  }

  return "The selected file does not appear to be a video. Try MP4, MOV, WebM, or a similar format.";
}

function getCheckedValue(name) {
  return document.querySelector(`input[name="${name}"]:checked`).value;
}

function getMode() {
  return getCheckedValue("mode");
}

function isValidFileForMode(file, mode) {
  if (mode === "mp4") {
    return isWebmFile(file);
  }

  return isVideoFile(file);
}

function isVideoFile(file) {
  if (file.type.startsWith("video/")) return true;

  const videoExtensions = ["3gp", "avi", "m4v", "mkv", "mov", "mp4", "mpeg", "mpg", "ogv", "webm"];
  return videoExtensions.includes(getFileExtension(file.name));
}

function isWebmFile(file) {
  return file.type === "video/webm" || getFileExtension(file.name) === "webm";
}

function getOutputName(name, mode) {
  const extension = getOutputExtension(mode);
  return `${safeBaseName(name)}.${extension}`;
}

function getOutputExtension(mode) {
  return mode === "mp4" ? "mp4" : getCheckedValue("format");
}

function formatBytes(bytes) {
  if (bytes === 0) return "0 B";

  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** index;
  return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
}

function getFileExtension(name) {
  return name.includes(".") ? name.split(".").pop().toLowerCase() : "";
}

function getBaseName(name) {
  return name.replace(/\.[^/.]+$/, "") || "converted-media";
}

function safeBaseName(name) {
  return (
    getBaseName(name)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "converted-media"
  );
}

function localAssetURL(path) {
  return new URL(path, window.location.href).href;
}
