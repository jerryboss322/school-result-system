require('dotenv').config();

const express     = require('express');
const cors        = require('cors');
const path        = require('path');
const rateLimit   = require('express-rate-limit');

const authRoutes    = require('./routes/auth');
const studentRoutes = require('./routes/students');
const resultRoutes  = require('./routes/results');
const pinRoutes     = require('./routes/pins');
const subjectRoutes = require('./routes/subjects');
const staffRoutes   = require('./routes/staff');

const app  = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', 1); // Required for Railway (reverse proxy) — fixes express-rate-limit

// ── Middleware ────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));

// ── Rate limiting ─────────────────────────────────────────────
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,   // 15 minutes
  max:      10,
  message:  { success: false, message: 'Too many login attempts. Please wait 15 minutes.' }
});

const checkerLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,   // 10 minutes
  max:      20,
  message:  { success: false, message: 'Too many requests. Please wait a moment.' }
});

// ── API Routes ────────────────────────────────────────────────
app.use('/api/auth',     loginLimiter, authRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/results',  resultRoutes);
app.use('/api/pins',     checkerLimiter, pinRoutes);
app.use('/api/subjects', subjectRoutes);
app.use('/api/staff',    staffRoutes);

// ── SPA Fallback ──────────────────────────────────────────────
// Redirect unknown routes to appropriate HTML pages
app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, 'public', 'dashboard.html')));
app.get('/login',     (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));
app.get('/',          (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// ── 404 catch-all ─────────────────────────────────────────────
app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ success: false, message: 'Route not found.' });
  }
  res.redirect('/');
});

// ── Start ─────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🏫  School Result System running on http://localhost:${PORT}`);
  console.log(`🔑  Staff Login  → http://localhost:${PORT}/login`);
  console.log(`📋  Dashboard   → http://localhost:${PORT}/dashboard`);
  console.log(`✅  Checker     → http://localhost:${PORT}/\n`);
});

module.exports = app;
