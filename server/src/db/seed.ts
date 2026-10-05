import { db } from './connection.js';
import { initSchema } from './schema.js';
import crypto from 'node:crypto';

export function seedData() {
  initSchema();

  // Check if already seeded
  const check = db.prepare('SELECT count(*) as count FROM sq_account_type').get() as { count: number };
  if (check && check.count > 0) {
    return;
  }

  console.log('Seeding initial data into SQLite...');

  // 1. Account Types
  const insertAccountType = db.prepare(`
    INSERT INTO sq_account_type (id, account_name, access_permissions)
    VALUES (?, ?, ?)
  `);
  insertAccountType.run(1, 'Admin', 'all');
  insertAccountType.run(2, 'User', 'myAccount,myQuiz,attemptQuiz,myResult,resultView');

  // 2. Groups
  const insertGroup = db.prepare(`
    INSERT INTO sq_group (id, group_name) VALUES (?, ?)
  `);
  insertGroup.run(1, 'Default');
  insertGroup.run(2, 'Student-Group-1');
  insertGroup.run(3, 'Student-Group-2');

  // 3. Users
  // md5('admin') = '21232f297a57a5a743894a0e4a801fc3'
  // md5('123456') = 'e10adc3949ba59abbe56e057f20f883e'
  const insertUser = db.prepare(`
    INSERT INTO sq_user (id, username, password, email, full_name, account_type_id, group_ids, user_token)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const adminPwd = crypto.createHash('md5').update('admin').digest('hex');
  const userPwd = crypto.createHash('md5').update('123456').digest('hex');

  insertUser.run(1, 'admin', adminPwd, 'admin@savquiz.com', 'System Administrator', 1, '1', '');
  insertUser.run(2, 'user001', adminPwd, 'user001@savquiz.com', 'John Doe', 2, '1,2', '');
  insertUser.run(3, 'student', userPwd, 'student@savquiz.com', 'Student Demo', 2, '1', '');

  // 4. Categories
  const insertCat = db.prepare(`
    INSERT INTO sq_category (id, category_name, parent_id) VALUES (?, ?, ?)
  `);
  insertCat.run(1, 'Toán học (Math)', 0);
  insertCat.run(2, 'Khoa học (Science)', 0);
  insertCat.run(3, 'Đại số (Algebra)', 1);

  // 5. Questions
  const insertQ = db.prepare(`
    INSERT INTO sq_question (id, question_type, question, description, category_ids)
    VALUES (?, ?, ?, ?, ?)
  `);
  insertQ.run(
    1,
    'Multiple Choice Single Answer',
    '<p>Tính giá trị của biểu thức:</p><p>\\[\\sqrt{16} + 2^3\\]</p>',
    'Giải thích: sqrt(16) = 4, 2^3 = 8 => 4 + 8 = 12',
    1
  );
  insertQ.run(
    2,
    'Multiple Choice Multiple Answers',
    '<p>Những số nào sau đây là số nguyên tố?</p>',
    'Các số nguyên tố là 2, 3, 5, 7...',
    1
  );
  insertQ.run(
    3,
    'Short Answer',
    '<p>Thủ đô của Việt Nam là gì?</p>',
    'Hà Nội',
    2
  );

  // 6. Options
  const insertOpt = db.prepare(`
    INSERT INTO sq_option (id, question_id, question_option, score) VALUES (?, ?, ?, ?)
  `);
  // Q1 options
  insertOpt.run(1, 1, '10', 0);
  insertOpt.run(2, 1, '12', 1);
  insertOpt.run(3, 1, '14', 0);
  insertOpt.run(4, 1, '16', 0);

  // Q2 options
  insertOpt.run(5, 2, '2', 0.5);
  insertOpt.run(6, 2, '3', 0.5);
  insertOpt.run(7, 2, '4', 0);
  insertOpt.run(8, 2, '9', 0);

  // Q3 option (correct text)
  insertOpt.run(9, 3, 'Hà Nội,ha noi,Hanoi', 1);

  // 7. Quiz
  const now = Math.floor(Date.now() / 1000);
  const oneYearLater = now + 365 * 24 * 3600;
  const insertQuiz = db.prepare(`
    INSERT INTO sq_quiz (
      id, quiz_name, description, start_datetime, end_datetime,
      qids, gids, max_attempt, min_pass_percentage, correct_score,
      incorrect_score, duration, show_result
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertQuiz.run(
    1,
    'Đề Thi Trắc Nghiệm Mẫu',
    'Bài thi kiểm tra kiến thức tổng hợp Toán học & Xã hội.',
    now - 3600,
    oneYearLater,
    '1,2,3',
    '1,2,3',
    10,
    50,
    1,
    -0.25,
    30,
    1
  );

  // 8. Settings
  const insertSetting = db.prepare(`
    INSERT INTO sq_setting (id, label_name, setting_name, setting_value, order_by)
    VALUES (?, ?, ?, ?, ?)
  `);
  insertSetting.run(1, 'Tên hệ thống', 'site_name', 'Savquiz Platform', 1);
  insertSetting.run(2, 'Email hỗ trợ', 'admin_email', 'admin@savquiz.com', 2);

  console.log('Seed completed successfully!');
}

if (process.argv[1] && process.argv[1].endsWith('seed.ts')) {
  seedData();
}
