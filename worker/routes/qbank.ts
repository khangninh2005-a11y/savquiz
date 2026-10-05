import { Hono } from 'hono';
import { getBody, parseBodyData, requireAuth } from '../utils';

export const qbankRouter = new Hono<{ Bindings: { DB: D1Database } }>();

function extractOptions(data: Record<string, any>): { text: string; score: number }[] {
  const options: { text: string; score: number }[] = [];
  if (Array.isArray(data.options)) {
    data.options.forEach((opt: any) => {
      const text = typeof opt === 'string' ? opt : (opt.question_option ?? opt.option ?? opt.text ?? '');
      const score = Number(opt.score) || 0;
      if (text !== undefined && text !== null && String(text).trim() !== '') {
        options.push({ text: String(text).trim(), score });
      }
    });
  } else if (Array.isArray(data['option[]'])) {
    const texts = data['option[]'];
    const scores = Array.isArray(data['score[]']) ? data['score[]'] : [];
    texts.forEach((text: any, idx: number) => {
      if (text !== undefined && text !== null && String(text).trim() !== '') {
        options.push({
          text: String(text).trim(),
          score: Number(scores[idx]) || 0,
        });
      }
    });
  } else {
    let i = 0;
    while (data[`option[${i}]`] !== undefined || data[`option_${i}`] !== undefined) {
      const text = data[`option[${i}]`] ?? data[`option_${i}`] ?? '';
      const score = Number(data[`score[${i}]`] ?? data[`score_${i}`] ?? 0);
      if (String(text).trim() !== '') {
        options.push({ text: String(text).trim(), score });
      }
      i++;
    }
  }
  return options;
}

qbankRouter.post('/qbank/getList', async (c) => {
  const db = c.env.DB;
  const user = await requireAuth(c, db);
  if (!user) return c.json({ status: 'failed', message: 'Unauthorized' }, 401);

  const body = await getBody(c);
  const search = String(body.search || '').trim();
  const rawCid = body.category_id !== undefined && body.category_id !== '' ? body.category_id : body.cid;
  const categoryId = rawCid !== undefined && rawCid !== '' ? Number(rawCid) : null;
  const difficultyLevel = String(body.difficulty_level || '').trim();
  const limit = Number(body.limit) || 0;
  const maxRowsPerPage = Number(body.maxRowsPerPage) || 30;

  let query = `
    SELECT q.*, c.category_name, qt.type_name as question_type_name
    FROM sq_question q
    LEFT JOIN sq_category c ON q.category_ids = c.id
    LEFT JOIN sq_question_type qt ON q.question_type = qt.type_code
    WHERE q.trash_status = 0
  `;
  const params: any[] = [];

  if (categoryId && !isNaN(categoryId) && categoryId > 0) {
    query += ` AND q.category_ids = ?`;
    params.push(categoryId);
  }
  if (difficultyLevel) {
    query += ` AND q.difficulty_level = ?`;
    params.push(difficultyLevel);
  }
  if (search) {
    query += ` AND (q.question LIKE ? OR q.description LIKE ?)`;
    params.push(`%${search}%`, `%${search}%`);
  }

  query += ` ORDER BY q.id DESC LIMIT ? OFFSET ?`;
  params.push(maxRowsPerPage, limit);

  const { results: questions } = await db.prepare(query).bind(...params).all<any>();

  // Fetch options for all returned questions in batch
  const questionIds = (questions || []).map((q) => q.id);
  let optionsMap: Record<number, any[]> = {};

  if (questionIds.length > 0) {
    const placeholders = questionIds.map(() => '?').join(',');
    const { results: options } = await db
      .prepare(`SELECT id, question_id, question_option, score FROM sq_option WHERE question_id IN (${placeholders}) AND trash_status = 0 ORDER BY id ASC`)
      .bind(...questionIds)
      .all<any>();

    (options || []).forEach((opt) => {
      if (!optionsMap[opt.question_id]) optionsMap[opt.question_id] = [];
      optionsMap[opt.question_id].push(opt);
    });
  }

  const result = (questions || []).map((q) => ({
    ...q,
    options: optionsMap[q.id] || [],
  }));

  return c.json({ status: 'success', message: '', data: result });
});

qbankRouter.post('/qbank/getQuestion', async (c) => {
  const db = c.env.DB;
  const user = await requireAuth(c, db);
  if (!user) return c.json({ status: 'failed', message: 'Unauthorized' }, 401);

  const body = await getBody(c);
  const id = Number(body.id);
  if (!id) return c.json({ status: 'failed', message: 'Question ID required' });

  const question = await db
    .prepare(`
      SELECT q.*, c.category_name, qt.type_name as question_type_name
      FROM sq_question q
      LEFT JOIN sq_category c ON q.category_ids = c.id
      LEFT JOIN sq_question_type qt ON q.question_type = qt.type_code
      WHERE q.id = ? AND q.trash_status = 0
    `)
    .bind(id)
    .first<any>();

  if (!question) {
    return c.json({ status: 'failed', message: 'Question not found' });
  }

  const { results: options } = await db
    .prepare('SELECT * FROM sq_option WHERE question_id = ? AND trash_status = 0 ORDER BY id ASC')
    .bind(id)
    .all<any>();

  return c.json({ status: 'success', data: question, options: options || [] });
});

qbankRouter.post('/qbank/add', async (c) => {
  const db = c.env.DB;
  const user = await requireAuth(c, db);
  if (!user) return c.json({ status: 'failed', message: 'Unauthorized' }, 401);

  const raw = await getBody(c);
  const data = parseBodyData(raw);

  const questionText = String(data.question || '');
  const questionType = String(data.question_type || 'Multiple Choice Single Answer');
  const description = String(data.description || '');
  const categoryIds = Number(data.category_ids) || 1;
  const difficultyLevel = String(data.difficulty_level || 'Thông hiểu');
  const mediaUrl = String(data.media_url || '');
  const mediaType = String(data.media_type || '');

  if (!questionText) {
    return c.json({ status: 'failed', message: 'Question text is required' });
  }

  const qRes = await db
    .prepare(`
      INSERT INTO sq_question (question_type, question, description, category_ids, difficulty_level, media_url, media_type)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
    .bind(questionType, questionText, description, categoryIds, difficultyLevel, mediaUrl, mediaType)
    .run();

  const questionId = Number(qRes.meta?.last_row_id || 0);

  // Extract and batch insert options
  const options = extractOptions(data);
  if (options.length > 0) {
    const optInserts = options.map((opt) =>
      db.prepare('INSERT INTO sq_option (question_id, question_option, score) VALUES (?, ?, ?)').bind(questionId, opt.text, opt.score)
    );
    await db.batch(optInserts);
  }

  return c.json({ status: 'success', id: questionId, message: 'Question created successfully' });
});

qbankRouter.post('/qbank/edit', async (c) => {
  const db = c.env.DB;
  const user = await requireAuth(c, db);
  if (!user) return c.json({ status: 'failed', message: 'Unauthorized' }, 401);

  const raw = await getBody(c);
  const data = parseBodyData(raw);
  const id = Number(data.id || raw.id);

  if (!id) return c.json({ status: 'failed', message: 'Question ID required' });

  await db
    .prepare(`
      UPDATE sq_question
      SET question = ?, question_type = ?, description = ?, category_ids = ?,
          difficulty_level = ?, media_url = ?, media_type = ?
      WHERE id = ?
    `)
    .bind(
      data.question || '',
      data.question_type || 'Multiple Choice Single Answer',
      data.description || '',
      Number(data.category_ids) || 1,
      data.difficulty_level || 'Thông hiểu',
      data.media_url || '',
      data.media_type || '',
      id
    )
    .run();

  // Soft delete old options
  await db.prepare('UPDATE sq_option SET trash_status = 1 WHERE question_id = ?').bind(id).run();

  // Insert updated options
  const options = extractOptions(data);
  if (options.length > 0) {
    const optInserts = options.map((opt) =>
      db.prepare('INSERT INTO sq_option (question_id, question_option, score) VALUES (?, ?, ?)').bind(id, opt.text, opt.score)
    );
    await db.batch(optInserts);
  }

  return c.json({ status: 'success', id, message: 'Question updated successfully' });
});

qbankRouter.post('/qbank/delete', async (c) => {
  const db = c.env.DB;
  const user = await requireAuth(c, db);
  if (!user) return c.json({ status: 'failed', message: 'Unauthorized' }, 401);

  const body = await getBody(c);
  const id = Number(body.id || body.qid);
  if (!id) return c.json({ status: 'failed', message: 'Question ID required' });

  await db.prepare('UPDATE sq_question SET trash_status = 1 WHERE id = ?').bind(id).run();
  await db.prepare('UPDATE sq_option SET trash_status = 1 WHERE question_id = ?').bind(id).run();

  return c.json({ status: 'success', message: 'Question deleted' });
});

qbankRouter.post('/qbank/getCategoryList', async (c) => {
  const db = c.env.DB;
  const user = await requireAuth(c, db);
  if (!user) return c.json({ status: 'failed', message: 'Unauthorized' }, 401);

  const { results } = await db.prepare('SELECT * FROM sq_category WHERE trash_status = 0 ORDER BY id ASC').all();
  return c.json({ status: 'success', message: '', data: results || [] });
});

qbankRouter.post('/qbank/addCategory', async (c) => {
  const db = c.env.DB;
  const user = await requireAuth(c, db);
  if (!user) return c.json({ status: 'failed', message: 'Unauthorized' }, 401);

  const body = await getBody(c);
  const name = String(body.category_name || '').trim();
  const parentId = Number(body.parent_id) || 0;

  if (!name) return c.json({ status: 'failed', message: 'Category name required' });

  const res = await db.prepare('INSERT INTO sq_category (category_name, parent_id) VALUES (?, ?)').bind(name, parentId).run();
  return c.json({ status: 'success', id: Number(res.meta?.last_row_id || 0), message: 'Category added' });
});

qbankRouter.post('/qbank/deleteCategory', async (c) => {
  const db = c.env.DB;
  const user = await requireAuth(c, db);
  if (!user) return c.json({ status: 'failed', message: 'Unauthorized' }, 401);

  const body = await getBody(c);
  const id = Number(body.id || body.cid);
  if (!id) return c.json({ status: 'failed', message: 'Category ID required' });

  await db.prepare('UPDATE sq_category SET trash_status = 1 WHERE id = ?').bind(id).run();
  return c.json({ status: 'success', message: 'Category deleted' });
});

qbankRouter.post('/qbank/getQuestionTypeList', async (c) => {
  const db = c.env.DB;
  const user = await requireAuth(c, db);
  if (!user) return c.json({ status: 'failed', message: 'Unauthorized' }, 401);

  const { results } = await db.prepare('SELECT * FROM sq_question_type WHERE trash_status = 0 ORDER BY id ASC').all();
  return c.json({ status: 'success', message: '', data: results || [] });
});

qbankRouter.post('/qbank/addQuestionType', async (c) => {
  const db = c.env.DB;
  const user = await requireAuth(c, db);
  if (!user) return c.json({ status: 'failed', message: 'Unauthorized' }, 401);

  const body = await getBody(c);
  const typeName = String(body.type_name || '').trim();
  const description = String(body.description || '').trim();
  const typeCode = String(body.type_code || `type_${Date.now()}`).trim();

  if (!typeName) return c.json({ status: 'failed', message: 'Tên loại câu hỏi không được để trống' });

  const res = await db
    .prepare('INSERT INTO sq_question_type (type_code, type_name, description) VALUES (?, ?, ?)')
    .bind(typeCode, typeName, description)
    .run();

  return c.json({ status: 'success', id: Number(res.meta?.last_row_id || 0), message: 'Thêm loại câu hỏi thành công' });
});

qbankRouter.post('/qbank/updateQuestionType', async (c) => {
  const db = c.env.DB;
  const user = await requireAuth(c, db);
  if (!user) return c.json({ status: 'failed', message: 'Unauthorized' }, 401);

  const body = await getBody(c);
  const id = Number(body.id);
  const typeName = String(body.type_name || '').trim();
  const description = String(body.description || '').trim();

  if (!id || !typeName) return c.json({ status: 'failed', message: 'ID và tên loại câu hỏi là bắt buộc' });

  await db
    .prepare('UPDATE sq_question_type SET type_name = ?, description = ? WHERE id = ?')
    .bind(typeName, description, id)
    .run();

  return c.json({ status: 'success', message: 'Cập nhật loại câu hỏi thành công' });
});

qbankRouter.post('/qbank/deleteQuestionType', async (c) => {
  const db = c.env.DB;
  const user = await requireAuth(c, db);
  if (!user) return c.json({ status: 'failed', message: 'Unauthorized' }, 401);

  const body = await getBody(c);
  const id = Number(body.id);
  if (!id) return c.json({ status: 'failed', message: 'ID loại câu hỏi là bắt buộc' });

  await db.prepare('UPDATE sq_question_type SET trash_status = 1 WHERE id = ?').bind(id).run();
  return c.json({ status: 'success', message: 'Xóa loại câu hỏi thành công' });
});
