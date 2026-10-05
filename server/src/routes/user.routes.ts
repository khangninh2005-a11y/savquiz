import { FastifyInstance } from 'fastify';
import { db } from '../db/connection.js';
import { requireAuth, hasPermission } from '../middlewares/auth.js';
import { hashPassword } from '../utils/password.js';

export function parseBodyData(body: Record<string, any>): Record<string, any> {
  const res = { ...body };
  if (body.fData) {
    try {
      const arr = typeof body.fData === 'string' ? JSON.parse(body.fData) : body.fData;
      if (Array.isArray(arr)) {
        const optionTexts: string[] = [];
        const optionScores: number[] = [];

        const optionIds: any[] = [];

        for (const item of arr) {
          if (item && item.name !== undefined) {
            const name = item.name;
            const val = item.value;

            if (name === 'option[]' || name === 'option') {
              optionTexts.push(val);
            } else if (name === 'score[]' || name === 'score') {
              optionScores.push(Number(val) || 0);
            } else if (name === 'option_id[]' || name === 'option_id') {
              optionIds.push(val);
            } else {
              res[name] = val;
            }
          }
        }

        if (optionTexts.length > 0) {
          res['option[]'] = optionTexts;
          res['score[]'] = optionScores;
          res.options = optionTexts.map((text, idx) => ({
            id: optionIds[idx],
            option: text,
            question_option: text,
            score: optionScores[idx] !== undefined ? optionScores[idx] : 0,
          }));
        }
      }
    } catch {
      // Ignore json parse error
    }
  }
  return res;
}

export async function userRoutes(fastify: FastifyInstance) {
  // POST /user/myInfo
  fastify.post('/user/myInfo', async (req, reply) => {
    const user = await requireAuth(req, reply);
    if (!user) return;
    return reply.send({ status: 'success', message: '', data: user });
  });

  // POST /user/getList
  fastify.post('/user/getList', async (req, reply) => {
    const user = await requireAuth(req, reply);
    if (!user) return;

    if (!hasPermission(user, 'userList')) {
      return reply.send({ status: 'failed', message: 'Permission denied' });
    }

    const body = (req.body || {}) as Record<string, any>;
    const search = (body.search || '').trim();
    const id = body.id;
    const limit = Number(body.limit) || 0;
    const maxRowsPerPage = Number(body.maxRowsPerPage) || 30;

    let query = `
      SELECT u.id, u.username, u.email, u.full_name, u.account_type_id, u.group_ids,
             u.trash_status, u.created_time, a.account_name
      FROM sq_user u
      LEFT JOIN sq_account_type a ON u.account_type_id = a.id
      WHERE u.trash_status = 0
    `;
    const params: any[] = [];

    if (id) {
      query += ` AND u.id = ?`;
      params.push(id);
    } else if (search) {
      query += ` AND (u.username LIKE ? OR u.email LIKE ? OR u.full_name LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    query += ` ORDER BY u.id DESC LIMIT ? OFFSET ?`;
    params.push(maxRowsPerPage, limit);

    const rows = db.prepare(query).all(...params);
    return reply.send({
      status: 'success',
      message: '',
      data: rows,
    });
  });

  // POST /user/add
  fastify.post('/user/add', async (req, reply) => {
    const user = await requireAuth(req, reply);
    if (!user) return;

    if (!hasPermission(user, 'userList')) {
      return reply.send({ status: 'failed', message: 'Permission denied' });
    }

    const data = parseBodyData((req.body || {}) as Record<string, any>);
    const username = (data.username || '').trim();
    const email = (data.email || '').trim();
    const password = data.password || '123456';
    const fullName = data.full_name || '';
    const accountTypeId = Number(data.account_type_id) || 2;
    const groupIds = Array.isArray(data['group_id[]'])
      ? data['group_id[]'].join(',')
      : data.group_ids || '1';

    if (!username || !email) {
      return reply.send({ status: 'failed', message: 'Username and Email are required' });
    }

    const exists = db.prepare('SELECT id FROM sq_user WHERE (username = ? OR email = ?) AND trash_status = 0').get(username, email);
    if (exists) {
      return reply.send({ status: 'failed', message: 'Username or Email already exists' });
    }

    const hashed = hashPassword(password);
    const stmt = db.prepare(`
      INSERT INTO sq_user (username, password, email, full_name, account_type_id, group_ids, user_token)
      VALUES (?, ?, ?, ?, ?, ?, '')
    `);
    const res = stmt.run(username, hashed, email, fullName, accountTypeId, groupIds);

    return reply.send({
      status: 'success',
      id: Number(res.lastInsertRowid),
      message: 'User created successfully',
    });
  });

  // POST /user/edit
  fastify.post('/user/edit', async (req, reply) => {
    const user = await requireAuth(req, reply);
    if (!user) return;

    if (!hasPermission(user, 'userList')) {
      return reply.send({ status: 'failed', message: 'Permission denied' });
    }

    const data = parseBodyData((req.body || {}) as Record<string, any>);
    const id = Number(data.id);
    if (!id) {
      return reply.send({ status: 'failed', message: 'User ID is required' });
    }

    const updates: string[] = [];
    const params: any[] = [];

    if (data.full_name !== undefined) {
      updates.push('full_name = ?');
      params.push(data.full_name);
    }
    if (data.email) {
      updates.push('email = ?');
      params.push(data.email);
    }
    if (data.account_type_id) {
      updates.push('account_type_id = ?');
      params.push(Number(data.account_type_id));
    }
    if (data.password) {
      updates.push('password = ?');
      params.push(hashPassword(data.password));
    }
    if (data['group_id[]'] || data.group_ids) {
      const gids = Array.isArray(data['group_id[]']) ? data['group_id[]'].join(',') : data.group_ids;
      updates.push('group_ids = ?');
      params.push(gids);
    }

    if (updates.length > 0) {
      params.push(id);
      db.prepare(`UPDATE sq_user SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    }

    return reply.send({ status: 'success', id, message: 'User updated successfully' });
  });

  // POST /user/remove
  fastify.post('/user/remove', async (req, reply) => {
    const user = await requireAuth(req, reply);
    if (!user) return;

    if (!hasPermission(user, 'userList')) {
      return reply.send({ status: 'failed', message: 'Permission denied' });
    }

    const body = (req.body || {}) as Record<string, any>;
    const id = Number(body.id);
    if (!id) {
      return reply.send({ status: 'failed', message: 'User ID required' });
    }

    db.prepare('UPDATE sq_user SET trash_status = 1 WHERE id = ?').run(id);
    return reply.send({ status: 'success', message: 'User deleted successfully' });
  });

  // POST /user/getGroupList
  fastify.post('/user/getGroupList', async (req, reply) => {
    const user = await requireAuth(req, reply);
    if (!user) return;

    const rows = db.prepare('SELECT * FROM sq_group WHERE trash_status = 0 ORDER BY id ASC').all();
    return reply.send({ status: 'success', message: '', data: rows });
  });

  // POST /user/addGroup
  fastify.post('/user/addGroup', async (req, reply) => {
    const user = await requireAuth(req, reply);
    if (!user) return;

    const body = (req.body || {}) as Record<string, any>;
    const groupName = (body.group_name || '').trim();
    if (!groupName) {
      return reply.send({ status: 'failed', message: 'Group name is required' });
    }

    const res = db.prepare('INSERT INTO sq_group (group_name) VALUES (?)').run(groupName);
    return reply.send({
      status: 'success',
      id: Number(res.lastInsertRowid),
      message: 'Group added successfully',
    });
  });

  // POST /user/removeGroup
  fastify.post('/user/removeGroup', async (req, reply) => {
    const user = await requireAuth(req, reply);
    if (!user) return;

    const body = (req.body || {}) as Record<string, any>;
    const id = Number(body.id);
    if (!id) return reply.send({ status: 'failed', message: 'Group ID required' });

    db.prepare('UPDATE sq_group SET trash_status = 1 WHERE id = ?').run(id);
    return reply.send({ status: 'success', message: 'Group removed successfully' });
  });

  // POST /user/getAccountTypeList
  fastify.post('/user/getAccountTypeList', async (req, reply) => {
    const user = await requireAuth(req, reply);
    if (!user) return;

    const rows = db.prepare('SELECT * FROM sq_account_type ORDER BY id ASC').all();
    return reply.send({ status: 'success', message: '', data: rows });
  });

  // POST /user/dashboardStat
  fastify.post('/user/dashboardStat', async (req, reply) => {
    const user = await requireAuth(req, reply);
    if (!user) return;

    const totalUsers = (db.prepare('SELECT count(*) as count FROM sq_user WHERE trash_status = 0').get() as any)?.count || 0;
    const totalQuestions = (db.prepare('SELECT count(*) as count FROM sq_question WHERE trash_status = 0').get() as any)?.count || 0;
    const totalQuizzes = (db.prepare('SELECT count(*) as count FROM sq_quiz WHERE trash_status = 0').get() as any)?.count || 0;
    const totalResults = (db.prepare('SELECT count(*) as count FROM sq_result WHERE trash_status = 0').get() as any)?.count || 0;

    return reply.send({
      status: 'success',
      data: {
        total_users: totalUsers,
        total_questions: totalQuestions,
        total_quizzes: totalQuizzes,
        total_results: totalResults,
      },
    });
  });
}
