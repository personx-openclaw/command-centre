import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
  userId?: string;
  isBot?: boolean;
}

export const authMiddleware = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  const BOT_API_KEY = process.env.BOT_API_KEY || '';
  const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

  const botKey = req.headers['x-bot-key'];
  if (BOT_API_KEY && botKey === BOT_API_KEY) {
    req.userId = 'bot';
    req.isBot = true;
    next();
    return;
  }

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
