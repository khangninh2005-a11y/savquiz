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

// Middleware to ensure D1 database schema and seeds are initialized
app.use('*', async (c, next) => {
  if (c.env.DB) {
    await ensureSchema(c.env.DB);
  }
  await next();
});

// Health check
app.get('/api/health', (c) => {
  return c.json({ status: 'ok', server: 'savquiz-cloudflare-worker' });
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
