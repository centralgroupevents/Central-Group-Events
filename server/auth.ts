import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { storage } from "./storage";

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

export async function verifyAdminToken(token: string): Promise<AdminJwtPayload | null> {
  try {
    const secret = process.env.SESSION_SECRET;
    if (!secret) return null;
    const payload = jwt.verify(token, secret) as AdminJwtPayload;
    const admin = await storage.findAdminById(payload.id);
    if (!admin || !admin.isActive || !admin.inviteAccepted) return null;
    return payload;
  } catch {
    return null;
  }
}

export function requireAuth(role?: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const token = req.cookies?.cge_admin_jwt;
    if (!token) {
      return res.status(401).json({ message: "Authentication required" });
    }
    try {
      const secret = process.env.SESSION_SECRET;
      if (!secret) {
        return res.status(500).json({ message: "Server configuration error" });
      }
      const payload = jwt.verify(token, secret) as AdminJwtPayload;
      if (role && payload.role !== role) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }
      const admin = await storage.findAdminById(payload.id);
      if (!admin || !admin.isActive || !admin.inviteAccepted) {
        return res.status(401).json({ message: "Account deactivated or not set up" });
      }
      req.adminUser = payload;
      next();
    } catch {
      return res.status(401).json({ message: "Invalid or expired token" });
    }
  };
}
