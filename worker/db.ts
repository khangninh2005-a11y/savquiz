// Cloudflare D1 Database Helper and Automatic Migration
let schemaInitialized = false;

export async function ensureSchema(db: D1Database) {
  if (schemaInitialized) return;
  try {
    await db.exec(`
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

      CREATE TABLE IF NOT EXISTS sq_question_type (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type_code TEXT NOT NULL UNIQUE,
        type_name TEXT NOT NULL,
        description TEXT DEFAULT '',
        trash_status INTEGER DEFAULT 0,
        created_time TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS sq_media (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        filename TEXT NOT NULL UNIQUE,
        mime_type TEXT NOT NULL,
        data_base64 TEXT NOT NULL,
        created_time TEXT DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_user_token ON sq_user(user_token);
      CREATE INDEX IF NOT EXISTS idx_user_username ON sq_user(username);
      CREATE INDEX IF NOT EXISTS idx_question_category ON sq_question(category_ids);
      CREATE INDEX IF NOT EXISTS idx_option_question ON sq_option(question_id);
      CREATE INDEX IF NOT EXISTS idx_result_user_quiz ON sq_result(uid, quid);
      CREATE INDEX IF NOT EXISTS idx_answer_rid ON sq_answer(rid);
    `);

    // Check if initial seed is needed
    const check = await db.prepare('SELECT count(*) as count FROM sq_account_type').first<{ count: number }>();
    if (!check || check.count === 0) {
      await db.batch([
        db.prepare("INSERT OR IGNORE INTO sq_account_type (id, account_name, access_permissions) VALUES (1, 'Admin', 'all'), (2, 'User', 'myAccount,myQuiz,attemptQuiz,myResult,resultView'), (3, 'Teacher', 'all')"),
        db.prepare("INSERT OR IGNORE INTO sq_group (id, group_name) VALUES (1, 'Default'), (2, 'Student-Group-1'), (3, 'Student-Group-2')"),
        db.prepare("INSERT OR IGNORE INTO sq_user (id, username, password, email, full_name, account_type_id, group_ids, user_token) VALUES (1, 'admin', '21232f297a57a5a743894a0e4a801fc3', 'admin@savquiz.com', 'System Administrator', 1, '1', ''), (2, 'user001', '21232f297a57a5a743894a0e4a801fc3', 'user001@savquiz.com', 'John Doe', 2, '1,2', ''), (3, 'student', 'e10adc3949ba59abbe56e057f20f883e', 'student@savquiz.com', 'Student Demo', 2, '1', '')"),
        db.prepare("INSERT OR IGNORE INTO sq_category (id, category_name, parent_id) VALUES (1, 'Toán học (Math)', 0), (2, 'Khoa học (Science)', 0), (3, 'Đại số (Algebra)', 1)"),
        db.prepare("INSERT OR IGNORE INTO sq_setting (id, label_name, setting_name, setting_value, order_by) VALUES (1, 'Tên hệ thống', 'site_name', 'Savquiz Platform', 1), (2, 'Email hỗ trợ', 'admin_email', 'admin@savquiz.com', 2)"),
        db.prepare(`INSERT OR IGNORE INTO sq_question_type (id, type_code, type_name, description) VALUES
          (1, 'Multiple Choice Single Answer', 'Trắc nghiệm một đáp án', 'Chọn duy nhất 1 đáp án đúng trong các phương án.'),
          (2, 'Multiple Choice Multiple Answers', 'Trắc nghiệm nhiều đáp án', 'Chọn một hoặc nhiều đáp án đúng.'),
          (3, 'True / False', 'Đúng / Sai', 'Chọn phương án Đúng hoặc Sai.'),
          (4, 'Short Answer', 'Trả lời ngắn / Điền từ', 'Nhập câu trả lời ngắn, so khớp với đáp án được cấu hình.'),
          (5, 'Match / Ordering', 'Nối cặp / Sắp xếp', 'Nối các cặp tương ứng hoặc sắp xếp theo thứ tự.'),
          (6, 'Essay / Numerical', 'Tự luận / Tự nhập số', 'Nhập câu trả lời tự luận hoặc giá trị số.')`)
      ]);
    }

    schemaInitialized = true;
  } catch (err) {
    console.error('Error ensuring D1 schema:', err);
  }
}
