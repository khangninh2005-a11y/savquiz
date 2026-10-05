import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { ensureSchema } from './db';
import { authRouter } from './routes/auth';
import { userRouter } from './routes/user';
import { qbankRouter } from './routes/qbank';
import { quizRouter } from './routes/quiz';
import { resultRouter } from './routes/result';
import { uploadRouter } from './routes/upload';

export interface Env {
  DB: D1Database;
  BUCKET?: R2Bucket;
  ASSETS: Fetcher;
}

const app = new Hono<{ Bindings: Env }>();

// Enable CORS for all incoming requests
app.use('*', cors());

// Global error handler to always return JSON with 200 instead of crashing with 500
app.onError((err, c) => {
  console.error('Unhandled worker error:', err);
  return c.json(
    {
      status: 'failed',
      message: `Lỗi máy chủ Worker: ${err.message || String(err)}`,
    },
    200
  );
});

// Middleware to ensure D1 database schema and seeds are initialized
app.use('*', async (c, next) => {
  if (c.env.DB) {
    await ensureSchema(c.env.DB);
  } else if (c.req.path.startsWith('/api') && c.req.path !== '/api/health' && c.req.path !== '/api/debug-db') {
    return c.json({
      status: 'failed',
      message: 'Chưa liên kết cơ sở dữ liệu D1. Vui lòng vào Cloudflare Dashboard -> Workers -> Settings -> Bindings -> Thêm D1 Database với Variable Name là DB.',
    });
  }
  await next();
});

// Health check
app.get('/api/health', (c) => {
  return c.json({ status: 'ok', server: 'savquiz-cloudflare-worker' });
});

// Debug DB endpoint
app.get('/api/debug-db', async (c) => {
  if (!c.env.DB) {
    return c.json({ hasDb: false, message: 'c.env.DB is undefined. Please bind D1 in Cloudflare Settings -> Bindings with name DB.' });
  }
  try {
    const { results } = await c.env.DB.prepare('SELECT count(*) as count FROM sq_user').all();
    return c.json({ hasDb: true, results });
  } catch (err: any) {
    return c.json({ hasDb: true, error: err.message || String(err) });
  }
});

// Mount routes under /api
const api = new Hono<{ Bindings: Env }>();
api.route('/', authRouter);
api.route('/', userRouter);
api.route('/', qbankRouter);
api.route('/', quizRouter);
api.route('/', resultRouter);
api.route('/', uploadRouter);

// Support both /api/* and direct /* paths for maximum compatibility
app.route('/api', api);
app.route('/', api);

// Direct /uploads/:filename route
app.route('/', uploadRouter);

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // If request is an API call or upload file request, let Hono handle it
    if (
      url.pathname.startsWith('/api') ||
      url.pathname.startsWith('/login') ||
      url.pathname.startsWith('/user') ||
      url.pathname.startsWith('/qbank') ||
      url.pathname.startsWith('/quiz') ||
      url.pathname.startsWith('/result') ||
      url.pathname.startsWith('/upload') ||
      url.pathname.startsWith('/uploads') ||
      url.pathname.startsWith('/commondata')
    ) {
      return app.fetch(request, env, ctx);
    }

    // Otherwise serve static frontend assets via ASSETS binding (Vite React SPA)
    return env.ASSETS.fetch(request);
  },
};
