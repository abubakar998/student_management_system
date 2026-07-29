import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Local disk storage for submitted coursework.
 *
 * Files are written outside `public/` deliberately. Anything in `public/` is
 * served by the web server with no authorisation at all, which would let
 * anyone who guessed a filename read another student's work. Downloads go
 * through a route handler that checks the caller first.
 *
 * Kept behind this small interface so swapping in S3 or similar later means
 * changing one file.
 */

const UPLOAD_DIR = process.env.UPLOAD_DIR || "uploads";

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB

/** The brief allows PDF and DOCX only. */
export const ALLOWED_TYPES = {
  "application/pdf": ".pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
} as const;

export type AllowedMime = keyof typeof ALLOWED_TYPES;

export function isAllowedMime(mime: string): mime is AllowedMime {
  return mime in ALLOWED_TYPES;
}

function uploadRoot(): string {
  return path.resolve(process.cwd(), UPLOAD_DIR);
}

export type StoredFile = { storedName: string; sizeBytes: number };

/**
 * Persist an uploaded file under a server-generated name.
 *
 * The client-supplied filename is never used to build the path. A name like
 * `../../.env` would otherwise let an upload escape the directory and
 * overwrite something it should not.
 */
export async function storeSubmissionFile(file: File, mime: AllowedMime): Promise<StoredFile> {
  const root = uploadRoot();
  await mkdir(root, { recursive: true });

  const storedName = `${randomUUID()}${ALLOWED_TYPES[mime]}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(root, storedName), buffer);

  return { storedName, sizeBytes: buffer.byteLength };
}

/** Row exists but the bytes are gone from disk — a 404, not a server fault. */
export class MissingFileError extends Error {
  constructor(storedName: string) {
    super(`Stored file "${storedName}" is not on disk.`);
    this.name = "MissingFileError";
  }
}

export async function readSubmissionFile(storedName: string): Promise<Buffer> {
  const root = uploadRoot();
  const resolved = path.resolve(root, storedName);

  // Belt and braces: even though storedName is server-generated, refuse
  // anything that resolves outside the upload directory.
  if (!resolved.startsWith(root + path.sep)) {
    throw new Error("Refusing to read outside the upload directory.");
  }

  try {
    return await readFile(resolved);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new MissingFileError(storedName);
    }
    throw error;
  }
}

export async function deleteSubmissionFile(storedName: string): Promise<void> {
  try {
    await unlink(path.resolve(uploadRoot(), storedName));
  } catch {
    // A missing file should not block replacing the database row.
  }
}
