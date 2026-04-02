const router = require('express').Router();
const db     = require('../database/db');
const { requireAuth } = require('../middleware/auth');

const VALID_CLASSES = [
  'PRI1','PRI2','PRI3','PRI4','PRI5','PRI6',
  'JSS1','JSS2','JSS3',
  'SS1','SS2','SS3'
];

// ── GET /api/students ─────────────────────────────────────────
// Query params: class, search, page, limit
router.get('/', requireAuth, async (req, res) => {
  const { class: cls, search, page = 1, limit = 50 } = req.query;
  const offset = (Number(page) - 1) * Number(limit);

  let where  = [];
  let params = [];

  if (cls) {
    where.push('s.class = ?');
    params.push(cls.toUpperCase());
  }
  if (search) {
    where.push('(s.first_name LIKE ? OR s.last_name LIKE ? OR s.middle_name LIKE ? OR s.student_code LIKE ?)');
    const like = `%${search}%`;
    params.push(like, like, like, like);
  }

  const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';

  try {
    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) AS total FROM students s ${whereClause}`,
      params
    );

    const [rows] = await db.query(
      `SELECT s.id, s.first_name, s.middle_name, s.last_name, s.class, s.student_code, s.created_at,
              st.name AS added_by
       FROM students s
       JOIN staff st ON s.created_by = st.id
       ${whereClause}
       ORDER BY s.class, s.last_name, s.first_name
       LIMIT ? OFFSET ?`,
      [...params, Number(limit), offset]
    );

    res.json({ success: true, total, page: Number(page), data: rows });
  } catch (err) {
    console.error('[STUDENTS/GET]', err.message);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── GET /api/students/:id ─────────────────────────────────────
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT s.*, st.name AS added_by
       FROM students s JOIN staff st ON s.created_by = st.id
       WHERE s.id = ?`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Student not found.' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error('[STUDENTS/GETID]', err.message);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── POST /api/students ────────────────────────────────────────
router.post('/', requireAuth, async (req, res) => {
  const { first_name, middle_name, last_name, class: cls } = req.body;

  if (!first_name || !last_name || !cls) {
    return res.status(400).json({ success: false, message: 'First name, last name and class are required.' });
  }
  if (!VALID_CLASSES.includes(cls.toUpperCase())) {
    return res.status(400).json({ success: false, message: `Invalid class. Must be one of: ${VALID_CLASSES.join(', ')}` });
  }

  try {
    // Generate a unique student code: STU-YYYY-NNNNN
    const year = new Date().getFullYear();
    const [[{ count }]] = await db.query('SELECT COUNT(*) AS count FROM students');
    const padded        = String(count + 1).padStart(5, '0');
    const student_code  = `STU-${year}-${padded}`;

    const [result] = await db.query(
      `INSERT INTO students (first_name, middle_name, last_name, class, student_code, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        first_name.trim(),
        middle_name ? middle_name.trim() : null,
        last_name.trim(),
        cls.toUpperCase(),
        student_code,
        req.staff.id
      ]
    );

    res.status(201).json({ success: true, message: 'Student added.', id: result.insertId, student_code });
  } catch (err) {
    console.error('[STUDENTS/POST]', err.message);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── PUT /api/students/:id ─────────────────────────────────────
router.put('/:id', requireAuth, async (req, res) => {
  const { first_name, middle_name, last_name, class: cls } = req.body;

  if (!first_name || !last_name || !cls) {
    return res.status(400).json({ success: false, message: 'First name, last name and class are required.' });
  }
  if (!VALID_CLASSES.includes(cls.toUpperCase())) {
    return res.status(400).json({ success: false, message: 'Invalid class.' });
  }

  try {
    const [result] = await db.query(
      `UPDATE students SET first_name=?, middle_name=?, last_name=?, class=? WHERE id=?`,
      [first_name.trim(), middle_name?.trim() || null, last_name.trim(), cls.toUpperCase(), req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Student not found.' });
    }

    res.json({ success: true, message: 'Student updated.' });
  } catch (err) {
    console.error('[STUDENTS/PUT]', err.message);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── GET /api/students/classes/list ───────────────────────────
router.get('/classes/list', requireAuth, (req, res) => {
  res.json({ success: true, data: VALID_CLASSES });
});

module.exports = router;
