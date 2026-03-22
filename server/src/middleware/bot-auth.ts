import { Request, Response, NextFunction } from 'express';

const BOT_API_KEY = process.env.BOT_API_KEY;

export interface BotAuthRequest extends Request {
  user?: {
    id: string;
    username: string;
  };
}

export const botAuthMiddleware = (
  req: BotAuthRequest,
  res: Response,
  next: NextFunction
): void => {
  const botKey = req.headers['x-bot-key'] as string;

  if (botKey && BOT_API_KEY && botKey === BOT_API_KEY) {
    // Attach bot user to request
    req.user = {
      id: 'bot',
      username: 'openclaw',
    };
    next();
    return;
  }

  // Not a valid bot key, continue to next middleware (JWT check)
  next();
};
