export function parseTimeValue(value) {
  const clean = value.trim();
  if (!clean) return undefined;
  const parts = clean.split(":");
  if (parts.length < 1 || parts.length > 3 || parts.some((part) => !/^\d+(?:\.\d+)?$/.test(part))) return null;
  if (parts.length > 1 && parts.slice(1).some((part) => Number(part) >= 60)) return null;
  return parts.reduce((seconds, part) => seconds * 60 + Number(part), 0);
}

export function getTrimInputArgs(trim) {
  return trim.start !== undefined ? ["-ss", String(trim.start)] : [];
}

export function getTrimDurationArgs(trim) {
  if (trim.end === undefined) return [];
  return ["-t", String(trim.end - (trim.start || 0))];
}

export function formatBytes(bytes) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** index;
  return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
}

export function formatDuration(seconds) {
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  return hours ? `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}` : `${minutes}:${String(secs).padStart(2, "0")}`;
}

export function getFileExtension(name) {
  return name.includes(".") ? name.split(".").pop().toLowerCase() : "";
}

export function safeBaseName(name) {
  return name
    .replace(/\.[^/.]+$/, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "converted-media";
}
