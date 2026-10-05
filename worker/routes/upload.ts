import { Hono } from 'hono';
import { requireAuth } from '../utils';

export const uploadRouter = new Hono<{ Bindings: { DB: D1Database; BUCKET?: R2Bucket } }>();

uploadRouter.post('/upload/media', async (c) => {
  const db = c.env.DB;
  const user = await requireAuth(c, db);
  if (!user) return c.json({ status: 'failed', message: 'Unauthorized' }, 401);

  const body = await c.req.parseBody();
  const file = body['file'];

  if (!file || typeof file === 'string') {
    return c.json({ status: 'failed', message: 'No file uploaded' }, 400);
  }

  const uploadedFile = file as File;
  const mime = (uploadedFile.type || 'application/octet-stream').toLowerCase();
  const originalName = uploadedFile.name || 'upload.mp3';
  const ext = originalName.includes('.') ? `.${originalName.split('.').pop()?.toLowerCase()}` : '';

  const safeName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}${ext || '.mp3'}`;
  const arrayBuffer = await uploadedFile.arrayBuffer();

  // 1. If R2 Bucket is available, save directly to R2
  if (c.env.BUCKET) {
    await c.env.BUCKET.put(safeName, arrayBuffer, {
      httpMetadata: { contentType: mime },
    });
  } else {
    // 2. Fallback: Save to D1 table sq_media as Base64
    const uint8Array = new Uint8Array(arrayBuffer);
    let binary = '';
    const len = uint8Array.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(uint8Array[i]);
    }
    const base64 = btoa(binary);

    await db
      .prepare('INSERT INTO sq_media (filename, mime_type, data_base64) VALUES (?, ?, ?)')
      .bind(safeName, mime, base64)
      .run();
  }

  const url = `/uploads/${safeName}`;
  const mediaType = mime.startsWith('audio') ? 'audio' : mime.startsWith('image') ? 'image' : 'file';

  return c.json({
    status: 'success',
    data: {
      url,
      media_type: mediaType,
      file_name: safeName,
    },
  });
});

uploadRouter.get('/uploads/:filename', async (c) => {
  const filename = c.req.param('filename');
  if (!filename) return c.text('Not found', 404);

  // 1. Check R2 Bucket
  if (c.env.BUCKET) {
    const obj = await c.env.BUCKET.get(filename);
    if (obj) {
      const headers = new Headers();
      obj.writeHttpMetadata(headers);
      headers.set('etag', obj.httpEtag);
      headers.set('Cache-Control', 'public, max-age=31536000, immutable');
      return new Response(obj.body, { headers });
    }
  }

  // 2. Check D1 sq_media table
  const row = await c.env.DB
    .prepare('SELECT mime_type, data_base64 FROM sq_media WHERE filename = ?')
    .bind(filename)
    .first<any>();

  if (!row) {
    return c.text('File not found', 404);
  }

  const binaryString = atob(row.data_base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  return new Response(bytes.buffer, {
    headers: {
      'Content-Type': row.mime_type || 'application/octet-stream',
      'Content-Length': String(bytes.byteLength),
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Accept-Ranges': 'bytes',
    },
  });
});
