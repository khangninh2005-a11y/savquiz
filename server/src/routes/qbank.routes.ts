import { FastifyInstance } from 'fastify';
import { db } from '../db/connection.js';
import { requireAuth } from '../middlewares/auth.js';
import { parseBodyData } from './user.routes.js';

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

export async function qbankRoutes(fastify: FastifyInstance) {
  // POST /qbank/getList
  fastify.post('/qbank/getList', async (req, reply) => {
    const user = await requireAuth(req, reply);
    if (!user) return;

    const body = (req.body || {}) as Record<string, any>;
    const search = (body.search || '').trim();
    const rawCid = body.category_id !== undefined && body.category_id !== '' 
      ? body.category_id 
      : body.cid;
    const categoryId = rawCid !== undefined && rawCid !== '' ? Number(rawCid) : null;
    const difficultyLevel = (body.difficulty_level || '').trim();
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

    const questions = db.prepare(query).all(...params) as any[];

    // Attach options for each question
    const optStmt = db.prepare(`
      SELECT id, question_id, question_option, score
      FROM sq_option
      WHERE question_id = ? AND trash_status = 0
      ORDER BY id ASC
    `);

    const result = questions.map((q) => {
      const options = optStmt.all(q.id);
      return {
        ...q,
        options,
      };
    });

    return reply.send({
      status: 'success',
      message: '',
      data: result,
    });
  });

  // POST /qbank/getQuestion
  fastify.post('/qbank/getQuestion', async (req, reply) => {
    const user = await requireAuth(req, reply);
    if (!user) return;

    const body = (req.body || {}) as Record<string, any>;
    const id = Number(body.id);
    if (!id) return reply.send({ status: 'failed', message: 'Question ID required' });

    const question = db.prepare(`
      SELECT q.*, c.category_name, qt.type_name as question_type_name
      FROM sq_question q
      LEFT JOIN sq_category c ON q.category_ids = c.id
      LEFT JOIN sq_question_type qt ON q.question_type = qt.type_code
      WHERE q.id = ? AND q.trash_status = 0
    `).get(id) as any;
    if (!question) {
      return reply.send({ status: 'failed', message: 'Question not found' });
    }

    const options = db.prepare('SELECT * FROM sq_option WHERE question_id = ? AND trash_status = 0 ORDER BY id ASC').all(id);

    return reply.send({
      status: 'success',
      data: question,
      options,
    });
  });

  // POST /qbank/add
  fastify.post('/qbank/add', async (req, reply) => {
    const user = await requireAuth(req, reply);
    if (!user) return;

    const raw = (req.body || {}) as Record<string, any>;
    const data = parseBodyData(raw);

    const questionText = data.question || '';
    const questionType = data.question_type || 'Multiple Choice Single Answer';
    const description = data.description || '';
    const categoryIds = Number(data.category_ids) || 1;
    const difficultyLevel = data.difficulty_level || 'Thông hiểu';
    const mediaUrl = data.media_url || '';
    const mediaType = data.media_type || '';

    if (!questionText) {
      return reply.send({ status: 'failed', message: 'Question text is required' });
    }

    const qStmt = db.prepare(`
      INSERT INTO sq_question (question_type, question, description, category_ids, difficulty_level, media_url, media_type)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const qRes = qStmt.run(questionType, questionText, description, categoryIds, difficultyLevel, mediaUrl, mediaType);
    const questionId = Number(qRes.lastInsertRowid);

    // Save options
    const optStmt = db.prepare(`
      INSERT INTO sq_option (question_id, question_option, score)
      VALUES (?, ?, ?)
    `);

    // Extract and save options
    const options = extractOptions(data);
    for (const opt of options) {
      optStmt.run(questionId, opt.text, opt.score);
    }

    return reply.send({
      status: 'success',
      id: questionId,
      message: 'Question created successfully',
    });
  });

  // POST /qbank/edit
  fastify.post('/qbank/edit', async (req, reply) => {
    const user = await requireAuth(req, reply);
    if (!user) return;

    const raw = (req.body || {}) as Record<string, any>;
    const data = parseBodyData(raw);
    const id = Number(data.id || raw.id);

    if (!id) return reply.send({ status: 'failed', message: 'Question ID required' });

    db.prepare(`
      UPDATE sq_question
      SET question = ?, question_type = ?, description = ?, category_ids = ?,
          difficulty_level = ?, media_url = ?, media_type = ?
      WHERE id = ?
    `).run(
      data.question || '',
      data.question_type || 'Multiple Choice Single Answer',
      data.description || '',
      Number(data.category_ids) || 1,
      data.difficulty_level || 'Thông hiểu',
      data.media_url !== undefined ? data.media_url : '',
      data.media_type !== undefined ? data.media_type : '',
      id
    );

    // If options are provided, update them
    const options = extractOptions(data);
    if (options.length > 0) {
      db.prepare('DELETE FROM sq_option WHERE question_id = ?').run(id);
      const optStmt = db.prepare('INSERT INTO sq_option (question_id, question_option, score) VALUES (?, ?, ?)');
      for (const opt of options) {
        optStmt.run(id, opt.text, opt.score);
      }
    }

    return reply.send({ status: 'success', id, message: 'Question updated successfully' });
  });

  // POST /qbank/remove
  fastify.post('/qbank/remove', async (req, reply) => {
    const user = await requireAuth(req, reply);
    if (!user) return;

    const body = (req.body || {}) as Record<string, any>;
    const id = Number(body.id);
    if (!id) return reply.send({ status: 'failed', message: 'Question ID required' });

    db.prepare('UPDATE sq_question SET trash_status = 1 WHERE id = ?').run(id);
    db.prepare('UPDATE sq_option SET trash_status = 1 WHERE question_id = ?').run(id);

    return reply.send({ status: 'success', message: 'Question removed successfully' });
  });

  // POST /qbank/getCategoryList
  fastify.post('/qbank/getCategoryList', async (req, reply) => {
    const user = await requireAuth(req, reply);
    if (!user) return;

    const rows = db.prepare('SELECT * FROM sq_category WHERE trash_status = 0 ORDER BY id ASC').all();
    return reply.send({ status: 'success', message: '', data: rows });
  });

  // POST /qbank/addCategory
  fastify.post('/qbank/addCategory', async (req, reply) => {
    const user = await requireAuth(req, reply);
    if (!user) return;

    const body = (req.body || {}) as Record<string, any>;
    const name = (body.category_name || '').trim();
    const parentId = Number(body.parent_id) || 0;

    if (!name) return reply.send({ status: 'failed', message: 'Category name required' });

    const res = db.prepare('INSERT INTO sq_category (category_name, parent_id) VALUES (?, ?)').run(name, parentId);
    return reply.send({
      status: 'success',
      id: Number(res.lastInsertRowid),
      message: 'Category added successfully',
    });
  });

  // POST /qbank/removeCategory
  fastify.post('/qbank/removeCategory', async (req, reply) => {
    const user = await requireAuth(req, reply);
    if (!user) return;

    const body = (req.body || {}) as Record<string, any>;
    const id = Number(body.id);
    if (!id) return reply.send({ status: 'failed', message: 'Category ID required' });

    db.prepare('UPDATE sq_category SET trash_status = 1 WHERE id = ?').run(id);
    return reply.send({ status: 'success', message: 'Category removed successfully' });
  });

  // POST /qbank/getQuestionTypeList
  fastify.post('/qbank/getQuestionTypeList', async (req, reply) => {
    const user = await requireAuth(req, reply);
    if (!user) return;

    const rows = db.prepare('SELECT * FROM sq_question_type WHERE trash_status = 0 ORDER BY id ASC').all();
    return reply.send({ status: 'success', message: '', data: rows });
  });

  // POST /qbank/addQuestionType
  fastify.post('/qbank/addQuestionType', async (req, reply) => {
    const user = await requireAuth(req, reply);
    if (!user) return;

    const body = (req.body || {}) as Record<string, any>;
    const typeName = (body.type_name || '').trim();
    const description = (body.description || '').trim();
    let typeCode = (body.type_code || '').trim();

    if (!typeName) {
      return reply.send({ status: 'failed', message: 'Tên loại câu hỏi không được để trống' });
    }

    if (!typeCode) {
      const maxRow = db.prepare('SELECT MAX(id) as maxId FROM sq_question_type').get() as { maxId: number | null };
      const nextId = (maxRow?.maxId || 0) + 1;
      typeCode = `TYPE_${nextId}`;
    }

    const existing = db.prepare('SELECT id FROM sq_question_type WHERE type_code = ?').get(typeCode);
    if (existing) {
      return reply.send({ status: 'failed', message: 'Mã loại câu hỏi đã tồn tại' });
    }

    const res = db.prepare(`
      INSERT INTO sq_question_type (type_code, type_name, description)
      VALUES (?, ?, ?)
    `).run(typeCode, typeName, description);

    return reply.send({
      status: 'success',
      id: Number(res.lastInsertRowid),
      message: 'Thêm loại câu hỏi thành công',
    });
  });

  // POST /qbank/updateQuestionType
  fastify.post('/qbank/updateQuestionType', async (req, reply) => {
    const user = await requireAuth(req, reply);
    if (!user) return;

    const body = (req.body || {}) as Record<string, any>;
    const id = Number(body.id);
    const typeName = (body.type_name || '').trim();
    const description = (body.description || '').trim();

    if (!id || !typeName) {
      return reply.send({ status: 'failed', message: 'ID và tên loại câu hỏi không hợp lệ' });
    }

    db.prepare(`
      UPDATE sq_question_type
      SET type_name = ?, description = ?
      WHERE id = ?
    `).run(typeName, description, id);

    return reply.send({ status: 'success', message: 'Cập nhật loại câu hỏi thành công' });
  });

  // POST /qbank/deleteQuestionType
  fastify.post('/qbank/deleteQuestionType', async (req, reply) => {
    const user = await requireAuth(req, reply);
    if (!user) return;

    const body = (req.body || {}) as Record<string, any>;
    const id = Number(body.id);
    if (!id) return reply.send({ status: 'failed', message: 'ID không hợp lệ' });

    const item = db.prepare('SELECT type_code FROM sq_question_type WHERE id = ?').get(id) as { type_code: string } | undefined;
    if (item) {
      const used = db.prepare('SELECT COUNT(*) as count FROM sq_question WHERE question_type = ? AND trash_status = 0').get(item.type_code) as { count: number };
      if (used && used.count > 0) {
        return reply.send({ status: 'failed', message: `Không thể xóa vì đang có ${used.count} câu hỏi thuộc loại này.` });
      }
    }

    db.prepare('UPDATE sq_question_type SET trash_status = 1 WHERE id = ?').run(id);
    return reply.send({ status: 'success', message: 'Xóa loại câu hỏi thành công' });
  });
}
