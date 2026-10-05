import { FastifyInstance } from 'fastify';
import path from 'node:path';
import fs from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { requireAuth } from '../middlewares/auth.js';

export async function uploadRoutes(fastify: FastifyInstance) {
  const uploadsDir = path.resolve(process.cwd(), 'data/uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  // POST /upload/media (Accepts image or audio file)
  fastify.post('/upload/media', async (req, reply) => {
    const user = await requireAuth(req, reply);
    if (!user) return;

    try {
      // Check if multipart
      if (!req.isMultipart()) {
        return reply.send({ status: 'failed', message: 'Request must be multipart/form-data' });
      }

      const data = await req.file();
      if (!data) {
        return reply.send({ status: 'failed', message: 'No file uploaded' });
      }

      const mime = (data.mimetype || '').toLowerCase();
      const ext = path.extname(data.filename || '').toLowerCase();

      const audioExts = ['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac', '.wma', '.webm', '.opus'];
      const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.ico', '.tiff'];

      const isAudio =
        mime.startsWith('audio/') ||
        mime === 'audio/mpeg' ||
        mime === 'audio/mp3' ||
        mime === 'audio/mpg' ||
        mime === 'audio/x-mpeg' ||
        mime === 'audio/x-mp3' ||
        audioExts.includes(ext);

      const isImage =
        mime.startsWith('image/') ||
        imageExts.includes(ext);

      if (!isImage && !isAudio) {
        return reply.send({
          status: 'failed',
          message: `Định dạng file không được hỗ trợ (MIME: ${mime || 'không rõ'}, Đuôi: ${ext || 'không rõ'}). Chỉ chấp nhận file hình ảnh hoặc âm thanh (MP3, WAV, OGG, M4A, AAC...).`,
        });
      }

      const finalExt = ext || (isImage ? '.jpg' : '.mp3');
      const safeName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}${finalExt}`;
      const targetPath = path.join(uploadsDir, safeName);

      await pipeline(data.file, fs.createWriteStream(targetPath));

      const mediaType = isImage ? 'image' : 'audio';
      const mediaUrl = `/uploads/${safeName}`;

      return reply.send({
        status: 'success',
        message: 'Tải file lên thành công',
        data: {
          url: mediaUrl,
          media_type: mediaType,
          original_name: data.filename,
          file_name: safeName,
        },
      });
    } catch (err: any) {
      console.error('Upload media error:', err);
      return reply.send({
        status: 'failed',
        message: `Lỗi khi tải file lên máy chủ: ${err.message || 'Lỗi không xác định'}`,
      });
    }
  });
}
