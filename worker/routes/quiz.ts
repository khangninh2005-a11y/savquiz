import { Hono } from 'hono';
import { getBody, parseBodyData, requireAuth } from '../utils';

export const quizRouter = new Hono<{ Bindings: { DB: D1Database } }>();

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

export async function calculateResultScores(
  db: D1Database,
  qids: number[],
  quiz: any,
  answersMap: Record<number, string>
) {
  const correctScorePerQuestion = Number(quiz.correct_score) || 1;
  const incorrectPenalty = Number(quiz.incorrect_score) || 0;
  const indScores: number[] = [];
  let totalScore = 0;
  let noCorrected = 0;
  let noIncorrected = 0;
  let noUnanswered = 0;

  for (const qid of qids) {
    const q = await db.prepare('SELECT * FROM sq_question WHERE id = ?').bind(qid).first<any>();
    const { results: opts } = await db.prepare('SELECT * FROM sq_option WHERE question_id = ? AND trash_status = 0').bind(qid).all<any>();
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
    } else if (q && opts && opts.length > 0) {
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
      score = 0;
      noUnanswered++;
    }

    indScores.push(score);
    totalScore += score;
  }

  totalScore = Math.max(0, Math.round(totalScore * 100) / 100);
  const maxPossibleScore = qids.length * correctScorePerQuestion;
  const obtainedPercentage = maxPossibleScore > 0 ? Math.round((totalScore / maxPossibleScore) * 10000) / 100 : 0;
  const isPass = obtainedPercentage >= (Number(quiz.min_pass_percentage) || 0);

  return {
    totalScore,
    obtainedPercentage,
    indScores,
    noCorrected,
    noIncorrected,
    noUnanswered,
    resultStatus: isPass ? 'Pass' : 'Fail',
  };
}

quizRouter.post('/quiz/getList', async (c) => {
  const db = c.env.DB;
  const user = await requireAuth(c, db);
  if (!user) return c.json({ status: 'failed', message: 'Unauthorized' }, 401);

  const body = await getBody(c);
  const search = String(body.search || '').trim();
  const limit = Number(body.limit) || 0;
  const maxRowsPerPage = Number(body.maxRowsPerPage) || 30;

  let query = 'SELECT * FROM sq_quiz WHERE trash_status = 0';
  const params: any[] = [];

  if (search) {
    query += ' AND (quiz_name LIKE ? OR description LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }

  query += ' ORDER BY id DESC LIMIT ? OFFSET ?';
  params.push(maxRowsPerPage, limit);

  const { results: quizzes } = await db.prepare(query).bind(...params).all<any>();

  // Attach total questions
  const list = (quizzes || []).map((q) => {
    const qidArr = (q.qids || '').split(',').map((s: string) => s.trim()).filter(Boolean);
    return {
      ...q,
      no_of_questions: qidArr.length,
    };
  });

  return c.json({ status: 'success', message: '', data: list });
});

quizRouter.post('/quiz/getQuiz', async (c) => {
  const db = c.env.DB;
  const user = await requireAuth(c, db);
  if (!user) return c.json({ status: 'failed', message: 'Unauthorized' }, 401);

  const body = await getBody(c);
  const id = Number(body.id || body.quid);
  if (!id) return c.json({ status: 'failed', message: 'Quiz ID required' });

  const quiz = await db.prepare('SELECT * FROM sq_quiz WHERE id = ? AND trash_status = 0').bind(id).first<any>();
  if (!quiz) return c.json({ status: 'failed', message: 'Quiz not found' });

  return c.json({ status: 'success', data: quiz });
});

quizRouter.post('/quiz/add', async (c) => {
  const db = c.env.DB;
  const user = await requireAuth(c, db);
  if (!user) return c.json({ status: 'failed', message: 'Unauthorized' }, 401);

  const raw = await getBody(c);
  const data = parseBodyData(raw);

  const quizName = String(data.quiz_name || '').trim();
  if (!quizName) return c.json({ status: 'failed', message: 'Tên bài thi là bắt buộc' });

  const nowSec = Math.floor(Date.now() / 1000);
  const startDatetime = data.start_datetime ? Math.floor(new Date(data.start_datetime).getTime() / 1000) : nowSec;
  const endDatetime = data.end_datetime ? Math.floor(new Date(data.end_datetime).getTime() / 1000) : nowSec + 365 * 86400;

  const qids = Array.isArray(data['qids[]']) ? data['qids[]'].join(',') : data.qids || '';
  const gids = Array.isArray(data['gids[]']) ? data['gids[]'].join(',') : data.gids || '1';

  const res = await db
    .prepare(`
      INSERT INTO sq_quiz (
        quiz_name, description, start_datetime, end_datetime, qids, gids,
        max_attempt, min_pass_percentage, correct_score, incorrect_score,
        duration, show_result, shuffle_questions, shuffle_options,
        quiz_password, matrix_config, anti_cheating, max_tab_switches
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .bind(
      quizName,
      data.description || '',
      startDatetime,
      endDatetime,
      qids,
      gids,
      Number(data.max_attempt) || 10,
      Number(data.min_pass_percentage) || 50,
      Number(data.correct_score) || 1,
      Number(data.incorrect_score) || 0,
      Number(data.duration) || 30,
      Number(data.show_result ?? 1),
      Number(data.shuffle_questions || 0),
      Number(data.shuffle_options || 0),
      data.quiz_password || '',
      data.matrix_config || '',
      Number(data.anti_cheating || 0),
      Number(data.max_tab_switches || 3)
    )
    .run();

  return c.json({ status: 'success', id: Number(res.meta?.last_row_id || 0), message: 'Tạo bài thi thành công' });
});

quizRouter.post('/quiz/update', async (c) => {
  const db = c.env.DB;
  const user = await requireAuth(c, db);
  if (!user) return c.json({ status: 'failed', message: 'Unauthorized' }, 401);

  const raw = await getBody(c);
  const data = parseBodyData(raw);
  const id = Number(data.id || data.quid);
  if (!id) return c.json({ status: 'failed', message: 'Quiz ID required' });

  const startDatetime = data.start_datetime ? Math.floor(new Date(data.start_datetime).getTime() / 1000) : undefined;
  const endDatetime = data.end_datetime ? Math.floor(new Date(data.end_datetime).getTime() / 1000) : undefined;
  const qids = Array.isArray(data['qids[]']) ? data['qids[]'].join(',') : data.qids;
  const gids = Array.isArray(data['gids[]']) ? data['gids[]'].join(',') : data.gids;

  let query = 'UPDATE sq_quiz SET ';
  const updates: string[] = [];
  const params: any[] = [];

  if (data.quiz_name) { updates.push('quiz_name = ?'); params.push(data.quiz_name); }
  if (data.description !== undefined) { updates.push('description = ?'); params.push(data.description); }
  if (startDatetime !== undefined) { updates.push('start_datetime = ?'); params.push(startDatetime); }
  if (endDatetime !== undefined) { updates.push('end_datetime = ?'); params.push(endDatetime); }
  if (qids !== undefined) { updates.push('qids = ?'); params.push(qids); }
  if (gids !== undefined) { updates.push('gids = ?'); params.push(gids); }
  if (data.max_attempt !== undefined) { updates.push('max_attempt = ?'); params.push(Number(data.max_attempt)); }
  if (data.min_pass_percentage !== undefined) { updates.push('min_pass_percentage = ?'); params.push(Number(data.min_pass_percentage)); }
  if (data.correct_score !== undefined) { updates.push('correct_score = ?'); params.push(Number(data.correct_score)); }
  if (data.incorrect_score !== undefined) { updates.push('incorrect_score = ?'); params.push(Number(data.incorrect_score)); }
  if (data.duration !== undefined) { updates.push('duration = ?'); params.push(Number(data.duration)); }
  if (data.show_result !== undefined) { updates.push('show_result = ?'); params.push(Number(data.show_result)); }
  if (data.shuffle_questions !== undefined) { updates.push('shuffle_questions = ?'); params.push(Number(data.shuffle_questions)); }
  if (data.shuffle_options !== undefined) { updates.push('shuffle_options = ?'); params.push(Number(data.shuffle_options)); }
  if (data.quiz_password !== undefined) { updates.push('quiz_password = ?'); params.push(data.quiz_password); }
  if (data.anti_cheating !== undefined) { updates.push('anti_cheating = ?'); params.push(Number(data.anti_cheating)); }
  if (data.max_tab_switches !== undefined) { updates.push('max_tab_switches = ?'); params.push(Number(data.max_tab_switches)); }

  if (updates.length > 0) {
    query += updates.join(', ') + ' WHERE id = ?';
    params.push(id);
    await db.prepare(query).bind(...params).run();
  }

  return c.json({ status: 'success', message: 'Cập nhật bài thi thành công' });
});

quizRouter.post('/quiz/delete', async (c) => {
  const db = c.env.DB;
  const user = await requireAuth(c, db);
  if (!user) return c.json({ status: 'failed', message: 'Unauthorized' }, 401);

  const body = await getBody(c);
  const id = Number(body.id || body.quid);
  if (!id) return c.json({ status: 'failed', message: 'Quiz ID required' });

  await db.prepare('UPDATE sq_quiz SET trash_status = 1 WHERE id = ?').bind(id).run();
  return c.json({ status: 'success', message: 'Đã xóa bài thi' });
});

quizRouter.post('/quiz/validateQuiz', async (c) => {
  const db = c.env.DB;
  const user = await requireAuth(c, db);
  if (!user) return c.json({ status: 'failed', message: 'Unauthorized' }, 401);

  const body = await getBody(c);
  const quid = Number(body.quid || body.id);
  const password = String(body.quiz_password || body.password || '');
  if (!quid) return c.json({ status: 'failed', message: 'Quiz ID required' });

  const quiz = await db.prepare('SELECT * FROM sq_quiz WHERE id = ? AND trash_status = 0').bind(quid).first<any>();
  if (!quiz) return c.json({ status: 'failed', message: 'Quiz not found' });

  // Password check
  if (quiz.quiz_password && quiz.quiz_password !== password && user.account_type_id !== 1) {
    return c.json({ status: 'failed', message: 'Mật khẩu bài thi không chính xác' });
  }

  // Check ongoing attempt
  const existing = await db
    .prepare("SELECT id FROM sq_result WHERE quid = ? AND uid = ? AND result_status = 'Open' AND trash_status = 0 ORDER BY id DESC")
    .bind(quid, user.id)
    .first<any>();

  if (existing) {
    return c.json({ status: 'success', rid: existing.id });
  }

  // Create new result attempt
  const qids = (quiz.qids || '').split(',').map((s: string) => s.trim()).filter(Boolean);
  let assignedQids = [...qids];
  if (quiz.shuffle_questions) {
    assignedQids = deterministicShuffle(assignedQids, Date.now() + user.id);
  }

  const res = await db
    .prepare(`
      INSERT INTO sq_result (
        quid, uid, attempted_datetime, assigned_qids, qids_status, ind_score,
        attempted_questions, time_spent, ind_time, result_status
      ) VALUES (?, ?, ?, ?, ?, '', '', 0, '', 'Open')
    `)
    .bind(quid, user.id, Math.floor(Date.now() / 1000), assignedQids.join(','), assignedQids.map(() => 'notvisited').join(','))
    .run();

  const rid = Number(res.meta?.last_row_id || 0);
  return c.json({ status: 'success', rid });
});

quizRouter.post('/quiz/getQuestions', async (c) => {
  const db = c.env.DB;
  const user = await requireAuth(c, db);
  if (!user) return c.json({ status: 'failed', message: 'Unauthorized' }, 401);

  const body = await getBody(c);
  const rid = Number(body.rid);
  if (!rid) return c.json({ status: 'failed', message: 'Result ID required' });

  const result = await db.prepare('SELECT * FROM sq_result WHERE id = ? AND trash_status = 0').bind(rid).first<any>();
  if (!result) return c.json({ status: 'failed', message: 'Result session not found' });

  const quiz = await db.prepare('SELECT * FROM sq_quiz WHERE id = ?').bind(result.quid).first<any>();
  if (!quiz) return c.json({ status: 'failed', message: 'Quiz not found' });

  const qids = (result.assigned_qids || quiz.qids || '').split(',').map((s: string) => Number(s.trim())).filter(Boolean);

  // Fetch answers already given
  const { results: answers } = await db.prepare('SELECT question_id, user_response FROM sq_answer WHERE rid = ?').bind(rid).all<any>();
  const answersMap: Record<number, string> = {};
  (answers || []).forEach((a) => {
    answersMap[a.question_id] = a.user_response;
  });

  const questionsList: any[] = [];
  for (const qid of qids) {
    const q = await db
      .prepare('SELECT q.*, c.category_name FROM sq_question q LEFT JOIN sq_category c ON q.category_ids = c.id WHERE q.id = ? AND q.trash_status = 0')
      .bind(qid)
      .first<any>();

    if (q) {
      let { results: options } = await db
        .prepare('SELECT id, question_id, question_option FROM sq_option WHERE question_id = ? AND trash_status = 0 ORDER BY id ASC')
        .bind(qid)
        .all<any>();

      if (quiz.shuffle_options && options && options.length > 0 && q.question_type !== 'Match / Ordering') {
        options = deterministicShuffle(options, rid + qid);
      }

      questionsList.push({
        question: q,
        options: options || [],
        user_response: answersMap[qid] || '',
      });
    }
  }

  return c.json({
    status: 'success',
    quiz,
    result,
    questions: questionsList,
  });
});

quizRouter.post('/quiz/saveAnswer', async (c) => {
  const db = c.env.DB;
  const user = await requireAuth(c, db);
  if (!user) return c.json({ status: 'failed', message: 'Unauthorized' }, 401);

  const body = await getBody(c);
  const rid = Number(body.rid);
  const qid = Number(body.question_id || body.qid);
  const userResponse = String(body.user_response ?? '');

  if (!rid || !qid) return c.json({ status: 'failed', message: 'Missing rid or qid' });

  const existingAns = await db.prepare('SELECT id FROM sq_answer WHERE rid = ? AND question_id = ?').bind(rid, qid).first<any>();
  if (existingAns) {
    await db.prepare('UPDATE sq_answer SET user_response = ? WHERE id = ?').bind(userResponse, existingAns.id).run();
  } else {
    const result = await db.prepare('SELECT quid, uid FROM sq_result WHERE id = ?').bind(rid).first<any>();
    if (result) {
      await db
        .prepare('INSERT INTO sq_answer (uid, quid, rid, question_id, user_response) VALUES (?, ?, ?, ?, ?)')
        .bind(result.uid, result.quid, rid, qid, userResponse)
        .run();
    }
  }

  return c.json({ status: 'success' });
});

quizRouter.post('/quiz/submitQuiz', async (c) => {
  const db = c.env.DB;
  const user = await requireAuth(c, db);
  if (!user) return c.json({ status: 'failed', message: 'Unauthorized' }, 401);

  const body = await getBody(c);
  const rid = Number(body.rid);
  if (!rid) return c.json({ status: 'failed', message: 'Result ID required' });

  const result = await db.prepare('SELECT * FROM sq_result WHERE id = ? AND trash_status = 0').bind(rid).first<any>();
  if (!result) return c.json({ status: 'failed', message: 'Result not found' });

  const quiz = await db.prepare('SELECT * FROM sq_quiz WHERE id = ?').bind(result.quid).first<any>();
  if (!quiz) return c.json({ status: 'failed', message: 'Quiz not found' });

  const qids = (result.assigned_qids || quiz.qids || '').split(',').map((s: string) => Number(s.trim())).filter(Boolean);

  const { results: answers } = await db.prepare('SELECT question_id, user_response FROM sq_answer WHERE rid = ?').bind(rid).all<any>();
  const answersMap: Record<number, string> = {};
  (answers || []).forEach((a) => {
    answersMap[a.question_id] = a.user_response;
  });

  const scoreData = await calculateResultScores(db, qids, quiz, answersMap);

  const nowSec = Math.floor(Date.now() / 1000);
  const timeSpent = Math.max(0, nowSec - (result.attempted_datetime || nowSec));

  await db
    .prepare(`
      UPDATE sq_result
      SET result_status = ?, obtained_score = ?, obtained_percentage = ?,
          ind_score = ?, result_generated_time = ?, time_spent = ?
      WHERE id = ?
    `)
    .bind(
      scoreData.resultStatus,
      scoreData.totalScore,
      scoreData.obtainedPercentage,
      scoreData.indScores.join(','),
      nowSec,
      timeSpent,
      rid
    )
    .run();

  return c.json({
    status: 'success',
    data: {
      rid,
      ...scoreData,
      timeSpent,
    },
  });
});
