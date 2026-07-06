// PDF upload route — T2-I (docs/26 WF-P2-04, validator Q1 pre-resolution):
// exercise PDFs are binary blobs, and tRPC's JSON transport is a poor fit for
// raw file bytes, so this is a plain HTTP route mounted alongside (not
// through) the tRPC router in ../server.ts. It is "multipart" in the sense of
// "a distinct upload transport from tRPC" (phase-03 spec wording) — the
// request body IS the PDF bytes with `Content-Type: application/pdf`, not a
// literal `multipart/form-data` parse (this repo has no multipart-parsing
// dependency, and the spec's own validation criterion — "mime
// application/pdf" — only makes sense against a body whose Content-Type
// really is `application/pdf`, not the `multipart/form-data; boundary=...`
// a real multipart request would carry).
//
// Same dev-auth header + `can()` gate every tRPC procedure uses (../context.ts,
// ../trpc.ts) — this route is NOT a public endpoint.

import type { IncomingMessage, ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import { can } from '@cmc/auth';
import { createBlobStorage } from '@cmc/storage';
import { createContext } from '../context.js';

export const EXERCISE_PDF_UPLOAD_PATH = '/upload/exercise-pdf';

/** docs/26 WF-P2-04: PDF size cap. */
export const MAX_EXERCISE_PDF_BYTES = 10 * 1024 * 1024;

function sendJson(res: ServerResponse, status: number, body: Record<string, unknown>): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(payload);
}

/** Reads the request body, aborting once `limit` bytes is exceeded (before
 * buffering the whole oversized payload into memory). */
async function readBodyWithLimit(req: IncomingMessage, limit: number): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req as AsyncIterable<Buffer>) {
    total += chunk.length;
    if (total > limit) {
      throw new Error('PAYLOAD_TOO_LARGE');
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

/**
 * `POST /upload/exercise-pdf` — writes the request body to `BlobStorage` and
 * returns `{ blobRef }` for `exercise.create`'s `basePdfRef` input. Rejects:
 * no session (401), missing `exercise.manage` permission (403), wrong
 * Content-Type or a body over `MAX_EXERCISE_PDF_BYTES` (400).
 */
export async function handleExercisePdfUpload(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const ctx = createContext({ req });
  if (!ctx.subject) {
    sendJson(res, 401, { error: 'Session required.' });
    return;
  }
  if (!can(ctx.subject, 'exercise', 'manage')) {
    sendJson(res, 403, { error: 'Missing permission exercise.manage.' });
    return;
  }

  const contentType = req.headers['content-type'];
  if (contentType !== 'application/pdf') {
    sendJson(res, 400, { error: 'Content-Type must be application/pdf.' });
    return;
  }

  const declaredLength = Number(req.headers['content-length'] ?? Number.NaN);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_EXERCISE_PDF_BYTES) {
    sendJson(res, 400, { error: `PDF exceeds the ${MAX_EXERCISE_PDF_BYTES}-byte limit.` });
    return;
  }

  let body: Buffer;
  try {
    body = await readBodyWithLimit(req, MAX_EXERCISE_PDF_BYTES);
  } catch {
    sendJson(res, 400, { error: `PDF exceeds the ${MAX_EXERCISE_PDF_BYTES}-byte limit.` });
    return;
  }

  if (body.length === 0) {
    sendJson(res, 400, { error: 'Empty PDF body.' });
    return;
  }

  const blobRef = `exercise-pdf/${randomUUID()}.pdf`;
  // Reads `BLOB_STORAGE_DIR` fresh per request (not cached at module scope) —
  // cheap to construct (no I/O until `.put`) and keeps this route trivially
  // testable against a per-test scratch directory.
  await createBlobStorage().put(blobRef, body, 'application/pdf');

  sendJson(res, 200, { blobRef });
}
