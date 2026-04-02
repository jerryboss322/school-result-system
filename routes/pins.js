const router  = require('express').Router();
const db      = require('../database/db');
const { requireAuth } = require('../middleware/auth');

// Generates a PIN like RSP-A3F7K2BX
function generatePin() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let pin = 'RSP-';
  for (let i = 0; i < 8; i++) {
    pin += chars[Math.floor(Math.random() * chars.length)];
  }
  return pin;
}

// Generate a unique PIN (retry on collision)
async function uniquePin(maxTries = 10) {
  for (let i = 0; i < maxTries; i++) {
    const pin = generatePin();
    const [[row]] = await db.query('SELECT id FROM result_pins WHERE pin = ?', [pin]);
    if (!row) return pin;
  }
  throw new Error('Failed to generate unique PIN after retries.');
}

// ── POST /api/pins/generate  (staff only) ─────────────────────
router.post('/generate', requireAuth, async (req, res) => {
  const { student_id, term, session } = req.body;

  if (!student_id || !term || !session) {
    return res.status(400).json({ success: false, message: 'student_id, term and session are required.' });
  }

  try {
    // Check student exists
    const [[student]] = await db.query(
      'SELECT id, first_name, last_name, class FROM students WHERE id = ?',
      [student_id]
    );
    if (!student) return res.status(404).json({ success: false, message: 'Student not found.' });

    // Check results exist for this term/session
    const [[{ count }]] = await db.query(
      'SELECT COUNT(*) AS count FROM results WHERE student_id = ? AND term = ? AND session = ?',
      [student_id, term, session]
    );
    if (count === 0) {
      return res.status(400).json({ success: false, message: 'No results found for this student/term/session. Enter results first.' });
    }

    // Check if a PIN already exists → reuse it
    const [[existing]] = await db.query(
      'SELECT pin FROM result_pins WHERE student_id = ? AND term = ? AND session = ?',
      [student_id, term, session]
    );
    if (existing) {
      return res.json({ success: true, pin: existing.pin, message: 'Existing PIN returned.', student });
    }

    // Publish the results for this student/term/session
    await db.query(
      'UPDATE results SET published = 1 WHERE student_id = ? AND term = ? AND session = ?',
      [student_id, term, session]
    );

    const pin = await uniquePin();

    await db.query(
      'INSERT INTO result_pins (student_id, term, session, pin, generated_by) VALUES (?, ?, ?, ?, ?)',
      [student_id, term, session, pin, req.staff.id]
    );

    res.status(201).json({ success: true, pin, message: 'PIN generated and results published.', student });
  } catch (err) {
    console.error('[PINS/GENERATE]', err.message);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── GET /api/pins?student_id=&term=&session=  (staff only) ────
router.get('/', requireAuth, async (req, res) => {
  const { student_id, term, session } = req.query;
  let where  = [];
  let params = [];

  if (student_id) { where.push('rp.student_id = ?'); params.push(student_id); }
  if (term)       { where.push('rp.term = ?');        params.push(term); }
  if (session)    { where.push('rp.session = ?');     params.push(session); }

  const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';

  try {
    const [rows] = await db.query(
      `SELECT rp.id, rp.pin, rp.term, rp.session, rp.used, rp.used_at, rp.created_at,
              s.id AS student_id, s.first_name, s.last_name, s.class, s.student_code
       FROM result_pins rp
       JOIN students s ON rp.student_id = s.id
       ${whereClause}
       ORDER BY rp.created_at DESC`,
      params
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('[PINS/GET]', err.message);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── POST /api/pins/check  (PUBLIC — result checker) ───────────
router.post('/check', async (req, res) => {
  const { first_name, last_name, class: cls, pin } = req.body;

  if (!first_name || !last_name || !cls || !pin) {
    return res.status(400).json({ success: false, message: 'First name, last name, class and PIN are required.' });
  }

  try {
    // Find PIN record
    const [[pinRecord]] = await db.query(
      'SELECT * FROM result_pins WHERE pin = ?',
      [pin.toUpperCase().trim()]
    );
    if (!pinRecord) {
      return res.status(404).json({ success: false, message: 'Invalid PIN.' });
    }

    // Match student
    const [[student]] = await db.query(
      `SELECT * FROM students WHERE id = ? AND class = ?`,
      [pinRecord.student_id, cls.toUpperCase()]
    );
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student details do not match this PIN.' });
    }

    // Case-insensitive name check
    const fnMatch = student.first_name.toLowerCase() === first_name.trim().toLowerCase();
    const lnMatch = student.last_name.toLowerCase()  === last_name.trim().toLowerCase();

    if (!fnMatch || !lnMatch) {
      return res.status(403).json({ success: false, message: 'Student name does not match PIN.' });
    }

    // Mark PIN as used
    if (!pinRecord.used) {
      await db.query(
        'UPDATE result_pins SET used = 1, used_at = NOW() WHERE id = ?',
        [pinRecord.id]
      );
    }

    // Fetch published results
    const [results] = await db.query(
      `SELECT sub.name AS subject, r.ca_score, r.exam_score, r.total, r.grade, r.remark
       FROM results r
       JOIN subjects sub ON r.subject_id = sub.id
       WHERE r.student_id = ? AND r.term = ? AND r.session = ? AND r.published = 1
       ORDER BY sub.name`,
      [student.id, pinRecord.term, pinRecord.session]
    );

    if (results.length === 0) {
      return res.status(404).json({ success: false, message: 'No published results found.' });
    }

    const totalScore   = results.reduce((s, r) => s + parseFloat(r.total), 0);
    const average      = (totalScore / results.length).toFixed(2);
    const overallGrade = getOverallGrade(parseFloat(average));

    res.json({
      success: true,
      student: {
        name: `${student.first_name} ${student.middle_name ? student.middle_name + ' ' : ''}${student.last_name}`,
        class: student.class,
        student_code: student.student_code
      },
      term:    pinRecord.term,
      session: pinRecord.session,
      results,
      summary: {
        total_subjects: results.length,
        total_score:    totalScore.toFixed(2),
        average,
        overall_grade:  overallGrade
      }
    });
  } catch (err) {
    console.error('[PINS/CHECK]', err.message);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

function getOverallGrade(avg) {
  if (avg >= 70) return 'A';
  if (avg >= 60) return 'B';
  if (avg >= 50) return 'C';
  if (avg >= 45) return 'D';
  if (avg >= 40) return 'E';
  return 'F';
}

module.exports = router;
