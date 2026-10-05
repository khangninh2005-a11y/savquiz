import { Hono } from 'hono';
import { getBody, requireAuth } from '../utils';
import { calculateResultScores } from './quiz';

export const resultRouter = new Hono<{ Bindings: { DB: D1Database } }>();

resultRouter.post('/result/getList', async (c) => {
  const db = c.env.DB;
  const user = await requireAuth(c, db);
  if (!user) return c.json({ status: 'failed', message: 'Unauthorized' }, 401);

  const body = await getBody(c);
  const search = String(body.search || '').trim();
  const limit = Number(body.limit) || 0;
  const maxRowsPerPage = Number(body.maxRowsPerPage) || 30;

  let query = `
    SELECT r.*, u.username, u.full_name, u.email, q.quiz_name, q.min_pass_percentage,
           q.correct_score, q.qids as quiz_qids
    FROM sq_result r
    JOIN sq_user u ON r.uid = u.id
    JOIN sq_quiz q ON r.quid = q.id
    WHERE r.trash_status = 0
  `;
  const params: any[] = [];

  if (search) {
    query += ` AND (u.username LIKE ? OR u.full_name LIKE ? OR q.quiz_name LIKE ?)`;
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  query += ` ORDER BY r.id DESC LIMIT ? OFFSET ?`;
  params.push(maxRowsPerPage, limit);

  const { results: rows } = await db.prepare(query).bind(...params).all<any>();
  const formattedRows = (rows || []).map((r) => {
    const qids = (r.assigned_qids || r.quiz_qids || '').split(',').map((s: string) => s.trim()).filter(Boolean);
    const totalQuestions = qids.length;
    const maxScore = totalQuestions * (Number(r.correct_score) || 1);
    const score10 = maxScore > 0 ? Math.min(10, Math.max(0, Math.round(((r.obtained_score / maxScore) * 10) * 10) / 10)) : 0;
    return {
      ...r,
      total_questions: totalQuestions,
      max_score: maxScore,
      score_10: score10,
    };
  });

  return c.json({ status: 'success', message: '', data: formattedRows });
});

resultRouter.post('/result/getMyList', async (c) => {
  const db = c.env.DB;
  const user = await requireAuth(c, db);
  if (!user) return c.json({ status: 'failed', message: 'Unauthorized' }, 401);

  const body = await getBody(c);
  const limit = Number(body.limit) || 0;
  const maxRowsPerPage = Number(body.maxRowsPerPage) || 30;

  const { results: rows } = await db
    .prepare(`
      SELECT r.*, u.username, u.full_name, q.quiz_name, q.min_pass_percentage,
             q.correct_score, q.qids as quiz_qids
      FROM sq_result r
      JOIN sq_user u ON r.uid = u.id
      JOIN sq_quiz q ON r.quid = q.id
      WHERE r.uid = ? AND r.trash_status = 0
      ORDER BY r.id DESC LIMIT ? OFFSET ?
    `)
    .bind(user.id, maxRowsPerPage, limit)
    .all<any>();

  const formattedRows = (rows || []).map((r) => {
    const qids = (r.assigned_qids || r.quiz_qids || '').split(',').map((s: string) => s.trim()).filter(Boolean);
    const totalQuestions = qids.length;
    const maxScore = totalQuestions * (Number(r.correct_score) || 1);
    const score10 = maxScore > 0 ? Math.min(10, Math.max(0, Math.round(((r.obtained_score / maxScore) * 10) * 10) / 10)) : 0;
    return {
      ...r,
      total_questions: totalQuestions,
      max_score: maxScore,
      score_10: score10,
    };
  });

  return c.json({ status: 'success', message: '', data: formattedRows });
});

resultRouter.post('/result/view', async (c) => {
  const db = c.env.DB;
  const user = await requireAuth(c, db);
  if (!user) return c.json({ status: 'failed', message: 'Unauthorized' }, 401);

  const body = await getBody(c);
  const id = Number(body.id || body.rid);
  if (!id) return c.json({ status: 'failed', message: 'Result ID required' });

  const result = await db
    .prepare(`
      SELECT r.*, u.username, u.full_name, u.email, q.quiz_name, q.description,
             q.min_pass_percentage, q.correct_score, q.incorrect_score, q.duration, q.qids as quiz_qids
      FROM sq_result r
      JOIN sq_user u ON r.uid = u.id
      JOIN sq_quiz q ON r.quid = q.id
      WHERE r.id = ? AND r.trash_status = 0
    `)
    .bind(id)
    .first<any>();

  if (!result) {
    return c.json({ status: 'failed', message: 'Result not found' });
  }

  // Get student answers
  const { results: answers } = await db
    .prepare('SELECT question_id, user_response, response_time FROM sq_answer WHERE rid = ?')
    .bind(id)
    .all<any>();

  const answersMap: Record<number, string> = {};
  (answers || []).forEach((a) => {
    answersMap[a.question_id] = a.user_response;
  });

  // Questions and options
  const qids = (result.assigned_qids || result.quiz_qids || '')
    .split(',')
    .map((s: string) => Number(s.trim()))
    .filter(Boolean);

  const questionsList: any[] = [];
  for (const qid of qids) {
    const q = await db
      .prepare('SELECT q.*, c.category_name FROM sq_question q LEFT JOIN sq_category c ON q.category_ids = c.id WHERE q.id = ?')
      .bind(qid)
      .first<any>();

    if (q) {
      const { results: options } = await db
        .prepare('SELECT id, question_id, question_option, score FROM sq_option WHERE question_id = ? AND trash_status = 0 ORDER BY id ASC')
        .bind(qid)
        .all<any>();

      questionsList.push({
        ...q,
        options: options || [],
        user_response: answersMap[qid] || '',
      });
    }
  }

  // Calculate detailed stats
  const scoreData = await calculateResultScores(db, qids, result, answersMap);

  const totalQuestions = qids.length;
  const maxScore = totalQuestions * (Number(result.correct_score) || 1);
  const score10 = maxScore > 0 ? Math.min(10, Math.max(0, Math.round(((result.obtained_score / maxScore) * 10) * 10) / 10)) : 0;

  return c.json({
    status: 'success',
    result: {
      ...result,
      total_questions: totalQuestions,
      max_score: maxScore,
      score_10: score10,
      no_corrected: scoreData.noCorrected,
      no_incorrected: scoreData.noIncorrected,
      no_unanswered: scoreData.noUnanswered,
    },
    questions: questionsList,
  });
});

resultRouter.post('/result/delete', async (c) => {
  const db = c.env.DB;
  const user = await requireAuth(c, db);
  if (!user) return c.json({ status: 'failed', message: 'Unauthorized' }, 401);

  const body = await getBody(c);
  const id = Number(body.id || body.rid);
  if (!id) return c.json({ status: 'failed', message: 'Result ID required' });

  await db.prepare('UPDATE sq_result SET trash_status = 1 WHERE id = ?').bind(id).run();
  return c.json({ status: 'success', message: 'Đã xóa kết quả thi' });
});
