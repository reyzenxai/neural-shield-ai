import Jimp from "jimp";
import jsQR from "jsqr";
import { createWorker, type Worker } from "tesseract.js";

import { logger } from "../utils/logger";

/**
 * Decode a QR code from an image buffer.
 * @returns the decoded text/URL, or null if no QR is found.
 */
export async function decodeQr(buffer: Buffer): Promise<string | null> {
  try {
    const image = await Jimp.read(buffer);
    const { data, width, height } = image.bitmap;
    const result = jsQR(new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength), width, height);
    return result?.data?.trim() || null;
  } catch (err) {
    logger.warn(`QR decode failed: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

// --- OCR: lazy singleton worker, recognitions serialized to avoid concurrency issues ---
let workerPromise: Promise<Worker> | null = null;
let chain: Promise<unknown> = Promise.resolve();

function getWorker(): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = createWorker("eng").catch((err) => {
      workerPromise = null; // allow retry on next call
      throw err;
    });
  }
  return workerPromise;
}

/**
 * Extract text from an image buffer via OCR (Tesseract). The English model is
 * fetched on first use and then cached.
 * @returns the recognized text (may be empty).
 */
export async function ocrImage(buffer: Buffer): Promise<string> {
  const run = chain.then(async () => {
    const worker = await getWorker();
    const { data } = await worker.recognize(buffer);
    return data.text.trim();
  });
  chain = run.catch(() => undefined);
  return run;
}
