import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';

import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverDataDir = path.resolve(__dirname, '../../data');
const dataDir = fs.existsSync(serverDataDir)
  ? serverDataDir
  : (fs.existsSync(path.resolve(process.cwd(), 'server/data'))
      ? path.resolve(process.cwd(), 'server/data')
      : path.resolve(process.cwd(), 'data'));

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'savquiz.db');
export const db = new DatabaseSync(dbPath);

// Enable WAL mode for high concurrent performance and integrity
db.exec('PRAGMA journal_mode = WAL;');
