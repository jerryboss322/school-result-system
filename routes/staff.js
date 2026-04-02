const router = require('express').Router();
const bcrypt = require('bcryptjs');
const db     = require('../database/db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

// All routes here require login + admin role
router.use(requireAuth, requireAdmin);

// ── GET /api/staff ────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT id, name, email, role, created_at FROM staff ORDER BY role DESC, name ASC`
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('[STAFF/GET]', err.message);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── POST /api/staff  (create) ─────────────────────────────────
router.post('/', async (req, res) => {
  const { name, email, password, role } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ success: false, message: 'Name, email and password are required.' });
  }
  if (password.length < 8) {
    return res.status(400).json({ success: false, message: 'Password must be at least 8 characters.' });
  }

  try {
    const hashed  = await bcrypt.hash(password, 12);
    const safeRole = ['admin', 'staff'].includes(role) ? role : 'staff';

    const [result] = await db.query(
      'INSERT INTO staff (name, email, password, role) VALUES (?, ?, ?, ?)',
      [name.trim(), email.trim().toLowerCase(), hashed, safeRole]
    );

    res.status(201).json({ success: true, message: 'Staff account created.', id: result.insertId });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'That email is already registered.' });
    }
    console.error('[STAFF/POST]', err.message);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── PUT /api/staff/:id  (edit name, email, role, optional new password) ──
router.put('/:id', async (req, res) => {
  const { name, email, role, password } = req.body;

  if (!name || !email) {
    return res.status(400).json({ success: false, message: 'Name and email are required.' });
  }
  if (!['admin', 'staff'].includes(role)) {
    return res.status(400).json({ success: false, message: 'Role must be admin or staff.' });
  }

  // Prevent an admin from demoting themselves
  if (parseInt(req.params.id) === req.staff.id && role !== 'admin') {
    return res.status(400).json({ success: false, message: 'You cannot change your own role.' });
  }

  try {
    if (password) {
      if (password.length < 8) {
        return res.status(400).json({ success: false, message: 'New password must be at least 8 characters.' });
      }
      const hashed = await bcrypt.hash(password, 12);
      await db.query(
        'UPDATE staff SET name = ?, email = ?, role = ?, password = ? WHERE id = ?',
        [name.trim(), email.trim().toLowerCase(), role, hashed, req.params.id]
      );
    } else {
      await db.query(
        'UPDATE staff SET name = ?, email = ?, role = ? WHERE id = ?',
        [name.trim(), email.trim().toLowerCase(), role, req.params.id]
      );
    }

    res.json({ success: true, message: 'Staff account updated.' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'That email is already in use.' });
    }
    console.error('[STAFF/PUT]', err.message);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── DELETE /api/staff/:id ─────────────────────────────────────
router.delete('/:id', async (req, res) => {
  // Prevent self-deletion
  if (parseInt(req.params.id) === req.staff.id) {
    return res.status(400).json({ success: false, message: 'You cannot delete your own account.' });
  }

  try {
    const [result] = await db.query('DELETE FROM staff WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Staff member not found.' });
    }
    res.json({ success: true, message: 'Staff account deleted.' });
  } catch (err) {
    console.error('[STAFF/DELETE]', err.message);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;
