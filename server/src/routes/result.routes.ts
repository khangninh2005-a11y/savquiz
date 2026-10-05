import { FastifyInstance } from 'fastify';
import { db } from '../db/connection.js';
import { requireAuth } from '../middlewares/auth.js';
import { deterministicShuffle, calculateResultScores } from './quiz.routes.js';

export async function resultRoutes(fastify: FastifyInstance) {
  // POST /result/getList
  fastify.post('/result/getList', async (req, reply) => {
    const user = await requireAuth(req, reply);
    if (!user) return;

    const body = (req.body || {}) as Record<string, any>;
    const search = (body.search || '').trim();
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

    const rows = db.prepare(query).all(...params) as any[];
    const formattedRows = rows.map((r) => {
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

    return reply.send({ status: 'success', message: '', data: formattedRows });
  });

  // POST /result/getMyList
  fastify.post('/result/getMyList', async (req, reply) => {
    const user = await requireAuth(req, reply);
    if (!user) return;

    const body = (req.body || {}) as Record<string, any>;
    const limit = Number(body.limit) || 0;
    const maxRowsPerPage = Number(body.maxRowsPerPage) || 30;

    const rows = db.prepare(`
      SELECT r.*, u.username, u.full_name, q.quiz_name, q.min_pass_percentage,
             q.correct_score, q.qids as quiz_qids
      FROM sq_result r
      JOIN sq_user u ON r.uid = u.id
      JOIN sq_quiz q ON r.quid = q.id
      WHERE r.uid = ? AND r.trash_status = 0
      ORDER BY r.id DESC LIMIT ? OFFSET ?
    `).all(user.id, maxRowsPerPage, limit) as any[];

    const formattedRows = rows.map((r) => {
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

    return reply.send({ status: 'success', message: '', data: formattedRows });
  });

  // POST /result/view
  fastify.post('/result/view', async (req, reply) => {
    const user = await requireAuth(req, reply);
    if (!user) return;

    const body = (req.body || {}) as Record<string, any>;
    const id = Number(body.id || body.rid);
    if (!id) return reply.send({ status: 'failed', message: 'Result ID required' });

    let result = db.prepare(`
      SELECT r.*, u.username, u.full_name, u.email, q.quiz_name, q.description,
             q.min_pass_percentage, q.correct_score, q.incorrect_score, q.duration, q.qids as quiz_qids
      FROM sq_result r
      JOIN sq_user u ON r.uid = u.id
      JOIN sq_quiz q ON r.quid = q.id
      WHERE r.id = ? AND r.trash_status = 0
    `).get(id) as any;

    if (!result) return reply.send({ status: 'failed', message: 'Result not found' });

    const qids = (result.assigned_qids || result.quiz_qids || '')
      .split(',')
      .map((s: string) => Number(s.trim()))
      .filter(Boolean);
    const totalQuestions = qids.length;

    const answers = db.prepare('SELECT question_id, user_response FROM sq_answer WHERE rid = ? AND trash_status = 0').all(id) as any[];
    const answersMap: Record<number, string> = {};
    answers.forEach((a: any) => { answersMap[a.question_id] = a.user_response; });

    let calculated = calculateResultScores(qids, result, answersMap);

    // Auto-repair result record if scores differed (e.g. from previously buggy calculation)
    if (result.result_status !== 'Open' && (result.obtained_score !== calculated.totalScore || result.ind_score !== calculated.indScores.join(','))) {
      db.prepare(`
        UPDATE sq_result
        SET obtained_score = ?, obtained_percentage = ?, result_status = ?, ind_score = ?
        WHERE id = ?
      `).run(calculated.totalScore, calculated.percentage, calculated.passStatus, calculated.indScores.join(','), id);

      result.obtained_score = calculated.totalScore;
      result.obtained_percentage = calculated.percentage;
      result.result_status = calculated.passStatus;
      result.ind_score = calculated.indScores.join(',');
    }

    const timeSpentTotalSec = Math.round(Number(result.time_spent) || 0);
    const timeSpentMin = Math.floor(timeSpentTotalSec / 60);
    const timeSpentSec = timeSpentTotalSec % 60;
    const timeSpentFormatted = timeSpentMin > 0 ? `${timeSpentMin} phút ${timeSpentSec} giây` : `${timeSpentSec} giây`;

    return reply.send({
      status: 'success',
      message: '',
      data: {
        ...result,
        total_questions: totalQuestions,
        max_score: calculated.maxScore,
        no_corrected: calculated.noCorrected,
        no_incorrected: calculated.noIncorrected,
        no_unanswered: calculated.noUnanswered,
        score_10: calculated.score10,
        obtained_score: calculated.totalScore,
        obtained_percentage: calculated.percentage,
        time_spent_in_min: timeSpentFormatted,
      },
    });
  });

  // POST /result/getQuestions
  fastify.post('/result/getQuestions', async (req, reply) => {
    const user = await requireAuth(req, reply);
    if (!user) return;

    const body = (req.body || {}) as Record<string, any>;
    const rid = Number(body.rid || body.id);
    if (!rid) return reply.send({ status: 'failed', message: 'Result ID required' });

    const result = db.prepare('SELECT * FROM sq_result WHERE id = ?').get(rid) as any;
    if (!result) return reply.send({ status: 'failed', message: 'Result not found' });

    const quiz = db.prepare('SELECT * FROM sq_quiz WHERE id = ?').get(result.quid) as any;
    const shouldShuffleOptions = quiz && Number(quiz.shuffle_options) === 1;

    const qids = (result.assigned_qids || quiz?.qids || '').split(',').map((s: string) => Number(s.trim())).filter(Boolean);
    if (qids.length === 0) return reply.send({ status: 'success', data: [] });

    const placeholders = qids.map(() => '?').join(',');
    const rawQuestions = db.prepare(`
      SELECT q.id, q.question_type, qt.type_name as question_type_name, q.question, q.description, q.category_ids, q.difficulty_level, q.media_url, q.media_type
      FROM sq_question q
      LEFT JOIN sq_question_type qt ON q.question_type = qt.type_code
      WHERE q.id IN (${placeholders})
    `).all(...qids) as any[];

    // Ensure questions are sorted in the exact assigned order
    const qMap = new Map(rawQuestions.map((q: any) => [q.id, q]));
    const questions = qids.map((id: number) => qMap.get(id)).filter(Boolean) as any[];

    // User answers
    const answers = db.prepare('SELECT question_id, user_response FROM sq_answer WHERE rid = ? AND trash_status = 0').all(rid) as any[];
    const userAnswers: Record<number, string> = {};
    answers.forEach((a) => { userAnswers[a.question_id] = a.user_response; });

    const calculated = quiz ? calculateResultScores(qids, quiz, userAnswers) : null;

    const optStmt = db.prepare('SELECT id, question_id, question_option, score FROM sq_option WHERE question_id = ? AND trash_status = 0');

    const resultData = questions.map((q, idx) => {
      let options = optStmt.all(q.id) as any[];
      if (shouldShuffleOptions && options.length > 1) {
        options = deterministicShuffle(options, (rid || 42) * 10007 + q.id);
      }
      return {
        question: q,
        options,
        user_response: userAnswers[q.id] || '',
        score_obtained: calculated?.indScores[idx] !== undefined ? calculated.indScores[idx] : null,
        max_score: Number(quiz?.correct_score) || 1,
      };
    });

    return reply.send({ status: 'success', message: '', data: resultData });
  });

  // POST /result/remove
  fastify.post('/result/remove', async (req, reply) => {
    const user = await requireAuth(req, reply);
    if (!user) return;

    const body = (req.body || {}) as Record<string, any>;
    const rawId = body.id || body.rid || body.ids;

    if (!rawId) {
      return reply.send({ status: 'failed', message: 'Result ID required' });
    }

    const ids = Array.isArray(rawId)
      ? rawId.map(Number).filter((n: number) => !isNaN(n) && n > 0)
      : [Number(rawId)].filter((n: number) => !isNaN(n) && n > 0);

    if (ids.length === 0) {
      return reply.send({ status: 'failed', message: 'Invalid Result ID' });
    }

    for (const id of ids) {
      const result = db.prepare('SELECT id, uid FROM sq_result WHERE id = ?').get(id) as any;
      if (result) {
        if (user.account_type_id === 1 || result.uid === user.id) {
          db.prepare('UPDATE sq_result SET trash_status = 1 WHERE id = ?').run(id);
          db.prepare('UPDATE sq_answer SET trash_status = 1 WHERE rid = ?').run(id);
        }
      }
    }

    return reply.send({ status: 'success', message: 'Result removed successfully' });
  });
}
