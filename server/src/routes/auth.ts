import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { db, schema } from '../db/index.js';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';
import { rateLimitLogin } from '../middleware/auth.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-change-me';

// Login
router.post('/login', rateLimitLogin, async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      res.status(400).json({ error: 'Username and password required' });
      return;
    }

    const user = await db.query.users.findFirst({
      where: eq(schema.users.username, username),
    });

    if (!user) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);

    if (!valid) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    // Generate tokens
    const accessToken = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '15m' });
    const refreshToken = jwt.sign({ userId: user.id }, JWT_REFRESH_SECRET, { expiresIn: '7d' });

    // Store refresh token
    const tokenId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    
    await db.insert(schema.refreshTokens).values({
      id: tokenId,
      userId: user.id,
      token: refreshToken,
      expiresAt,
    });

    // Set refresh token as httpOnly cookie
    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.json({
      user: { id: user.id, username: user.username, createdAt: user.createdAt },
      token: accessToken,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Refresh token
router.post('/refresh', async (req, res) => {
  try {
    const refreshToken = req.cookies.refresh_token;

    if (!refreshToken) {
      res.status(401).json({ error: 'No refresh token' });
      return;
    }

    const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET) as { userId: string };

    // Check if token exists in DB
    const storedToken = await db.query.refreshTokens.findFirst({
      where: eq(schema.refreshTokens.token, refreshToken),
    });

    if (!storedToken || new Date(storedToken.expiresAt) < new Date()) {
      res.status(401).json({ error: 'Invalid refresh token' });
      return;
    }

    const accessToken = jwt.sign({ userId: decoded.userId }, JWT_SECRET, { expiresIn: '15m' });

    res.json({ token: accessToken });
  } catch (error) {
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});

// Logout
router.post('/logout', async (req, res) => {
  try {
    const refreshToken = req.cookies.refresh_token;

    if (refreshToken) {
      await db.delete(schema.refreshTokens).where(eq(schema.refreshTokens.token, refreshToken));
    }

    res.clearCookie('refresh_token');
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Logout failed' });
  }
});

// Verify token
router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };

    const user = await db.query.users.findFirst({
      where: eq(schema.users.id, decoded.userId),
    });

    if (!user) {
      res.status(401).json({ error: 'User not found' });
      return;
    }

    res.json({
      user: { id: user.id, username: user.username, createdAt: user.createdAt },
    });
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

export default router;
