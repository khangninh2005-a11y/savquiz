import { Hono } from 'hono';
import { getBody, parseBodyData, hashPassword, requireAuth, hasPermission, verifyPassword } from '../utils';

export const userRouter = new Hono<{ Bindings: { DB: D1Database } }>();

userRouter.post('/user/getList', async (c) => {
  const db = c.env.DB;
  const user = await requireAuth(c, db);
  if (!user) return c.json({ status: 'failed', message: 'Unauthorized' }, 401);
  if (!hasPermission(user, 'userList')) return c.json({ status: 'failed', message: 'Permission denied' });

  const body = await getBody(c);
  const search = String(body.search || '').trim();
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

  const stmt = db.prepare(query).bind(...params);
  const { results } = await stmt.all();

  return c.json({ status: 'success', message: '', data: results || [] });
});

userRouter.post('/user/add', async (c) => {
  const db = c.env.DB;
  const user = await requireAuth(c, db);
  if (!user) return c.json({ status: 'failed', message: 'Unauthorized' }, 401);
  if (!hasPermission(user, 'userList')) return c.json({ status: 'failed', message: 'Permission denied' });

  const rawBody = await getBody(c);
  const data = parseBodyData(rawBody);
  const username = String(data.username || '').trim();
  const email = String(data.email || '').trim();
  const password = data.password || '123456';
  const fullName = data.full_name || '';
  const accountTypeId = Number(data.account_type_id) || 2;
  const groupIds = Array.isArray(data['group_id[]'])
    ? data['group_id[]'].join(',')
    : data.group_ids || '1';

  if (!username || !email) {
    return c.json({ status: 'failed', message: 'Username and Email are required' });
  }

  const exists = await db
    .prepare('SELECT id FROM sq_user WHERE (username = ? OR email = ?) AND trash_status = 0')
    .bind(username, email)
    .first();
  if (exists) {
    return c.json({ status: 'failed', message: 'Username or Email already exists' });
  }

  const hashed = hashPassword(password);
  const res = await db
    .prepare(`
      INSERT INTO sq_user (username, password, email, full_name, account_type_id, group_ids, user_token)
      VALUES (?, ?, ?, ?, ?, ?, '')
    `)
    .bind(username, hashed, email, fullName, accountTypeId, groupIds)
    .run();

  return c.json({
    status: 'success',
    id: Number(res.meta?.last_row_id || 0),
    message: 'User created successfully',
  });
});

userRouter.post('/user/update', async (c) => {
  const db = c.env.DB;
  const user = await requireAuth(c, db);
  if (!user) return c.json({ status: 'failed', message: 'Unauthorized' }, 401);
  if (!hasPermission(user, 'userList')) return c.json({ status: 'failed', message: 'Permission denied' });

  const rawBody = await getBody(c);
  const data = parseBodyData(rawBody);
  const id = Number(data.id || data.uid);
  if (!id) return c.json({ status: 'failed', message: 'User ID is required' });

  const existing = await db.prepare('SELECT id FROM sq_user WHERE id = ? AND trash_status = 0').bind(id).first();
  if (!existing) return c.json({ status: 'failed', message: 'User not found' });

  const email = data.email ? String(data.email).trim() : null;
  const fullName = data.full_name !== undefined ? data.full_name : null;
  const accountTypeId = data.account_type_id !== undefined ? Number(data.account_type_id) : null;
  const groupIds = Array.isArray(data['group_id[]'])
    ? data['group_id[]'].join(',')
    : data.group_ids !== undefined
    ? data.group_ids
    : null;

  if (email) {
    const dup = await db.prepare('SELECT id FROM sq_user WHERE email = ? AND id != ? AND trash_status = 0').bind(email, id).first();
    if (dup) return c.json({ status: 'failed', message: 'Email already in use' });
  }

  let updateQuery = 'UPDATE sq_user SET ';
  const updates: string[] = [];
  const params: any[] = [];

  if (email !== null) { updates.push('email = ?'); params.push(email); }
  if (fullName !== null) { updates.push('full_name = ?'); params.push(fullName); }
  if (accountTypeId !== null) { updates.push('account_type_id = ?'); params.push(accountTypeId); }
  if (groupIds !== null) { updates.push('group_ids = ?'); params.push(groupIds); }
  if (data.password) {
    updates.push('password = ?');
    params.push(hashPassword(data.password));
  }

  if (updates.length > 0) {
    updateQuery += updates.join(', ') + ' WHERE id = ?';
    params.push(id);
    await db.prepare(updateQuery).bind(...params).run();
  }

  return c.json({ status: 'success', message: 'User updated successfully' });
});

userRouter.post('/user/delete', async (c) => {
  const db = c.env.DB;
  const user = await requireAuth(c, db);
  if (!user) return c.json({ status: 'failed', message: 'Unauthorized' }, 401);
  if (!hasPermission(user, 'userList')) return c.json({ status: 'failed', message: 'Permission denied' });

  const body = await getBody(c);
  const id = Number(body.id || body.uid);
  if (!id) return c.json({ status: 'failed', message: 'User ID is required' });

  await db.prepare('UPDATE sq_user SET trash_status = 1 WHERE id = ?').bind(id).run();
  return c.json({ status: 'success', message: 'User deleted' });
});

userRouter.post('/user/getAccountTypeList', async (c) => {
  const db = c.env.DB;
  const user = await requireAuth(c, db);
  if (!user) return c.json({ status: 'failed', message: 'Unauthorized' }, 401);

  const { results } = await db.prepare('SELECT * FROM sq_account_type ORDER BY id ASC').all();
  return c.json({ status: 'success', message: '', data: results || [] });
});

userRouter.post('/user/getGroupList', async (c) => {
  const db = c.env.DB;
  const user = await requireAuth(c, db);
  if (!user) return c.json({ status: 'failed', message: 'Unauthorized' }, 401);

  const { results } = await db.prepare('SELECT * FROM sq_group WHERE trash_status = 0 ORDER BY id ASC').all();
  return c.json({ status: 'success', message: '', data: results || [] });
});

userRouter.post('/user/addGroup', async (c) => {
  const db = c.env.DB;
  const user = await requireAuth(c, db);
  if (!user) return c.json({ status: 'failed', message: 'Unauthorized' }, 401);
  if (!hasPermission(user, 'userList')) return c.json({ status: 'failed', message: 'Permission denied' });

  const body = await getBody(c);
  const groupName = String(body.group_name || '').trim();
  if (!groupName) return c.json({ status: 'failed', message: 'Tên nhóm là bắt buộc' });

  const res = await db.prepare('INSERT INTO sq_group (group_name) VALUES (?)').bind(groupName).run();
  return c.json({ status: 'success', id: Number(res.meta?.last_row_id || 0), message: 'Thêm nhóm thành công' });
});

userRouter.post('/user/deleteGroup', async (c) => {
  const db = c.env.DB;
  const user = await requireAuth(c, db);
  if (!user) return c.json({ status: 'failed', message: 'Unauthorized' }, 401);
  if (!hasPermission(user, 'userList')) return c.json({ status: 'failed', message: 'Permission denied' });

  const body = await getBody(c);
  const id = Number(body.id || body.gid);
  if (!id) return c.json({ status: 'failed', message: 'ID nhóm là bắt buộc' });

  await db.prepare('UPDATE sq_group SET trash_status = 1 WHERE id = ?').bind(id).run();
  return c.json({ status: 'success', message: 'Đã xóa nhóm' });
});

userRouter.post('/user/changePassword', async (c) => {
  const db = c.env.DB;
  const user = await requireAuth(c, db);
  if (!user) return c.json({ status: 'failed', message: 'Unauthorized' }, 401);

  const body = await getBody(c);
  const oldPassword = String(body.old_password || '');
  const newPassword = String(body.new_password || '');

  if (!newPassword || newPassword.length < 6) {
    return c.json({ status: 'failed', message: 'Mật khẩu mới phải có ít nhất 6 ký tự' });
  }

  const currentUser = await db.prepare('SELECT password FROM sq_user WHERE id = ?').bind(user.id).first<any>();
  if (!currentUser || !verifyPassword(oldPassword, currentUser.password)) {
    return c.json({ status: 'failed', message: 'Mật khẩu cũ không chính xác' });
  }

  const modernHash = hashPassword(newPassword);
  await db.prepare('UPDATE sq_user SET password = ? WHERE id = ?').bind(modernHash, user.id).run();
  return c.json({ status: 'success', message: 'Đổi mật khẩu thành công' });
});

userRouter.post('/user/updateProfile', async (c) => {
  const db = c.env.DB;
  const user = await requireAuth(c, db);
  if (!user) return c.json({ status: 'failed', message: 'Unauthorized' }, 401);

  const body = await getBody(c);
  const fullName = String(body.full_name || '').trim();
  const email = String(body.email || '').trim();

  if (!email) return c.json({ status: 'failed', message: 'Email không được để trống' });

  const dup = await db.prepare('SELECT id FROM sq_user WHERE email = ? AND id != ? AND trash_status = 0').bind(email, user.id).first();
  if (dup) return c.json({ status: 'failed', message: 'Email đã được sử dụng bởi tài khoản khác' });

  await db.prepare('UPDATE sq_user SET full_name = ?, email = ? WHERE id = ?').bind(fullName, email, user.id).run();
  return c.json({ status: 'success', message: 'Cập nhật thông tin thành công' });
});
