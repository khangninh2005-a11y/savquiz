import Fastify from 'fastify';
import cors from '@fastify/cors';
import formbody from '@fastify/formbody';
import multipart from '@fastify/multipart';
import staticFiles from '@fastify/static';
import { seedData } from './db/seed.js';
import { authRoutes } from './routes/auth.routes.js';
import { userRoutes } from './routes/user.routes.js';
import { qbankRoutes } from './routes/qbank.routes.js';
import { quizRoutes } from './routes/quiz.routes.js';
import { resultRoutes } from './routes/result.routes.js';
import { uploadRoutes } from './routes/upload.routes.js';
import { mmlRoutes } from './routes/mml.routes.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const fastify = Fastify({
  logger: true,
});

async function main() {
  // 1. Initialize schema & seed initial data
  seedData();

  // Ensure uploads directory exists
  const uploadsDir = path.resolve(process.cwd(), 'data/uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  // 2. Plugins
  await fastify.register(cors, {
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Range'],
    exposedHeaders: ['Content-Range', 'Accept-Ranges', 'Content-Length'],
  });

  await fastify.register(formbody);
  await fastify.register(multipart, {
    limits: {
      fileSize: 25 * 1024 * 1024, // 25 MB max file size
    },
  });

  // Serve uploaded files statically at /uploads/
  await fastify.register(staticFiles, {
    root: uploadsDir,
    prefix: '/uploads/',
    decorateReply: false,
  });

  // Redirect /api/uploads/:filename to /uploads/:filename for API clients
  fastify.get('/api/uploads/:filename', async (req: any, reply) => {
    return reply.redirect(`/uploads/${req.params.filename}`, 302);
  });

  // Register mml2svg service for Wiris
  await fastify.register(mmlRoutes, { prefix: '/mml2svg' });

  // 3. Register routes with /api prefix
  await fastify.register(async (api) => {
    await api.register(authRoutes);
    await api.register(userRoutes);
    await api.register(qbankRoutes);
    await api.register(quizRoutes);
    await api.register(resultRoutes);
    await api.register(uploadRoutes);
  }, { prefix: '/api' });


  // Health check
  fastify.get('/health', async () => ({ status: 'ok', time: new Date().toISOString() }));

  // 4. Serve React client static files (production mode)
  // Resolve path to client/dist relative to this file's location
  // In dev: __dirname = server/src → client/dist is ../../client/dist
  // In prod (compiled): __dirname = server/dist → client/dist is ../../client/dist
  const clientDistPath = path.resolve(__dirname, '../../client/dist');
  const clientDistExists = fs.existsSync(clientDistPath);

  if (clientDistExists) {
    // Serve static assets (JS, CSS, images, etc.)
    await fastify.register(staticFiles, {
      root: clientDistPath,
      prefix: '/',
      decorateReply: false,
    });

    // SPA fallback: any non-API route returns index.html
    // This lets React Router handle client-side navigation
    fastify.setNotFoundHandler((_req, reply) => {
      const indexPath = path.join(clientDistPath, 'index.html');
      reply.type('text/html').send(fs.readFileSync(indexPath));
    });

    console.log(`\n📁 Serving React client from: ${clientDistPath}`);
  } else {
    console.log(`\n⚠️  Client dist not found at: ${clientDistPath}`);
    console.log(`   Run "npm run build --prefix client" to build the client first.\n`);
  }

  const PORT = Number(process.env.PORT) || 8000;
  const HOST = process.env.HOST || '0.0.0.0';

  try {
    const address = await fastify.listen({ port: PORT, host: HOST });
    console.log(`\n🚀 Savquiz Server running at ${address}`);
    if (clientDistExists) {
      console.log(`🌐 Open: http://localhost:${PORT}`);
    }
    console.log(`📦 SQLite database: server/data/savquiz.db\n`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

main();
