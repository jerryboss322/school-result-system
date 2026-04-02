const router = require('express').Router();
const db     = require('../database/db');
const { requireAuth }       = require('../middleware/auth');
const { getGrade, getCategoryForClass } = require('../middleware/grade');

const VALID_TERMS    = ['First', 'Second', 'Third'];
const SESSION_REGEX  = /^\d{4}\/\d{4}$/;

// ── GET /api/results/subjects?class=JSS1 ─────────────────────
router.get('/subjects', requireAuth, async (req, res) => {
  const cls = req.query.class || '';
  const cat = getCategoryForClass(cls);

  try {
    const [rows] = await db.query(
      `SELECT id, name, category FROM subjects
       WHERE category = 'all' OR category = ?
       ORDER BY name`,
      [cat]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('[RESULTS/SUBJECTS]', err.message);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── GET /api/results?student_id=&term=&session= ───────────────
router.get('/', requireAuth, async (req, res) => {
  const { student_id, term, session } = req.query;

  if (!student_id || !term || !session) {
    return res.status(400).json({ success: false, message: 'student_id, term and session are required.' });
  }

  try {
    const [rows] = await db.query(
      `SELECT r.id, r.subject_id, sub.name AS subject_name, r.ca_score, r.exam_score,
              r.total, r.grade, r.remark, r.published
       FROM results r
       JOIN subjects sub ON r.subject_id = sub.id
       WHERE r.student_id = ? AND r.term = ? AND r.session = ?
       ORDER BY sub.name`,
      [student_id, term, session]
    );

    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('[RESULTS/GET]', err.message);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── POST /api/results  (batch upsert for one student/term/session) ──
router.post('/', requireAuth, async (req, res) => {
  const { student_id, term, session, results } = req.body;

  // ── Validate inputs ──────────────────────────────────────────
  if (!student_id || !term || !session || !Array.isArray(results) || results.length === 0) {
    return res.status(400).json({ success: false, message: 'student_id, term, session and results[] are required.' });
  }
  if (!VALID_TERMS.includes(term)) {
    return res.status(400).json({ success: false, message: `term must be one of: ${VALID_TERMS.join(', ')}` });
  }
  if (!SESSION_REGEX.test(session)) {
    return res.status(400).json({ success: false, message: 'session must be in format YYYY/YYYY (e.g. 2023/2024).' });
  }

  // ── Validate student exists ──────────────────────────────────
  try {
    const [[student]] = await db.query('SELECT id FROM students WHERE id = ?', [student_id]);
    if (!student) return res.status(404).json({ success: false, message: 'Student not found.' });
  } catch (e) {
    return res.status(500).json({ success: false, message: 'Server error.' });
  }

  // ── Validate each result entry ───────────────────────────────
  for (const r of results) {
    const ca   = parseFloat(r.ca_score);
    const exam = parseFloat(r.exam_score);
    if (!r.subject_id || isNaN(ca) || isNaN(exam)) {
      return res.status(400).json({ success: false, message: 'Each result needs subject_id, ca_score and exam_score.' });
    }
    if (ca < 0 || ca > 40)   return res.status(400).json({ success: false, message: 'CA score must be 0–40.' });
    if (exam < 0 || exam > 60) return res.status(400).json({ success: false, message: 'Exam score must be 0–60.' });
  }

  try {
    const conn = await db.getConnection();
    await conn.beginTransaction();

    try {
      for (const r of results) {
        const ca    = parseFloat(r.ca_score);
        const exam  = parseFloat(r.exam_score);
        const total = ca + exam;
        const { grade, remark } = getGrade(total);

        await conn.query(
          `INSERT INTO results (student_id, subject_id, term, session, ca_score, exam_score, grade, remark, created_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             ca_score   = VALUES(ca_score),
             exam_score = VALUES(exam_score),
             grade      = VALUES(grade),
             remark     = VALUES(remark),
             created_by = VALUES(created_by)`,
          [student_id, r.subject_id, term, session, ca, exam, grade, remark, req.staff.id]
        );
      }

      await conn.commit();
      conn.release();
      res.json({ success: true, message: `${results.length} result(s) saved successfully.` });
    } catch (err) {
      await conn.rollback();
      conn.release();
      throw err;
    }
  } catch (err) {
    console.error('[RESULTS/POST]', err.message);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── PUT /api/results/:id ──────────────────────────────────────
router.put('/:id', requireAuth, async (req, res) => {
  const { ca_score, exam_score } = req.body;
  const ca   = parseFloat(ca_score);
  const exam = parseFloat(exam_score);

  if (isNaN(ca) || isNaN(exam)) {
    return res.status(400).json({ success: false, message: 'Valid ca_score and exam_score are required.' });
  }
  if (ca < 0 || ca > 40)    return res.status(400).json({ success: false, message: 'CA score must be 0–40.' });
  if (exam < 0 || exam > 60) return res.status(400).json({ success: false, message: 'Exam score must be 0–60.' });

  try {
    // Cannot edit published results unless admin
    const [[existing]] = await db.query('SELECT published FROM results WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ success: false, message: 'Result not found.' });
    if (existing.published && req.staff.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Cannot edit published results.' });
    }

    const total = ca + exam;
    const { grade, remark } = getGrade(total);

    await db.query(
      `UPDATE results SET ca_score=?, exam_score=?, grade=?, remark=?, created_by=? WHERE id=?`,
      [ca, exam, grade, remark, req.staff.id, req.params.id]
    );

    res.json({ success: true, message: 'Result updated.', total, grade, remark });
  } catch (err) {
    console.error('[RESULTS/PUT]', err.message);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── DELETE /api/results/:id ───────────────────────────────────
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const [[existing]] = await db.query('SELECT published FROM results WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ success: false, message: 'Result not found.' });
    if (existing.published) {
      return res.status(403).json({ success: false, message: 'Cannot delete published results.' });
    }

    await db.query('DELETE FROM results WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Result deleted.' });
  } catch (err) {
    console.error('[RESULTS/DELETE]', err.message);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── GET /api/results/summary?student_id=&term=&session= ───────
// Returns student info + all results — used by PIN checker
router.get('/summary', async (req, res) => {
  const { student_id, term, session } = req.query;

  if (!student_id || !term || !session) {
    return res.status(400).json({ success: false, message: 'student_id, term and session are required.' });
  }

  try {
    const [[student]] = await db.query(
      `SELECT id, first_name, middle_name, last_name, class, student_code FROM students WHERE id = ?`,
      [student_id]
    );
    if (!student) return res.status(404).json({ success: false, message: 'Student not found.' });

    const [results] = await db.query(
      `SELECT sub.name AS subject, r.ca_score, r.exam_score, r.total, r.grade, r.remark
       FROM results r
       JOIN subjects sub ON r.subject_id = sub.id
       WHERE r.student_id = ? AND r.term = ? AND r.session = ? AND r.published = 1
       ORDER BY sub.name`,
      [student_id, term, session]
    );

    const totalScore  = results.reduce((s, r) => s + parseFloat(r.total), 0);
    const average     = results.length ? (totalScore / results.length).toFixed(2) : '0.00';
    const overallGrade = getGrade(parseFloat(average)).grade;

    res.json({
      success: true,
      student,
      term,
      session,
      results,
      summary: { total_subjects: results.length, total_score: totalScore.toFixed(2), average, overall_grade: overallGrade }
    });
  } catch (err) {
    console.error('[RESULTS/SUMMARY]', err.message);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;
