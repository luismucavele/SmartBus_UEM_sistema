import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { NextFunction, Request, Response } from "express";
import { query } from "./database/db";

export type Role = "funcionario" | "motorista" | "administrador";
export type AuthUser = { id: number; name: string; email: string; role: Role };

declare global {
  namespace Express {
    interface Request { user?: AuthUser; }
  }
}

const JWT_SECRET = process.env.JWT_SECRET || "smartbus-development-secret-change-me";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "8h";

export function createToken(user: AuthUser) {
  return jwt.sign(user, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN as any });
}

export async function authenticate(email: string, password: string) {
  const rows = await query<any>(`SELECT u.id, u.nome_completo AS name, u.email, u.palavra_passe_hash, p.codigo AS role
    FROM utilizadores u INNER JOIN perfis p ON p.id = u.perfil_id
    WHERE u.email = ? AND u.activo = TRUE LIMIT 1`, [email.toLowerCase().trim()]);
  const account = rows[0];
  if (!account || !(await bcrypt.compare(password, account.palavra_passe_hash))) return null;
  await query("UPDATE utilizadores SET ultimo_login_em = NOW() WHERE id = ?", [account.id]);
  const user: AuthUser = { id: account.id, name: account.name, email: account.email, role: account.role };
  return { user, token: createToken(user) };
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return res.status(401).json({ error: "Autenticação necessária." });
  try {
    req.user = jwt.verify(header.slice(7), JWT_SECRET) as AuthUser;
    return next();
  } catch {
    return res.status(401).json({ error: "Sessão inválida ou expirada." });
  }
}

export function allowRoles(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: "Autenticação necessária." });
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: "Não tem permissão para esta operação." });
    return next();
  };
}
