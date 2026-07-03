import { FFmpeg } from "./vendor/ffmpeg/ffmpeg/index.js";
import { fetchFile } from "./vendor/ffmpeg/util/index.js";

const form = document.querySelector("#converter-form");
const fileInput = document.querySelector("#video-file");
const dropZone = document.querySelector("#drop-zone");
const fileCard = document.querySelector("#file-card");
const fileName = document.querySelector("#file-name");
const fileSize = document.querySelector("#file-size");
const convertButton = document.querySelector("#convert-button");
const downloadLink = document.querySelector("#download-link");
const progressBar = document.querySelector("#progress-bar");
const statusMessage = document.querySelector("#status-message");
const errorMessage = document.querySelector("#error-message");

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
};

const outputArgs = {
  mp3: ["-vn", "-map", "0:a:0", "-codec:a", "libmp3lame", "-f", "mp3"],
  wav: ["-vn", "-map", "0:a:0", "-codec:a", "pcm_s16le", "-f", "wav"],
  aac: ["-vn", "-map", "0:a:0", "-codec:a", "aac", "-f", "adts"],
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

window.addEventListener("beforeunload", resetDownload);

function handleFile(file) {
  clearError();
  resetDownload();
  setProgress(0);

  if (!file) {
    selectedFile = null;
    fileCard.classList.add("is-hidden");
    setStatus("Choose a video to get started.");
    return;
  }

  if (!isVideoFile(file)) {
    selectedFile = null;
    fileInput.value = "";
    fileCard.classList.add("is-hidden");
    showError("The selected file does not appear to be a video. Try MP4, MOV, WebM, or a similar format.");
    setStatus("Select a valid video file.");
    return;
  }

  selectedFile = file;
  fileName.textContent = file.name;
  fileSize.textContent = formatBytes(file.size);
  fileCard.classList.remove("is-hidden");
  setStatus("Video ready to convert.");
}

async function convertSelectedVideo() {
  clearError();
  resetDownload();
  setProgress(0);

  if (!selectedFile) {
    showError("Please select a video file first.");
    return;
  }

  const format = getCheckedValue("format");
  const bitrate = getCheckedValue("bitrate");
  const inputName = `input-${Date.now()}.${getFileExtension(selectedFile.name) || "video"}`;
  const outputName = `${safeBaseName(selectedFile.name)}.${format}`;
  let wroteInput = false;
  let wroteOutput = false;

  try {
    setBusy(true);
    await loadFfmpeg();

    setStatus("Reading the video in your browser...");
    await ffmpeg.writeFile(inputName, await fetchFile(selectedFile));
    wroteInput = true;

    const args = [
      "-hide_banner",
      "-y",
      "-i",
      inputName,
      ...outputArgs[format],
      ...(format === "wav" ? [] : ["-b:a", bitrate]),
      outputName,
    ];

    setStatus("Extracting audio...");
    const exitCode = await ffmpeg.exec(args);
    if (exitCode !== 0) {
      throw new Error(`ffmpeg-exit-${exitCode}`);
    }
    wroteOutput = true;

    const data = await ffmpeg.readFile(outputName);
    if (!data || data.length === 0) {
      throw new Error("empty-output");
    }

    const blob = new Blob([data], { type: outputMimeTypes[format] });
    audioUrl = URL.createObjectURL(blob);

    downloadLink.href = audioUrl;
    downloadLink.download = outputName;
    downloadLink.classList.remove("is-hidden");
    setProgress(100);
    setStatus(`Conversion complete. Your file is ready: ${outputName}`);
  } catch (error) {
    console.error(error);
    showError(getFriendlyError(error));
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
}

function setBusy(isBusy) {
  convertButton.disabled = isBusy;
  fileInput.disabled = isBusy;
  convertButton.textContent = isBusy ? "Processing..." : "Convert to audio";
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

function getFriendlyError(error) {
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

  if (message.includes("audio") || message.includes("stream") || message.includes("map")) {
    return "No compatible audio track was found in this video. Try another file or a different output format.";
  }

  if (message.includes("ffmpeg-exit")) {
    return "ffmpeg could not extract audio from this video. Make sure the file contains audio and try another output format.";
  }

  if (message.includes("network") || message.includes("fetch")) {
    return "ffmpeg.wasm could not be loaded. Check your connection and try again.";
  }

  if (message.includes("empty-output")) {
    return "The conversion finished without generating audio. Try another output format.";
  }

  return "We could not convert this video. Try another output format or a different video file.";
}

function getCheckedValue(name) {
  return document.querySelector(`input[name="${name}"]:checked`).value;
}

function isVideoFile(file) {
  if (file.type.startsWith("video/")) return true;

  const videoExtensions = ["3gp", "avi", "m4v", "mkv", "mov", "mp4", "mpeg", "mpg", "ogv", "webm"];
  return videoExtensions.includes(getFileExtension(file.name));
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
  return name.replace(/\.[^/.]+$/, "") || "converted-audio";
}

function safeBaseName(name) {
  return (
    getBaseName(name)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "converted-audio"
  );
}

function localAssetURL(path) {
  return new URL(path, window.location.href).href;
}
