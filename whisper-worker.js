// whisper-worker.js — Background Web Worker for Whisper AI Speech Recognition
import { pipeline, env } from "https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2";

// Configure local cache & browser environment
env.allowLocalModels = false;
env.useBrowserCache = true;

class WhisperPipelineSingleton {
  static task = "automatic-speech-recognition";
  static model = "Xenova/whisper-tiny";
  static instance = null;

  static async getInstance(progress_callback = null) {
    if (!this.instance) {
      this.instance = await pipeline(this.task, this.model, {
        quantized: true,
        progress_callback,
      });
    }
    return this.instance;
  }
}

self.addEventListener("message", async (event) => {
  const { type, data, options } = event.data || {};

  if (type === "transcribe") {
    try {
      const transcriber = await WhisperPipelineSingleton.getInstance((prog) => {
        if (prog.status === "progress" && prog.progress !== undefined) {
          self.postMessage({
            type: "progress",
            status: "downloading",
            percent: Math.round(prog.progress),
            file: prog.file || "model.onnx",
          });
        } else if (prog.status === "done") {
          self.postMessage({
            type: "progress",
            status: "loaded",
            file: prog.file || "model",
          });
        }
      });

      const totalEstimatedChunks = Math.max(1, Math.ceil(data.length / (16000 * 25)));
      let chunkCount = 0;

      self.postMessage({
        type: "progress",
        status: "transcribing",
        totalChunks: totalEstimatedChunks,
        percent: 50,
      });

      const targetLanguage = options?.language || "spanish";

      // Execute speech-to-text with word-level timestamps in background thread
      const output = await transcriber(data, {
        return_timestamps: "word",
        chunk_length_s: 30,
        stride_length_s: 5,
        language: targetLanguage,
        task: "transcribe",
        chunk_callback: (chunk) => {
          chunkCount++;
          self.postMessage({
            type: "progress",
            status: "chunk",
            chunkIndex: chunkCount,
            totalChunks: totalEstimatedChunks,
            text: (chunk?.text || "").trim(),
            percent: Math.min(95, Math.round(50 + (chunkCount / totalEstimatedChunks) * 45)),
          });
        },
      });

      self.postMessage({
        type: "complete",
        chunks: output?.chunks || [],
      });
    } catch (err) {
      self.postMessage({
        type: "error",
        error: err.message || String(err),
      });
    }
  }
});
