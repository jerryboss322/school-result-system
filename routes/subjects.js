const router = require('express').Router();
const db     = require('../database/db');
const { requireAuth } = require('../middleware/auth');

const VALID_CATEGORIES = ['all', 'primary', 'junior', 'senior'];

// ── GET /api/subjects ─────────────────────────────────────────
router.get('/', requireAuth, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT id, name, category FROM subjects ORDER BY category, name`
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('[SUBJECTS/GET]', err.message);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── POST /api/subjects ────────────────────────────────────────
router.post('/', requireAuth, async (req, res) => {
  const { name, category } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ success: false, message: 'Subject name is required.' });
  }
  if (!VALID_CATEGORIES.includes(category)) {
    return res.status(400).json({ success: false, message: `Category must be one of: ${VALID_CATEGORIES.join(', ')}` });
  }

  try {
    const [result] = await db.query(
      'INSERT INTO subjects (name, category) VALUES (?, ?)',
      [name.trim(), category]
    );
    res.status(201).json({ success: true, message: 'Subject added.', id: result.insertId });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'A subject with that name already exists.' });
    }
    console.error('[SUBJECTS/POST]', err.message);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── PUT /api/subjects/:id ─────────────────────────────────────
router.put('/:id', requireAuth, async (req, res) => {
  const { name, category } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ success: false, message: 'Subject name is required.' });
  }
  if (!VALID_CATEGORIES.includes(category)) {
    return res.status(400).json({ success: false, message: `Category must be one of: ${VALID_CATEGORIES.join(', ')}` });
  }

  try {
    const [result] = await db.query(
      'UPDATE subjects SET name = ?, category = ? WHERE id = ?',
      [name.trim(), category, req.params.id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Subject not found.' });
    }
    res.json({ success: true, message: 'Subject updated.' });
  } catch (err) {
    console.error('[SUBJECTS/PUT]', err.message);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── DELETE /api/subjects/:id ──────────────────────────────────
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    // Check if subject is used in any results
    const [[{ count }]] = await db.query(
      'SELECT COUNT(*) AS count FROM results WHERE subject_id = ?',
      [req.params.id]
    );
    if (count > 0) {
      return res.status(409).json({
        success: false,
        message: `Cannot delete — this subject has ${count} result record(s) linked to it.`
      });
    }

    const [result] = await db.query('DELETE FROM subjects WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Subject not found.' });
    }
    res.json({ success: true, message: 'Subject deleted.' });
  } catch (err) {
    console.error('[SUBJECTS/DELETE]', err.message);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;
