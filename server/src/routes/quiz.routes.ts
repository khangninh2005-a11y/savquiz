import { FastifyInstance } from 'fastify';
import { db } from '../db/connection.js';
import { requireAuth } from '../middlewares/auth.js';
import { parseBodyData } from './user.routes.js';

export function deterministicShuffle<T>(array: T[], seed: number): T[] {
  const arr = [...array];
  let s = Math.abs(seed) || 1;
  const nextRandom = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(nextRandom() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function calculateResultScores(
  qids: number[],
  quiz: any,
  answersMap: Record<number, string>
) {
  const correctScorePerQuestion = Number(quiz.correct_score) || 1;
  const incorrectPenalty = Number(quiz.incorrect_score) || 0;
  const maxScore = qids.length * correctScorePerQuestion;
  const indScores: number[] = [];
  let totalScore = 0;
  let noCorrected = 0;
  let noIncorrected = 0;
  let noUnanswered = 0;

  for (const qid of qids) {
    const q = db.prepare('SELECT * FROM sq_question WHERE id = ?').get(qid) as any;
    const opts = db.prepare('SELECT * FROM sq_option WHERE question_id = ? AND trash_status = 0').all(qid) as any[];
    const userAns = answersMap[qid];
    const userAnsStr = String(userAns ?? '').trim();
    const hasAnswered =
      userAns !== undefined &&
      userAns !== null &&
      userAnsStr !== '' &&
      userAnsStr !== '[]' &&
      userAnsStr !== '[""]';

    let score = 0;

    if (!hasAnswered) {
      score = 0;
      noUnanswered++;
    } else if (q && opts.length > 0) {
      const cleanAns = userAnsStr.replace(/^[\[\s"']+|[\]\s"']+$/g, '').trim();

      if (q.question_type === 'Multiple Choice Single Answer' || q.question_type === 'True / False') {
        const matchedOpt = opts.find((o) =>
          String(o.id) === cleanAns ||
          String(o.id) === userAnsStr ||
          String(o.question_option).trim().toLowerCase() === cleanAns.toLowerCase()
        );
        if (matchedOpt && Number(matchedOpt.score) > 0) {
          score = correctScorePerQuestion;
        } else {
          score = incorrectPenalty;
        }
      } else if (q.question_type === 'Multiple Choice Multiple Answers') {
        const chosenSet = new Set<string>();
        if (userAnsStr.startsWith('[') && userAnsStr.endsWith(']')) {
          try {
            const parsed = JSON.parse(userAnsStr);
            if (Array.isArray(parsed)) {
              parsed.forEach((v) => chosenSet.add(String(v).trim()));
            }
          } catch {}
        }
        userAnsStr.split(',').forEach((s) => {
          const t = s.trim().replace(/^['"]+|['"]+$/g, '');
          if (t) chosenSet.add(t);
        });

        const correctOpts = opts.filter((o) => Number(o.score) > 0);
        const wrongOpts = opts.filter((o) => Number(o.score) <= 0);

        let multiScore = 0;
        const pointsPerCorrect = correctScorePerQuestion / (correctOpts.length || 1);
        const penaltyPerWrong = wrongOpts.length > 0 ? correctScorePerQuestion / wrongOpts.length : pointsPerCorrect;

        for (const opt of opts) {
          const optId = String(opt.id);
          const optText = String(opt.question_option).trim();
          const isChosen = chosenSet.has(optId) || chosenSet.has(optText);

          if (isChosen) {
            if (Number(opt.score) > 0) {
              multiScore += pointsPerCorrect;
            } else {
              multiScore -= penaltyPerWrong;
            }
          }
        }

        score = Math.max(incorrectPenalty, Math.min(correctScorePerQuestion, Math.round(multiScore * 100) / 100));
      } else if (q.question_type === 'Short Answer') {
        const cleanShort = userAnsStr.trim().toLowerCase();
        const correctAnswers = opts.flatMap((o: any) =>
          (o.question_option || '').split(',')
        ).map((s: string) => s.trim().toLowerCase()).filter(Boolean);

        if (correctAnswers.includes(cleanShort)) {
          score = correctScorePerQuestion;
        } else {
          score = incorrectPenalty;
        }
      } else if (
        q.question_type === 'Match / Ordering' ||
        String(q.question_type) === '5' ||
        String(q.question_type).toLowerCase().includes('match') ||
        String(q.question_type).toLowerCase().includes('nối')
      ) {
        const correctPairs: Record<string, string> = {};
        opts.forEach((o: any) => {
          const optStr = String(o.question_option || '');
          let left = '';
          let right = '';
          if (optStr.includes(':::')) {
            const parts = optStr.split(':::');
            left = parts[0]?.trim().toLowerCase();
            right = parts.slice(1).join(':::').trim().toLowerCase();
          } else if (optStr.includes('===')) {
            const parts = optStr.split('===');
            left = parts[0]?.trim().toLowerCase();
            right = parts.slice(1).join('===').trim().toLowerCase();
          } else if (optStr.includes(' -> ')) {
            const parts = optStr.split(' -> ');
            left = parts[0]?.trim().toLowerCase();
            right = parts.slice(1).join(' -> ').trim().toLowerCase();
          }
          if (left && right) {
            correctPairs[left] = right;
          }
        });

        let userPairs: Record<string, string> = {};
        if (userAnsStr.startsWith('{') && userAnsStr.endsWith('}')) {
          try {
            const parsed = JSON.parse(userAnsStr);
            Object.entries(parsed).forEach(([k, v]) => {
              userPairs[String(k).trim().toLowerCase()] = String(v).trim().toLowerCase();
            });
          } catch {}
        } else {
          userAnsStr.split(',').forEach((item) => {
            const sep = item.includes(':::') ? ':::' : item.includes('===') ? '===' : '->';
            const parts = item.split(sep);
            if (parts.length >= 2) {
              userPairs[parts[0].trim().toLowerCase()] = parts[1].trim().toLowerCase();
            }
          });
        }

        const totalPairs = Object.keys(correctPairs).length;
        if (totalPairs > 0) {
          let matchedCount = 0;
          Object.entries(correctPairs).forEach(([l, r]) => {
            if (userPairs[l] === r) {
              matchedCount++;
            }
          });
          const matchRatio = matchedCount / totalPairs;
          score = Math.round(correctScorePerQuestion * matchRatio * 100) / 100;
        } else {
          score = incorrectPenalty;
        }
      }

      if (score > 0) {
        noCorrected++;
      } else {
        noIncorrected++;
      }
    } else {
      noUnanswered++;
    }

    totalScore += score;
    indScores.push(Math.round(score * 100) / 100);
  }

  totalScore = Math.max(0, Math.min(maxScore, Math.round(totalScore * 100) / 100));
  const percentage = maxScore > 0 ? Math.min(100, Math.max(0, Math.round((totalScore / maxScore) * 100 * 10) / 10)) : 0;
  const score10 = maxScore > 0 ? Math.min(10, Math.max(0, Math.round(((totalScore / maxScore) * 10) * 10) / 10)) : 0;
  const minPassPercentage = Number(quiz.min_pass_percentage) || 0;
  const passStatus = percentage >= minPassPercentage ? 'Pass' : 'Fail';

  return {
    totalScore,
    maxScore,
    percentage,
    score10,
    passStatus,
    indScores,
    noCorrected,
    noIncorrected,
    noUnanswered,
  };
}

export async function quizRoutes(fastify: FastifyInstance) {
  // POST /quiz/getList
  fastify.post('/quiz/getList', async (req, reply) => {
    const user = await requireAuth(req, reply);
    if (!user) return;

    const body = (req.body || {}) as Record<string, any>;
    const search = (body.search || '').trim();
    const id = body.id;
    const limit = Number(body.limit) || 0;
    const maxRowsPerPage = Number(body.maxRowsPerPage) || 30;

    let query = `SELECT * FROM sq_quiz WHERE trash_status = 0`;
    const params: any[] = [];

    if (id) {
      query += ` AND id = ?`;
      params.push(id);
    } else if (search) {
      query += ` AND (quiz_name LIKE ? OR description LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`);
    }

    query += ` ORDER BY id DESC LIMIT ? OFFSET ?`;
    params.push(maxRowsPerPage, limit);

    const rows = db.prepare(query).all(...params);
    return reply.send({ status: 'success', message: '', data: rows });
  });

  // POST /quiz/getMyList
  fastify.post('/quiz/getMyList', async (req, reply) => {
    const user = await requireAuth(req, reply);
    if (!user) return;

    const userGroupIds = (user.group_ids || '1').split(',').map((g) => g.trim());
    const allQuizzes = db.prepare(`SELECT * FROM sq_quiz WHERE trash_status = 0 ORDER BY id DESC`).all() as any[];

    // Filter quizzes accessible to this user's groups
    const filtered = allQuizzes.filter((q) => {
      if (user.account_type_id === 1) return true; // Admin sees all
      const quizGids = (q.gids || '').split(',').map((g: string) => g.trim());
      return quizGids.some((gid: string) => userGroupIds.includes(gid));
    });

    return reply.send({ status: 'success', message: '', data: filtered });
  });

  // POST /quiz/add
  fastify.post('/quiz/add', async (req, reply) => {
    const user = await requireAuth(req, reply);
    if (!user) return;

    const raw = (req.body || {}) as Record<string, any>;
    const data = parseBodyData(raw);

    const quizName = data.quiz_name || '';
    if (!quizName) return reply.send({ status: 'failed', message: 'Quiz name is required' });

    const desc = data.description || '';
    const now = Math.floor(Date.now() / 1000);
    const start = data.start_datetime ? Math.floor(new Date(data.start_datetime).getTime() / 1000) : now;
    const end = data.end_datetime ? Math.floor(new Date(data.end_datetime).getTime() / 1000) : now + 365 * 86400;
    const duration = Number(data.duration) || 10;
    const qids = Array.isArray(data['qids[]']) ? data['qids[]'].join(',') : data.qids || '';
    const gids = Array.isArray(data['gids[]']) ? data['gids[]'].join(',') : data.gids || '1';
    const maxAttempt = Number(data.max_attempt) || 100;
    const minPass = Number(data.min_pass_percentage) || 40;
    const correctScore = Number(data.correct_score) || 1;
    const incorrectScore = Number(data.incorrect_score) || 0;
    const showResult = Number(data.show_result) ?? 1;
    const shuffleQuestions = Number(data.shuffle_questions) ? 1 : 0;
    const shuffleOptions = Number(data.shuffle_options) ? 1 : 0;
    const quizPassword = (data.quiz_password || '').trim();
    const matrixConfig = typeof data.matrix_config === 'string' ? data.matrix_config : (data.matrix_config ? JSON.stringify(data.matrix_config) : '');
    const antiCheating = Number(data.anti_cheating) ? 1 : 0;
    const maxTabSwitches = Number(data.max_tab_switches) || 3;

    const stmt = db.prepare(`
      INSERT INTO sq_quiz (
        quiz_name, description, start_datetime, end_datetime,
        duration, qids, gids, max_attempt, min_pass_percentage,
        correct_score, incorrect_score, show_result,
        shuffle_questions, shuffle_options, quiz_password,
        matrix_config, anti_cheating, max_tab_switches
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const res = stmt.run(
      quizName, desc, start, end,
      duration, qids, gids, maxAttempt, minPass,
      correctScore, incorrectScore, showResult,
      shuffleQuestions, shuffleOptions, quizPassword,
      matrixConfig, antiCheating, maxTabSwitches
    );

    return reply.send({
      status: 'success',
      id: Number(res.lastInsertRowid),
      message: 'Quiz created successfully',
    });
  });

  // POST /quiz/edit
  fastify.post('/quiz/edit', async (req, reply) => {
    const user = await requireAuth(req, reply);
    if (!user) return;

    const raw = (req.body || {}) as Record<string, any>;
    const data = parseBodyData(raw);
    const id = Number(data.id);
    if (!id) return reply.send({ status: 'failed', message: 'Quiz ID required' });

    const qids = Array.isArray(data['qids[]']) ? data['qids[]'].join(',') : data.qids;
    const gids = Array.isArray(data['gids[]']) ? data['gids[]'].join(',') : data.gids;

    const fields: string[] = [];
    const params: any[] = [];

    if (data.quiz_name) { fields.push('quiz_name = ?'); params.push(data.quiz_name); }
    if (data.description !== undefined) { fields.push('description = ?'); params.push(data.description); }
    if (data.duration) { fields.push('duration = ?'); params.push(Number(data.duration)); }
    if (data.start_datetime) {
      fields.push('start_datetime = ?');
      params.push(Math.floor(new Date(data.start_datetime).getTime() / 1000));
    }
    if (data.end_datetime) {
      fields.push('end_datetime = ?');
      params.push(Math.floor(new Date(data.end_datetime).getTime() / 1000));
    }
    if (qids !== undefined) { fields.push('qids = ?'); params.push(qids); }
    if (gids !== undefined) { fields.push('gids = ?'); params.push(gids); }
    if (data.max_attempt) { fields.push('max_attempt = ?'); params.push(Number(data.max_attempt)); }
    if (data.min_pass_percentage) { fields.push('min_pass_percentage = ?'); params.push(Number(data.min_pass_percentage)); }
    if (data.correct_score !== undefined) { fields.push('correct_score = ?'); params.push(Number(data.correct_score)); }
    if (data.incorrect_score !== undefined) { fields.push('incorrect_score = ?'); params.push(Number(data.incorrect_score)); }
    if (data.shuffle_questions !== undefined) { fields.push('shuffle_questions = ?'); params.push(Number(data.shuffle_questions) ? 1 : 0); }
    if (data.shuffle_options !== undefined) { fields.push('shuffle_options = ?'); params.push(Number(data.shuffle_options) ? 1 : 0); }
    if (data.quiz_password !== undefined) { fields.push('quiz_password = ?'); params.push(String(data.quiz_password).trim()); }
    if (data.matrix_config !== undefined) {
      const cfg = typeof data.matrix_config === 'string' ? data.matrix_config : JSON.stringify(data.matrix_config);
      fields.push('matrix_config = ?');
      params.push(cfg);
    }
    if (data.anti_cheating !== undefined) { fields.push('anti_cheating = ?'); params.push(Number(data.anti_cheating) ? 1 : 0); }
    if (data.max_tab_switches !== undefined) { fields.push('max_tab_switches = ?'); params.push(Number(data.max_tab_switches) || 3); }

    if (fields.length > 0) {
      params.push(id);
      db.prepare(`UPDATE sq_quiz SET ${fields.join(', ')} WHERE id = ?`).run(...params);
    }

    return reply.send({ status: 'success', id, message: 'Quiz updated successfully' });
  });

  // POST /quiz/remove
  fastify.post('/quiz/remove', async (req, reply) => {
    const user = await requireAuth(req, reply);
    if (!user) return;

    const body = (req.body || {}) as Record<string, any>;
    const id = Number(body.id);
    if (!id) return reply.send({ status: 'failed', message: 'Quiz ID required' });

    db.prepare('UPDATE sq_quiz SET trash_status = 1 WHERE id = ?').run(id);
    return reply.send({ status: 'success', message: 'Quiz removed successfully' });
  });

  // POST /quiz/addQuestionIntoQuiz
  fastify.post('/quiz/addQuestionIntoQuiz', async (req, reply) => {
    const user = await requireAuth(req, reply);
    if (!user) return;

    const body = (req.body || {}) as Record<string, any>;
    const quid = Number(body.quid);
    const qid = Number(body.qid);
    if (!quid || !qid) {
      return reply.send({ status: 'failed', message: 'quid and qid required' });
    }

    const quiz = db.prepare('SELECT qids FROM sq_quiz WHERE id = ?').get(quid) as any;
    if (!quiz) return reply.send({ status: 'failed', message: 'Quiz not found' });

    const qids = (quiz.qids || '').split(',').map((s: string) => s.trim()).filter(Boolean);
    if (!qids.includes(String(qid))) {
      qids.push(String(qid));
    }
    const newQids = qids.join(',');
    db.prepare('UPDATE sq_quiz SET qids = ? WHERE id = ?').run(newQids, quid);

    return reply.send({
      status: 'success',
      message: 'Question added into quiz successfully',
      qids: newQids,
    });
  });

  // POST /quiz/removeQuestionIntoQuiz
  fastify.post('/quiz/removeQuestionIntoQuiz', async (req, reply) => {
    const user = await requireAuth(req, reply);
    if (!user) return;

    const body = (req.body || {}) as Record<string, any>;
    const quid = Number(body.quid);
    const qid = Number(body.qid);
    if (!quid || !qid) {
      return reply.send({ status: 'failed', message: 'quid and qid required' });
    }

    const quiz = db.prepare('SELECT qids FROM sq_quiz WHERE id = ?').get(quid) as any;
    if (!quiz) return reply.send({ status: 'failed', message: 'Quiz not found' });

    const qids = (quiz.qids || '').split(',').map((s: string) => s.trim()).filter(Boolean);
    const filtered = qids.filter((id: string) => id !== String(qid));
    const newQids = filtered.join(',');
    db.prepare('UPDATE sq_quiz SET qids = ? WHERE id = ?').run(newQids, quid);

    return reply.send({
      status: 'success',
      message: 'Question removed from quiz successfully',
      qids: newQids,
    });
  });

  // POST /quiz/assignQuestions
  fastify.post('/quiz/assignQuestions', async (req, reply) => {
    const user = await requireAuth(req, reply);
    if (!user) return;

    const body = (req.body || {}) as Record<string, any>;
    const quid = Number(body.quid);
    if (!quid) {
      return reply.send({ status: 'failed', message: 'quid required' });
    }

    let qids = '';
    if (Array.isArray(body.qids)) {
      qids = body.qids.map(Number).filter((n: number) => !isNaN(n) && n > 0).join(',');
    } else if (typeof body.qids === 'string') {
      qids = body.qids;
    }

    db.prepare('UPDATE sq_quiz SET qids = ? WHERE id = ?').run(qids, quid);
    return reply.send({
      status: 'success',
      message: 'Questions updated successfully',
      qids,
    });
  });

  // POST /quiz/changeQidsOrder
  fastify.post('/quiz/changeQidsOrder', async (req, reply) => {
    const user = await requireAuth(req, reply);
    if (!user) return;

    const body = (req.body || {}) as Record<string, any>;
    const quid = Number(body.quid);
    let assignedQids = body.assigned_qids;
    if (typeof assignedQids === 'string') {
      try {
        const parsed = JSON.parse(assignedQids);
        if (Array.isArray(parsed)) assignedQids = parsed.join(',');
      } catch {
        // keep as is
      }
    } else if (Array.isArray(assignedQids)) {
      assignedQids = assignedQids.join(',');
    }

    if (!quid || !assignedQids) {
      return reply.send({ status: 'failed', message: 'quid and assigned_qids required' });
    }

    db.prepare('UPDATE sq_quiz SET qids = ? WHERE id = ?').run(String(assignedQids), quid);
    return reply.send({ status: 'success', message: 'Order updated successfully' });
  });

  // POST /quiz/validateQuiz (Start Attempt)
  fastify.post('/quiz/validateQuiz', async (req, reply) => {
    const user = await requireAuth(req, reply);
    if (!user) return;

    const body = (req.body || {}) as Record<string, any>;
    const quid = Number(body.quid || body.id);
    if (!quid) return reply.send({ status: 'failed', message: 'Quiz ID required' });

    const quiz = db.prepare('SELECT * FROM sq_quiz WHERE id = ? AND trash_status = 0').get(quid) as any;
    if (!quiz) return reply.send({ status: 'failed', message: 'Quiz not found' });

    // 1. Password check
    if (quiz.quiz_password && quiz.quiz_password.trim() !== '') {
      const userProvidedPass = (body.quiz_password || body.password || '').trim();
      if (!userProvidedPass || userProvidedPass !== quiz.quiz_password.trim()) {
        return reply.send({
          status: 'failed',
          require_password: true,
          message: userProvidedPass ? 'Mật khẩu bài thi không chính xác' : 'Bài thi yêu cầu mã PIN / mật khẩu truy cập',
        });
      }
    }

    const now = Math.floor(Date.now() / 1000);

    // 2. Strict time window check (unless admin previewing)
    if (user.account_type_id !== 1) {
      if (quiz.start_datetime && now < quiz.start_datetime) {
        const startStr = new Date(quiz.start_datetime * 1000).toLocaleString('vi-VN');
        return reply.send({
          status: 'failed',
          message: `Bài thi chưa mở. Thời gian bắt đầu: ${startStr}`,
        });
      }
      if (quiz.end_datetime && now > quiz.end_datetime) {
        return reply.send({
          status: 'failed',
          message: 'Bài thi đã kết thúc thời gian cho phép làm bài.',
        });
      }
    }

    // 3. Attempt count check
    if (user.account_type_id !== 1) {
      const finishedRow = db.prepare(`
        SELECT count(*) as count FROM sq_result
        WHERE quid = ? AND uid = ? AND result_status != 'Open' AND trash_status = 0
      `).get(quid, user.id) as { count: number };
      const maxAttempts = Number(quiz.max_attempt) || 100;
      if (finishedRow && finishedRow.count >= maxAttempts) {
        return reply.send({
          status: 'failed',
          message: `Bạn đã sử dụng hết số lượt thi cho phép (${maxAttempts} lượt).`,
        });
      }
    }

    // Check existing Open result
    let result = db.prepare(`
      SELECT * FROM sq_result
      WHERE quid = ? AND uid = ? AND result_status = 'Open' AND trash_status = 0
      ORDER BY id DESC LIMIT 1
    `).get(quid, user.id) as any;

    const durationSec = (quiz.duration || 10) * 60;

    if (!result) {
      // 4. Determine assigned questions: Dynamic Matrix Quiz OR Fixed Qids
      let assignedQids = quiz.qids || '';

      if (quiz.matrix_config && quiz.matrix_config.trim()) {
        try {
          const matrixRules = typeof quiz.matrix_config === 'string'
            ? JSON.parse(quiz.matrix_config)
            : quiz.matrix_config;

          if (Array.isArray(matrixRules) && matrixRules.length > 0) {
            const matrixQids: number[] = [];
            for (const rule of matrixRules) {
              const cid = Number(rule.category_id || rule.cid);
              const diff = (rule.difficulty || rule.difficulty_level || '').trim();
              const count = Number(rule.count || rule.num_questions) || 1;

              let qSql = 'SELECT id FROM sq_question WHERE trash_status = 0';
              const qParams: any[] = [];
              if (cid && cid > 0) {
                qSql += ' AND category_ids = ?';
                qParams.push(cid);
              }
              if (diff) {
                qSql += ' AND difficulty_level = ?';
                qParams.push(diff);
              }
              qSql += ' ORDER BY RANDOM() LIMIT ?';
              qParams.push(count);

              const pulled = db.prepare(qSql).all(...qParams) as { id: number }[];
              pulled.forEach((p) => matrixQids.push(p.id));
            }
            if (matrixQids.length > 0) {
              assignedQids = Array.from(new Set(matrixQids)).join(',');
            }
          }
        } catch (e) {
          console.error('Failed to parse matrix_config:', e);
        }
      }

      if (Number(quiz.shuffle_questions) === 1 && assignedQids.trim()) {
        const qidArr = assignedQids.split(',').map((s: string) => s.trim()).filter(Boolean);
        // Fisher-Yates random shuffle for this new attempt
        for (let i = qidArr.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [qidArr[i], qidArr[j]] = [qidArr[j], qidArr[i]];
        }
        assignedQids = qidArr.join(',');
      }

      const colorCodes = assignedQids
        ? assignedQids.split(',').map(() => 'notvisited').join(',')
        : '';

      const insertRes = db.prepare(`
        INSERT INTO sq_result (
          quid, uid, attempted_datetime, assigned_qids, color_codes,
          response_time, last_ping, result_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'Open')
      `).run(quid, user.id, now, assignedQids, colorCodes, now, now);

      result = db.prepare('SELECT * FROM sq_result WHERE id = ?').get(insertRes.lastInsertRowid) as any;
    }

    const maxDateTime = (result.attempted_datetime + durationSec) * 1000;

    return reply.send({
      status: 'success',
      rid: result.id,
      maximum_datetime: maxDateTime,
      anti_cheating: Number(quiz.anti_cheating) ? 1 : 0,
      max_tab_switches: Number(quiz.max_tab_switches) || 3,
      data: result,
    });
  });

  // POST /quiz/logEvent (Log anti-cheat violation / tab-switch)
  fastify.post('/quiz/logEvent', async (req, reply) => {
    const user = await requireAuth(req, reply);
    if (!user) return;

    const body = (req.body || {}) as Record<string, any>;
    const rid = Number(body.rid);
    const eventType = body.event || 'tab_switch';
    const now = Math.floor(Date.now() / 1000);

    if (!rid) return reply.send({ status: 'failed', message: 'Result ID required' });

    const result = db.prepare('SELECT * FROM sq_result WHERE id = ? AND trash_status = 0').get(rid) as any;
    if (!result) return reply.send({ status: 'failed', message: 'Result not found' });

    const quiz = db.prepare('SELECT * FROM sq_quiz WHERE id = ?').get(result.quid) as any;
    const maxAllowed = Number(quiz?.max_tab_switches) || 3;

    // Log the event
    db.prepare(`
      INSERT INTO sq_logs (log_time, log_event, rid, uid)
      VALUES (?, ?, ?, ?)
    `).run(now, eventType, rid, user.id);

    // Count tab_switch violations for this attempt
    const countRow = db.prepare(`
      SELECT count(*) as count FROM sq_logs
      WHERE rid = ? AND log_event = 'tab_switch'
    `).get(rid) as { count: number };

    const violations = countRow ? countRow.count : 1;
    const shouldTerminate = violations >= maxAllowed;

    return reply.send({
      status: 'success',
      violations,
      max_allowed: maxAllowed,
      should_terminate: shouldTerminate,
    });
  });

  // POST /quiz/getQuestions
  fastify.post('/quiz/getQuestions', async (req, reply) => {
    const user = await requireAuth(req, reply);
    if (!user) return;

    const body = (req.body || {}) as Record<string, any>;
    const rid = Number(body.rid);
    const quid = Number(body.quid);

    const quiz = db.prepare('SELECT * FROM sq_quiz WHERE id = ?').get(quid) as any;
    if (!quiz) return reply.send({ status: 'failed', message: 'Quiz not found' });

    let qidsStr = quiz.qids || '';
    if (rid) {
      const resRow = db.prepare('SELECT assigned_qids FROM sq_result WHERE id = ?').get(rid) as any;
      if (resRow && resRow.assigned_qids) {
        qidsStr = resRow.assigned_qids;
      }
    }

    const qids = qidsStr.split(',').map((id: string) => Number(id.trim())).filter(Boolean);
    if (qids.length === 0) {
      return reply.send({ status: 'failed', message: 'No questions assigned to this quiz' });
    }

    const placeholders = qids.map(() => '?').join(',');
    const rawQuestions = db.prepare(`
      SELECT q.id, q.question_type, qt.type_name as question_type_name, q.question, q.category_ids, q.difficulty_level, q.media_url, q.media_type
      FROM sq_question q
      LEFT JOIN sq_question_type qt ON q.question_type = qt.type_code
      WHERE q.id IN (${placeholders}) AND q.trash_status = 0
    `).all(...qids) as any[];

    // Ensure questions are sorted in the exact assigned order
    const qMap = new Map(rawQuestions.map((q: any) => [q.id, q]));
    const questions = qids.map((id: number) => qMap.get(id)).filter(Boolean) as any[];

    // Fetch user answers if rid exists
    const userAnswers: Record<number, string> = {};
    if (rid) {
      const answers = db.prepare('SELECT question_id, user_response FROM sq_answer WHERE rid = ?').all(rid) as any[];
      answers.forEach((ans) => {
        userAnswers[ans.question_id] = ans.user_response;
      });
    }

    const optStmt = db.prepare(`
      SELECT id, question_id, question_option
      FROM sq_option
      WHERE question_id = ? AND trash_status = 0
      ORDER BY id ASC
    `);

    const shouldShuffleOptions = Number(quiz.shuffle_options) === 1;

    const result = questions.map((q) => {
      let options = optStmt.all(q.id) as any[];
      if (shouldShuffleOptions && options.length > 1) {
        // Deterministic shuffle by rid and question id so options order stays stable across reloads
        options = deterministicShuffle(options, (rid || 42) * 10007 + q.id);
      }
      return {
        question: q,
        options,
        user_response: userAnswers[q.id] || null,
      };
    });

    return reply.send({ status: 'success', message: '', data: result });
  });

  // POST /quiz/saveAnswer
  fastify.post('/quiz/saveAnswer', async (req, reply) => {
    const user = await requireAuth(req, reply);
    if (!user) return;

    const raw = (req.body || {}) as Record<string, any>;
    const data = parseBodyData(raw);

    const rid = Number(data.rid || raw.rid);
    const quid = Number(data.quid || raw.quid);
    const qid = Number(data.question_id || data.qid || raw.question_id || raw.qid);
    let responseVal = data.user_response !== undefined 
      ? data.user_response 
      : (raw.user_response !== undefined ? raw.user_response : '');

    if (Array.isArray(responseVal)) {
      responseVal = responseVal.join(',');
    } else {
      responseVal = String(responseVal ?? '');
    }

    const now = Math.floor(Date.now() / 1000);

    if (!rid || !qid) {
      return reply.send({ status: 'failed', message: 'rid and question_id required' });
    }

    // Upsert answer
    const existing = db.prepare('SELECT id FROM sq_answer WHERE rid = ? AND question_id = ?').get(rid, qid) as any;
    if (existing) {
      db.prepare(`UPDATE sq_answer SET user_response = ?, response_time = ? WHERE id = ?`).run(responseVal, now, existing.id);
    } else {
      db.prepare(`
        INSERT INTO sq_answer (uid, quid, rid, question_id, user_response, response_time)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(user.id, quid, rid, qid, responseVal, now);
    }

    // Update last_ping in result
    db.prepare('UPDATE sq_result SET last_ping = ? WHERE id = ?').run(now, rid);

    return reply.send({ status: 'success', message: 'Answer saved' });
  });

  // POST /quiz/submitQuiz (also accepts /submitQuiz/:rid)
  fastify.post('/quiz/submitQuiz/:rid?', async (req, reply) => {
    const user = await requireAuth(req, reply);
    if (!user) return;

    const params = req.params as Record<string, any>;
    const body = (req.body || {}) as Record<string, any>;
    const rid = Number(params.rid || body.rid);

    if (!rid) return reply.send({ status: 'failed', message: 'Result ID required' });

    const result = db.prepare('SELECT * FROM sq_result WHERE id = ?').get(rid) as any;
    if (!result) return reply.send({ status: 'failed', message: 'Result not found' });

    const quiz = db.prepare('SELECT * FROM sq_quiz WHERE id = ?').get(result.quid) as any;
    if (!quiz) return reply.send({ status: 'failed', message: 'Quiz not found' });

    // Save any direct answers passed in body
    const rawAnswers = body.answers;
    if (rawAnswers && typeof rawAnswers === 'object') {
      const now = Math.floor(Date.now() / 1000);
      for (const [qIdStr, val] of Object.entries(rawAnswers)) {
        const qid = Number(qIdStr);
        if (!qid) continue;
        const respStr = Array.isArray(val) ? (val as any[]).join(',') : String(val ?? '');
        const existing = db.prepare('SELECT id FROM sq_answer WHERE rid = ? AND question_id = ?').get(rid, qid) as any;
        if (existing) {
          db.prepare(`UPDATE sq_answer SET user_response = ? WHERE id = ?`).run(respStr, existing.id);
        } else {
          db.prepare(`
            INSERT INTO sq_answer (uid, quid, rid, question_id, user_response, response_time)
            VALUES (?, ?, ?, ?, ?, ?)
          `).run(user.id, result.quid, rid, qid, respStr, now);
        }
      }
    }

    // Calculate score using calculateResultScores
    const answers = db.prepare('SELECT * FROM sq_answer WHERE rid = ?').all(rid) as any[];
    const answersMap: Record<number, string> = {};
    answers.forEach((a) => { answersMap[a.question_id] = a.user_response; });

    const qids = (result.assigned_qids || quiz.qids || '').split(',').map((id: string) => Number(id.trim())).filter(Boolean);
    const calculated = calculateResultScores(qids, quiz, answersMap);

    const now = Math.floor(Date.now() / 1000);
    const timeSpent = Math.max(1, now - (result.attempted_datetime || now));

    db.prepare(`
      UPDATE sq_result
      SET obtained_score = ?, obtained_percentage = ?, result_status = ?,
          result_generated_time = ?, result_generated_by = 'User',
          time_spent = ?, ind_score = ?
      WHERE id = ?
    `).run(calculated.totalScore, calculated.percentage, calculated.passStatus, now, timeSpent, calculated.indScores.join(','), rid);

    return reply.send({
      status: 'success',
      message: 'Quiz submitted successfully',
      rid,
      obtained_score: calculated.totalScore,
      max_score: calculated.maxScore,
      score_10: calculated.score10,
      obtained_percentage: calculated.percentage,
      result_status: calculated.passStatus,
    });
  });
}
