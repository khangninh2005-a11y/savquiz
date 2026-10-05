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
  const password = data.passworde || data.password || '123456';
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

const editUserHandler = async (c: any) => {
  const db = c.env.DB;
  const user = await requireAuth(c, db);
  if (!user) return c.json({ status: 'failed', message: 'Unauthorized' }, 401);

  const rawBody = await getBody(c);
  const data = parseBodyData(rawBody);
  const id = Number(data.id || data.uid || rawBody.id || rawBody.uid);
  if (!id) return c.json({ status: 'failed', message: 'User ID is required' });

  const isSelf = Number(user.id) === id;
  const canManage = hasPermission(user, 'userList') || Number(user.account_type_id) === 1;
  if (!canManage && !isSelf) {
    return c.json({ status: 'failed', message: 'Permission denied' });
  }

  const existing = await db.prepare('SELECT id FROM sq_user WHERE id = ? AND trash_status = 0').bind(id).first();
  if (!existing) return c.json({ status: 'failed', message: 'User not found' });

  const updates: string[] = [];
  const params: any[] = [];

  const rawFullName = data.full_name !== undefined ? data.full_name : (data.fullName !== undefined ? data.fullName : rawBody.full_name);
  if (rawFullName !== undefined) {
    updates.push('full_name = ?');
    params.push(String(rawFullName).trim());
  }

  const rawUsername = data.username !== undefined ? data.username : rawBody.username;
  if (canManage && rawUsername) {
    const username = String(rawUsername).trim();
    const dupUser = await db.prepare('SELECT id FROM sq_user WHERE username = ? AND id != ? AND trash_status = 0').bind(username, id).first();
    if (dupUser) return c.json({ status: 'failed', message: 'Tên đăng nhập đã được sử dụng' });
    updates.push('username = ?');
    params.push(username);
  }

  const rawEmail = data.email !== undefined ? data.email : rawBody.email;
  if (rawEmail) {
    const email = String(rawEmail).trim();
    const dup = await db.prepare('SELECT id FROM sq_user WHERE email = ? AND id != ? AND trash_status = 0').bind(email, id).first();
    if (dup) return c.json({ status: 'failed', message: 'Email đã được sử dụng bởi tài khoản khác' });
    updates.push('email = ?');
    params.push(email);
  }

  const rawAccountType = data.account_type_id !== undefined ? data.account_type_id : rawBody.account_type_id;
  if (canManage && rawAccountType !== undefined && rawAccountType !== '') {
    updates.push('account_type_id = ?');
    params.push(Number(rawAccountType));
  }

  const rawPassword = data.passworde || data.password || rawBody.passworde || rawBody.password;
  if (rawPassword && String(rawPassword).trim().length > 0) {
    updates.push('password = ?');
    params.push(hashPassword(String(rawPassword).trim()));
  }

  const rawGids = data['group_id[]'] || data.group_ids || rawBody['group_id[]'] || rawBody.group_ids;
  if (canManage && rawGids !== undefined) {
    const gids = Array.isArray(rawGids) ? rawGids.join(',') : String(rawGids);
    updates.push('group_ids = ?');
    params.push(gids);
  }

  if (updates.length > 0) {
    params.push(id);
    await db.prepare(`UPDATE sq_user SET ${updates.join(', ')} WHERE id = ?`).bind(...params).run();
  }

  return c.json({ status: 'success', id, message: 'Cập nhật thông tin thành công' });
};

userRouter.all('/user/edit', editUserHandler);
userRouter.all('/user/update', editUserHandler);

const removeUserHandler = async (c: any) => {
  const db = c.env.DB;
  const user = await requireAuth(c, db);
  if (!user) return c.json({ status: 'failed', message: 'Unauthorized' }, 401);
  if (!hasPermission(user, 'userList')) return c.json({ status: 'failed', message: 'Permission denied' });

  const body = await getBody(c);
  const id = Number(body.id || body.uid);
  if (!id) return c.json({ status: 'failed', message: 'User ID is required' });

  await db.prepare('UPDATE sq_user SET trash_status = 1 WHERE id = ?').bind(id).run();
  return c.json({ status: 'success', message: 'User deleted' });
};

userRouter.post('/user/remove', removeUserHandler);
userRouter.post('/user/delete', removeUserHandler);

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

const removeGroupHandler = async (c: any) => {
  const db = c.env.DB;
  const user = await requireAuth(c, db);
  if (!user) return c.json({ status: 'failed', message: 'Unauthorized' }, 401);
  if (!hasPermission(user, 'userList')) return c.json({ status: 'failed', message: 'Permission denied' });

  const body = await getBody(c);
  const id = Number(body.id || body.gid);
  if (!id) return c.json({ status: 'failed', message: 'ID nhóm là bắt buộc' });

  await db.prepare('UPDATE sq_group SET trash_status = 1 WHERE id = ?').bind(id).run();
  return c.json({ status: 'success', message: 'Đã xóa nhóm' });
};

userRouter.post('/user/removeGroup', removeGroupHandler);
userRouter.post('/user/deleteGroup', removeGroupHandler);

userRouter.post('/user/dashboardStat', async (c) => {
  const db = c.env.DB;
  const user = await requireAuth(c, db);
  if (!user) return c.json({ status: 'failed', message: 'Unauthorized' }, 401);

  const totalUsers = (await db.prepare('SELECT count(*) as count FROM sq_user WHERE trash_status = 0').first<any>())?.count || 0;
  const totalQuestions = (await db.prepare('SELECT count(*) as count FROM sq_question WHERE trash_status = 0').first<any>())?.count || 0;
  const totalQuizzes = (await db.prepare('SELECT count(*) as count FROM sq_quiz WHERE trash_status = 0').first<any>())?.count || 0;
  const totalResults = (await db.prepare('SELECT count(*) as count FROM sq_result WHERE trash_status = 0').first<any>())?.count || 0;

  return c.json({
    status: 'success',
    data: {
      total_users: totalUsers,
      total_questions: totalQuestions,
      total_quizzes: totalQuizzes,
      total_results: totalResults,
    },
  });
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

userRouter.all('/user/updateProfile', async (c) => {
  const db = c.env.DB;
  const user = await requireAuth(c, db);
  if (!user) return c.json({ status: 'failed', message: 'Unauthorized' }, 401);

  const rawBody = await getBody(c);
  const data = parseBodyData(rawBody);
  const fullName = String(data.full_name !== undefined ? data.full_name : (data.fullName !== undefined ? data.fullName : (rawBody.full_name || ''))).trim();
  const email = String(data.email !== undefined ? data.email : (rawBody.email || '')).trim();

  if (!email) return c.json({ status: 'failed', message: 'Email không được để trống' });

  const dup = await db.prepare('SELECT id FROM sq_user WHERE email = ? AND id != ? AND trash_status = 0').bind(email, user.id).first();
  if (dup) return c.json({ status: 'failed', message: 'Email đã được sử dụng bởi tài khoản khác' });

  await db.prepare('UPDATE sq_user SET full_name = ?, email = ? WHERE id = ?').bind(fullName, email, user.id).run();
  return c.json({ status: 'success', message: 'Cập nhật thông tin thành công' });
});
