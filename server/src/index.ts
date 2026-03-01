import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.js';
import kanbanRoutes from './routes/kanban.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

// Session timeout tracking middleware
const sessionActivity = new Map<string, number>();

app.use((req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const lastActivity = sessionActivity.get(token);
    const now = Date.now();
    
    // 30 min inactivity timeout
    if (lastActivity && now - lastActivity > 30 * 60 * 1000) {
      sessionActivity.delete(token);
      res.status(401).json({ error: 'Session expired due to inactivity' });
      return;
    }
    
    sessionActivity.set(token, now);
  }
  next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/kanban', kanbanRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`🚀 Command Centre API running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
});
