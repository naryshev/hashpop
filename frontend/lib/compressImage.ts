import imageCompression from "browser-image-compression";

const MAX_SIZE_MB = 1.8;
const MAX_WIDTH_OR_HEIGHT = 1920;
const DEFAULT_QUALITY = 0.85;

export interface CompressOptions {
  maxSizeMB?: number;
  maxWidthOrHeight?: number;
  initialQuality?: number;
}

/**
 * Compress an image file before upload to stay under size limit and speed up uploads.
 */
export async function compressImage(
  file: File,
  options: CompressOptions = {}
): Promise<File> {
  const opts = {
    maxSizeMB: options.maxSizeMB ?? MAX_SIZE_MB,
    maxWidthOrHeight: options.maxWidthOrHeight ?? MAX_WIDTH_OR_HEIGHT,
    initialQuality: options.initialQuality ?? DEFAULT_QUALITY,
    useWebWorker: true,
    fileType: file.type as "image/jpeg" | "image/png" | "image/webp" | undefined,
  };
  try {
    const compressed = await imageCompression(file, opts);
    return compressed;
  } catch (e) {
    console.warn("Compression failed, using original file", e);
    return file;
  }
}
