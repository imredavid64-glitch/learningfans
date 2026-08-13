export const ALLOWED_FILE_MIME_TYPES = [
  // Documents
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/rtf",
  // Plain text / code / data
  "text/plain",
  "text/markdown",
  "text/csv",
  "text/html",
  "application/json",
  "application/xml",
  // Archives
  "application/zip",
  "application/x-7z-compressed",
  "application/x-rar-compressed",
  "application/gzip",
  "application/x-tar",
  // Images
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  // Audio
  "audio/mpeg",
  "audio/wav",
  "audio/ogg",
  "audio/mp4",
  "audio/aac",
  "audio/x-m4a",
  // Video
  "video/mp4",
  "video/webm",
  "video/ogg",
  "video/quicktime",
  "video/x-matroska",
] as const;

export type FileMime = (typeof ALLOWED_FILE_MIME_TYPES)[number];

export type FileCategory =
  | "image"
  | "pdf"
  | "document"
  | "spreadsheet"
  | "presentation"
  | "archive"
  | "audio"
  | "video"
  | "code"
  | "text"
  | "other";

export const FILE_ACCEPT_ATTR =
  ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.rtf,.txt,.md,.csv,.html,.json,.xml,.zip,.7z,.rar,.tar,.gz,.png,.jpg,.jpeg,.webp,.gif,.mp3,.wav,.ogg,.m4a,.aac,.mp4,.webm,.mov,.mkv";

export const ALLOWED_IMAGE_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
] as const;

export function isAllowedFileMime(mime: string): boolean {
  return (ALLOWED_FILE_MIME_TYPES as readonly string[]).includes(mime);
}

export function isAllowedImage(mime: string): boolean {
  return (ALLOWED_IMAGE_MIME_TYPES as readonly string[]).includes(mime);
}

/** Rough category of a MIME type, used for icons, labels and previews. */
export function fileCategory(mime: string): FileCategory {
  if (mime.startsWith("image/")) return "image";
  if (mime === "application/pdf") return "pdf";
  if (mime === "application/msword" || mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || mime === "application/rtf")
    return "document";
  if (mime === "application/vnd.ms-excel" || mime === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    return "spreadsheet";
  if (mime === "application/vnd.ms-powerpoint" || mime === "application/vnd.openxmlformats-officedocument.presentationml.presentation")
    return "presentation";
  if (mime === "application/zip" || mime === "application/x-7z-compressed" || mime === "application/x-rar-compressed" || mime === "application/gzip" || mime === "application/x-tar")
    return "archive";
  if (mime.startsWith("audio/")) return "audio";
  if (mime.startsWith("video/")) return "video";
  if (mime === "application/json" || mime === "application/xml" || mime === "text/html")
    return "code";
  if (mime.startsWith("text/") || mime === "text/csv" || mime === "text/markdown")
    return "text";
  return "other";
}

export const FILE_CATEGORY_LABELS: Record<FileCategory, string> = {
  image: "Image",
  pdf: "PDF",
  document: "Document",
  spreadsheet: "Spreadsheet",
  presentation: "Presentation",
  archive: "Archive",
  audio: "Audio",
  video: "Video",
  code: "Code",
  text: "Text",
  other: "File",
};

export const FILE_CATEGORY_ICONS: Record<FileCategory, string> = {
  image: "🖼️",
  pdf: "📄",
  document: "📝",
  spreadsheet: "📊",
  presentation: "📽️",
  archive: "🗜️",
  audio: "🎵",
  video: "🎬",
  code: "💻",
  text: "📃",
  other: "📁",
};

export function fileLabel(mime: string): string {
  return FILE_CATEGORY_LABELS[fileCategory(mime)];
}

export function fileIcon(mime: string): string {
  return FILE_CATEGORY_ICONS[fileCategory(mime)];
}

/** Short extension for the `accept` input hint / download naming. */
export function fileExtension(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot > 0 ? filename.slice(dot + 1).toLowerCase() : "";
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}