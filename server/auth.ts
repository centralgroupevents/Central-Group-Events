import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface AdminJwtPayload {
  id: number;
  email: string;
  role: string;
}

declare global {
  namespace Express {
    interface Request {
      adminUser?: AdminJwtPayload;
    }
  }
}

export function requireAuth(role?: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const token = req.cookies?.cge_admin_jwt;
    if (!token) {
      return res.status(401).json({ message: "Authentication required" });
    }
    try {
      const secret = process.env.SESSION_SECRET || "fallback-secret";
      const payload = jwt.verify(token, secret) as AdminJwtPayload;
      if (role && payload.role !== role) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }
      req.adminUser = payload;
      next();
    } catch {
      return res.status(401).json({ message: "Invalid or expired token" });
    }
  };
}
