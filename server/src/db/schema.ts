import { db } from './connection.js';

export function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sq_account_type (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_name TEXT NOT NULL,
      created_time TEXT DEFAULT (datetime('now')),
      access_permissions TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sq_group (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_name TEXT NOT NULL,
      trash_status INTEGER DEFAULT 0,
      created_time TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sq_user (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      email TEXT NOT NULL,
      full_name TEXT,
      account_type_id INTEGER NOT NULL DEFAULT 2,
      group_ids TEXT NOT NULL DEFAULT '1',
      user_token TEXT DEFAULT '',
      trash_status INTEGER DEFAULT 0,
      created_time TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sq_category (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_name TEXT NOT NULL,
      parent_id INTEGER DEFAULT 0,
      trash_status INTEGER DEFAULT 0,
      created_time TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sq_question (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      question_type TEXT NOT NULL,
      question TEXT NOT NULL,
      description TEXT DEFAULT '',
      category_ids INTEGER NOT NULL DEFAULT 1,
      difficulty_level TEXT DEFAULT 'Thông hiểu',
      media_url TEXT DEFAULT '',
      media_type TEXT DEFAULT '',
      trash_status INTEGER DEFAULT 0,
      created_time TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sq_option (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      question_id INTEGER NOT NULL,
      question_option TEXT NOT NULL,
      score REAL DEFAULT 0,
      trash_status INTEGER DEFAULT 0,
      created_time TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sq_quiz (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quiz_name TEXT NOT NULL,
      description TEXT DEFAULT '',
      start_datetime INTEGER NOT NULL,
      end_datetime INTEGER NOT NULL,
      qids TEXT DEFAULT '',
      gids TEXT DEFAULT '',
      max_attempt INTEGER DEFAULT 100,
      min_pass_percentage REAL DEFAULT 0,
      correct_score REAL DEFAULT 1,
      incorrect_score REAL DEFAULT 0,
      instant_result INTEGER DEFAULT 0,
      duration INTEGER DEFAULT 10,
      show_result INTEGER DEFAULT 1,
      show_result_on_date INTEGER DEFAULT 0,
      shuffle_questions INTEGER DEFAULT 0,
      shuffle_options INTEGER DEFAULT 0,
      quiz_password TEXT DEFAULT '',
      matrix_config TEXT DEFAULT '',
      anti_cheating INTEGER DEFAULT 0,
      max_tab_switches INTEGER DEFAULT 3,
      trash_status INTEGER DEFAULT 0,
      created_time TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sq_result (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quid INTEGER NOT NULL,
      uid INTEGER NOT NULL,
      attempted_datetime INTEGER NOT NULL,
      assigned_qids TEXT DEFAULT '',
      qids_status TEXT DEFAULT '',
      ind_score TEXT DEFAULT '',
      attempted_questions TEXT DEFAULT '',
      time_spent REAL DEFAULT 0,
      ind_time TEXT DEFAULT '',
      result_status TEXT DEFAULT 'Open',
      last_ping INTEGER DEFAULT 0,
      result_generated_time INTEGER DEFAULT 0,
      obtained_score REAL DEFAULT 0,
      obtained_percentage REAL DEFAULT 0,
      result_generated_by TEXT DEFAULT 'Not Generated',
      response_time INTEGER DEFAULT 0,
      color_codes TEXT DEFAULT '',
      trash_status INTEGER DEFAULT 0,
      created_time TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sq_answer (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uid INTEGER NOT NULL,
      quid INTEGER NOT NULL,
      rid INTEGER NOT NULL,
      question_id INTEGER NOT NULL,
      user_response TEXT DEFAULT '',
      response_time INTEGER DEFAULT 0,
      created_time TEXT DEFAULT (datetime('now')),
      trash_status INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS sq_setting (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      label_name TEXT NOT NULL,
      setting_name TEXT NOT NULL UNIQUE,
      setting_value TEXT DEFAULT '',
      order_by INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS sq_metadata (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      meta_type TEXT NOT NULL,
      meta_name TEXT NOT NULL,
      meta_value TEXT NOT NULL,
      ref_id INTEGER NOT NULL,
      trash_status INTEGER DEFAULT 0,
      created_time TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sq_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      log_time INTEGER NOT NULL,
      log_event TEXT NOT NULL,
      rid INTEGER NOT NULL,
      uid INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_user_token ON sq_user(user_token);
    CREATE INDEX IF NOT EXISTS idx_user_username ON sq_user(username);
    CREATE INDEX IF NOT EXISTS idx_question_category ON sq_question(category_ids);
    CREATE INDEX IF NOT EXISTS idx_option_question ON sq_option(question_id);
    CREATE INDEX IF NOT EXISTS idx_result_user_quiz ON sq_result(uid, quid);
    CREATE INDEX IF NOT EXISTS idx_answer_rid ON sq_answer(rid);
    CREATE INDEX IF NOT EXISTS idx_logs_rid ON sq_logs(rid);
  `);

  // Ensure role 3 (Teacher) exists
  try {
    db.prepare(`
      INSERT OR IGNORE INTO sq_account_type (id, account_name, access_permissions)
      VALUES (3, 'Teacher', 'all')
    `).run();
  } catch {}

  // Safe migrations for sq_question
  try { db.exec("ALTER TABLE sq_question ADD COLUMN difficulty_level TEXT DEFAULT 'Thông hiểu'"); } catch {}
  try { db.exec("ALTER TABLE sq_question ADD COLUMN media_url TEXT DEFAULT ''"); } catch {}
  try { db.exec("ALTER TABLE sq_question ADD COLUMN media_type TEXT DEFAULT ''"); } catch {}

  // Safe migrations for sq_quiz
  try { db.exec('ALTER TABLE sq_quiz ADD COLUMN shuffle_questions INTEGER DEFAULT 0'); } catch {}
  try { db.exec('ALTER TABLE sq_quiz ADD COLUMN shuffle_options INTEGER DEFAULT 0'); } catch {}
  try { db.exec("ALTER TABLE sq_quiz ADD COLUMN quiz_password TEXT DEFAULT ''"); } catch {}
  try { db.exec("ALTER TABLE sq_quiz ADD COLUMN matrix_config TEXT DEFAULT ''"); } catch {}
  try { db.exec('ALTER TABLE sq_quiz ADD COLUMN anti_cheating INTEGER DEFAULT 0'); } catch {}
  try { db.exec('ALTER TABLE sq_quiz ADD COLUMN max_tab_switches INTEGER DEFAULT 3'); } catch {}

  // Safe table creation and seeds for sq_question_type
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS sq_question_type (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type_code TEXT NOT NULL UNIQUE,
        type_name TEXT NOT NULL,
        description TEXT DEFAULT '',
        trash_status INTEGER DEFAULT 0,
        created_time TEXT DEFAULT (datetime('now'))
      );
    `);

    const insertType = db.prepare(`
      INSERT OR IGNORE INTO sq_question_type (type_code, type_name, description)
      VALUES (?, ?, ?)
    `);

    const defaultTypes = [
      { code: 'Multiple Choice Single Answer', name: 'Trắc nghiệm một đáp án', desc: 'Chọn duy nhất 1 đáp án đúng trong các phương án.' },
      { code: 'Multiple Choice Multiple Answers', name: 'Trắc nghiệm nhiều đáp án', desc: 'Chọn một hoặc nhiều đáp án đúng.' },
      { code: 'True / False', name: 'Đúng / Sai', desc: 'Chọn phương án Đúng hoặc Sai.' },
      { code: 'Short Answer', name: 'Trả lời ngắn / Điền từ', desc: 'Nhập câu trả lời ngắn, so khớp với đáp án được cấu hình.' },
      { code: 'Match / Ordering', name: 'Nối cặp / Sắp xếp', desc: 'Nối các cặp tương ứng hoặc sắp xếp theo thứ tự.' },
      { code: 'Essay / Numerical', name: 'Tự luận / Tự nhập số', desc: 'Nhập câu trả lời tự luận hoặc giá trị số.' }
    ];

    for (const t of defaultTypes) {
      insertType.run(t.code, t.name, t.desc);
    }
  } catch {}
}

