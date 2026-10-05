import type { Context } from 'hono';
import crypto from 'node:crypto';

export async function getBody(c: Context): Promise<Record<string, any>> {
  const contentType = c.req.header('content-type') || '';
  if (contentType.includes('application/json')) {
    return c.req.json().catch(() => ({}));
  }
  const body = await c.req.parseBody().catch(() => ({}));
  return body as Record<string, any>;
}

export function parseBodyData(body: Record<string, any>): Record<string, any> {
  const res = { ...body };
  if (body.fData) {
    try {
      const arr = typeof body.fData === 'string' ? JSON.parse(body.fData) : body.fData;
      if (Array.isArray(arr)) {
        const optionTexts: string[] = [];
        const optionScores: number[] = [];
        const optionIds: any[] = [];

        for (const item of arr) {
          if (item && item.name !== undefined) {
            const name = item.name;
            const val = item.value;

            if (name === 'option[]' || name === 'option') {
              optionTexts.push(val);
            } else if (name === 'score[]' || name === 'score') {
              optionScores.push(Number(val) || 0);
            } else if (name === 'option_id[]' || name === 'option_id') {
              optionIds.push(val);
            } else {
              res[name] = val;
            }
          }
        }

        if (optionTexts.length > 0) {
          res['option[]'] = optionTexts;
          res['score[]'] = optionScores;
          res.options = optionTexts.map((text, idx) => ({
            id: optionIds[idx],
            option: text,
            question_option: text,
            score: optionScores[idx] !== undefined ? optionScores[idx] : 0,
          }));
        }
      }
    } catch {}
  }
  return res;
}

export function hasPermission(user: any, permission: string): boolean {
  if (!user || !user.access_permissions) return false;
  if (user.access_permissions === 'all') return true;
  const perms = user.access_permissions.split(',').map((p: string) => p.trim());
  return perms.includes(permission) || perms.includes('all');
}

export function hashPassword(password: string): string {
  // Ultra-fast SHA-256 (CPU-friendly for Cloudflare Workers free plan 10ms limit)
  return crypto.createHash('sha256').update(password).digest('hex');
}

export function verifyPassword(password: string, storedHash: string): boolean {
  if (!storedHash || !password) return false;

  // 1. Check MD5 (Savquiz legacy default)
  const md5Hash = crypto.createHash('md5').update(password).digest('hex');
  if (storedHash.toLowerCase() === md5Hash.toLowerCase()) {
    return true;
  }

  // 2. Check SHA-256
  const sha256Hash = crypto.createHash('sha256').update(password).digest('hex');
  if (storedHash.toLowerCase() === sha256Hash.toLowerCase()) {
    return true;
  }

  // 3. Plain text fallback
  if (storedHash === password) {
    return true;
  }

  // 4. Legacy scrypt with safe low iteration count
  if (storedHash.startsWith('scrypt:')) {
    try {
      const parts = storedHash.split(':');
      if (parts.length === 3) {
        const salt = parts[1];
        const key = parts[2];
        const derivedKey = crypto.scryptSync(password, salt, 64, { N: 1024, r: 8, p: 1 });
        return key.toString('hex') === key;
      }
    } catch {}
  }

  return false;
}

export async function getUser(c: Context, db: D1Database): Promise<any | null> {
  let token = c.req.header('Authorization') || '';
  if (!token) {
    const url = new URL(c.req.url);
    token = url.searchParams.get('user_token') || '';
  }
  if (!token) {
    const body = await getBody(c);
    token = body.user_token || '';
  }
  if (!token) return null;

  const user = await db
    .prepare(`
      SELECT u.id, u.username, u.email, u.full_name, u.account_type_id, u.group_ids,
             a.account_name, a.access_permissions
      FROM sq_user u
      JOIN sq_account_type a ON u.account_type_id = a.id
      WHERE u.user_token = ? AND u.trash_status = 0
    `)
    .bind(token)
    .first<any>();

  return user || null;
}

export async function requireAuth(c: Context, db: D1Database): Promise<any | null> {
  const user = await getUser(c, db);
  if (!user) {
    return null;
  }
  return user;
}
