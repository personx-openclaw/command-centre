import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const BOT_API_KEY = process.env.BOT_API_KEY;

export interface AuthRequest extends Request {
  userId?: string;
  user?: {
    id: string;
    username: string;
  };
}

const loginAttempts = new Map<string, { count: number; lockUntil: number }>();

export const rateLimitLogin = (req: Request, res: Response, next: NextFunction): void => {
  const ip = req.ip || 'unknown';
  const now = Date.now();
  const attempt = loginAttempts.get(ip);

  if (attempt && attempt.lockUntil > now) {
    const remainingSeconds = Math.ceil((attempt.lockUntil - now) / 1000);
    res.status(429).json({ 
      error: `Too many attempts. Try again in ${remainingSeconds}s` 
    });
    return;
  }

  if (!attempt || attempt.lockUntil < now) {
    loginAttempts.set(ip, { count: 1, lockUntil: 0 });
  } else {
    attempt.count++;
    if (attempt.count >= 5) {
      attempt.lockUntil = now + 60000; // 60s lockout
    }
  }

  next();
};

export const authMiddleware = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  // Check for bot API key first
  const botKey = req.headers['x-bot-key'] as string;
  
  if (botKey && BOT_API_KEY && botKey === BOT_API_KEY) {
    // Valid bot key - attach bot user
    req.userId = 'bot';
    req.user = {
      id: 'bot',
      username: 'openclaw',
    };
    next();
    return;
  }

  // Fall back to JWT check
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    req.userId = decoded.userId;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};
