import { FastifyRequest, FastifyReply } from 'fastify';
import { db } from '../db/connection.js';

export interface AuthUser {
  id: number;
  username: string;
  email: string;
  full_name: string | null;
  account_type_id: number;
  group_ids: string;
  user_token: string;
  access_permissions: string;
  account_name: string;
}

export function getUserFromToken(token?: string): AuthUser | null {
  if (!token) return null;
  const stmt = db.prepare(`
    SELECT u.*, a.access_permissions, a.account_name
    FROM sq_user u
    JOIN sq_account_type a ON u.account_type_id = a.id
    WHERE u.user_token = ? AND u.trash_status = 0
  `);
  const row = stmt.get(token) as AuthUser | undefined;
  return row || null;
}

export function hasPermission(user: AuthUser, permission: string): boolean {
  if (!user.access_permissions) return false;
  if (user.access_permissions === 'all') return true;
  const perms = user.access_permissions.split(',').map((p) => p.trim());
  return perms.includes(permission) || perms.includes('all');
}

export async function requireAuth(
  req: FastifyRequest,
  reply: FastifyReply
): Promise<AuthUser | void> {
  const body = (req.body || {}) as Record<string, any>;
  const token =
    body.user_token ||
    (req.headers['authorization']?.replace('Bearer ', '') as string) ||
    (req.query as any)?.user_token;

  if (!token) {
    reply.status(200).send({
      status: 'failed',
      message: 'Token required',
    });
    return;
  }

  const user = getUserFromToken(token);
  if (!user) {
    reply.status(200).send({
      status: 'failed',
      message: 'Invalid token, Re-login',
    });
    return;
  }

  return user;
}
