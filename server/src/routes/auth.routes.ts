import { FastifyInstance } from 'fastify';
import crypto from 'node:crypto';
import { db } from '../db/connection.js';
import { requireAuth } from '../middlewares/auth.js';
import { verifyPassword, hashPassword } from '../utils/password.js';

export async function authRoutes(fastify: FastifyInstance) {
  // POST /login and /login/index
  const loginHandler = async (req: any, reply: any) => {
    const body = (req.body || {}) as Record<string, any>;
    const username = (body.username || '').trim();
    const email = (body.email || '').trim();
    const passwordRaw = body.passworde || body.password;

    if (!passwordRaw) {
      return reply.send({ status: 'failed', message: 'Password missing' });
    }
    if (!username && !email) {
      return reply.send({ status: 'failed', message: 'Username or Email missing' });
    }

    const stmt = db.prepare(`
      SELECT u.id, u.username, u.password, u.email, u.full_name, u.account_type_id, u.group_ids, u.created_time,
             a.account_name, a.access_permissions
      FROM sq_user u
      JOIN sq_account_type a ON u.account_type_id = a.id
      WHERE (u.username = ? OR u.email = ?) AND u.trash_status = 0
    `);

    const user = stmt.get(username || email, email || username) as any;

    if (!user || !verifyPassword(passwordRaw, user.password)) {
      return reply.send({ status: 'failed', message: 'Invalid username or password' });
    }

    // Auto-upgrade legacy password hash to modern scrypt hash
    if (!user.password.startsWith('scrypt:')) {
      const modernHash = hashPassword(passwordRaw);
      try {
        db.prepare('UPDATE sq_user SET password = ? WHERE id = ?').run(modernHash, user.id);
      } catch {}
    }

    const randPrefix = Math.floor(100 + Math.random() * 900);
    const userToken = `${randPrefix}-${user.id}-${Math.floor(Date.now() / 1000)}`;

    db.prepare('UPDATE sq_user SET user_token = ? WHERE id = ?').run(userToken, user.id);

    delete user.password;
    user.user_token = userToken;
    return reply.send({
      status: 'success',
      message: 'Login success',
      data: user,
    });
  };

  fastify.post('/login', loginHandler);
  fastify.post('/login/index', loginHandler);

  // POST /commondata/validateToken
  fastify.post('/commondata/validateToken', async (req, reply) => {
    const user = await requireAuth(req, reply);
    if (!user) return;
    return reply.send('success');
  });

  // POST /login/resetPassword
  fastify.post('/login/resetPassword', async (req, reply) => {
    const body = (req.body || {}) as Record<string, any>;
    const email = body.email;
    if (!email) {
      return reply.send({ status: 'failed', message: 'Email required' });
    }

    const user = db.prepare('SELECT id, email FROM sq_user WHERE email = ? AND trash_status = 0').get(email) as any;
    if (!user) {
      return reply.send({ status: 'failed', message: 'Account not found with given email address' });
    }

    const newPwd = Math.floor(100000 + Math.random() * 900000).toString();
    const modernHash = hashPassword(newPwd);
    db.prepare('UPDATE sq_user SET password = ? WHERE id = ?').run(modernHash, user.id);

    return reply.send({
      status: 'success',
      message: `Password has been reset to: ${newPwd} (Vui lòng lưu lại để đăng nhập)`,
    });
  });

  // POST /user/clearToken (Logout)
  fastify.post('/user/clearToken', async (req, reply) => {
    const user = await requireAuth(req, reply);
    if (!user) return;

    db.prepare('UPDATE sq_user SET user_token = ? WHERE id = ?').run(`logout-${Math.floor(Date.now() / 1000)}`, user.id);
    return reply.send({ status: 'success', message: 'Logged out successfully' });
  });
}
