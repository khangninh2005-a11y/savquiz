import { Hono } from 'hono';
import { getBody, verifyPassword, hashPassword, requireAuth } from '../utils';

export const authRouter = new Hono<{ Bindings: { DB: D1Database } }>();

const loginHandler = async (c: any) => {
  const db: D1Database = c.env.DB;
  const body = await getBody(c);
  const username = String(body.username || '').trim();
  const email = String(body.email || '').trim();
  const passwordRaw = String(body.passworde || body.password || '');

  if (!passwordRaw) {
    return c.json({ status: 'failed', message: 'Password missing' });
  }
  if (!username && !email) {
    return c.json({ status: 'failed', message: 'Username or Email missing' });
  }

  const user = await db
    .prepare(`
      SELECT u.id, u.username, u.password, u.email, u.full_name, u.account_type_id, u.group_ids, u.created_time,
             a.account_name, a.access_permissions
      FROM sq_user u
      JOIN sq_account_type a ON u.account_type_id = a.id
      WHERE (u.username = ? OR u.email = ?) AND u.trash_status = 0
    `)
    .bind(username || email, email || username)
    .first<any>();

  if (!user || !verifyPassword(passwordRaw, user.password)) {
    return c.json({ status: 'failed', message: 'Invalid username or password' });
  }

  // Auto-upgrade legacy password hash to modern scrypt hash
  if (!user.password.startsWith('scrypt:')) {
    const modernHash = hashPassword(passwordRaw);
    try {
      await db.prepare('UPDATE sq_user SET password = ? WHERE id = ?').bind(modernHash, user.id).run();
    } catch {}
  }

  const randPrefix = Math.floor(100 + Math.random() * 900);
  const userToken = `${randPrefix}-${user.id}-${Math.floor(Date.now() / 1000)}`;

  await db.prepare('UPDATE sq_user SET user_token = ? WHERE id = ?').bind(userToken, user.id).run();

  delete user.password;
  user.user_token = userToken;

  return c.json({
    status: 'success',
    message: 'Login success',
    data: user,
  });
};

authRouter.post('/login', loginHandler);
authRouter.post('/login/index', loginHandler);

authRouter.post('/commondata/validateToken', async (c) => {
  const user = await requireAuth(c, c.env.DB);
  if (!user) {
    return c.text('failed', 401);
  }
  return c.text('success');
});

authRouter.post('/login/resetPassword', async (c) => {
  const db: D1Database = c.env.DB;
  const body = await getBody(c);
  const email = body.email;
  if (!email) {
    return c.json({ status: 'failed', message: 'Email required' });
  }

  const user = await db.prepare('SELECT id, email FROM sq_user WHERE email = ? AND trash_status = 0').bind(email).first<any>();
  if (!user) {
    return c.json({ status: 'failed', message: 'Account not found with given email address' });
  }

  const newPwd = Math.floor(100000 + Math.random() * 900000).toString();
  const modernHash = hashPassword(newPwd);
  await db.prepare('UPDATE sq_user SET password = ? WHERE id = ?').bind(modernHash, user.id).run();

  return c.json({
    status: 'success',
    message: `Password has been reset to: ${newPwd} (Vui lòng lưu lại để đăng nhập)`,
  });
});

authRouter.post('/user/clearToken', async (c) => {
  const user = await requireAuth(c, c.env.DB);
  if (!user) return c.json({ status: 'failed', message: 'Unauthorized' }, 401);

  await c.env.DB.prepare('UPDATE sq_user SET user_token = ? WHERE id = ?').bind(`logout-${Math.floor(Date.now() / 1000)}`, user.id).run();
  return c.json({ status: 'success', message: 'Logged out successfully' });
});

authRouter.post('/user/myInfo', async (c) => {
  const user = await requireAuth(c, c.env.DB);
  if (!user) return c.json({ status: 'failed', message: 'Unauthorized' }, 401);
  return c.json({ status: 'success', data: [user] });
});
