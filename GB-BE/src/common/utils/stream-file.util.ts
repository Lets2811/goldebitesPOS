import { createReadStream } from 'node:fs';
import { access } from 'node:fs/promises';
import type { Response } from 'express';

/** Whether an uploaded file is still on disk where the database says it is. */
export async function storedFileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Sends an uploaded file as the response. Check storedFileExists first, to
 * answer 404 for a file that is gone: a database can outlive its uploads
 * (restored elsewhere, a volume replaced), and a read stream with nobody
 * listening for its error takes the whole process down.
 */
export function streamStoredFile(
  res: Response,
  path: string,
  headers: Record<string, string>,
): void {
  const stream = createReadStream(path);
  // The file can still vanish or fail between the check and the read.
  stream.on('error', () => {
    if (res.headersSent) {
      res.destroy();
    } else {
      res.status(404).end();
    }
  });
  // Headers go out only once there is something to send, so a failure to
  // open the file is not answered as a 200 with an image type and no image.
  stream.once('open', () => {
    res.set(headers);
    stream.pipe(res);
  });
}
