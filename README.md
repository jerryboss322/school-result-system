# 🏫 School Result Management System

A clean, full-stack result management system for primary and secondary schools (PRI1–SS3).

**Tech Stack:** Node.js · Express · MySQL · Vanilla HTML/CSS/JS  
**Theme:** Gold (#d4af37) + Pink (#ff69b4)

---

## 📁 Project Structure

```
school-result-system/
├── server.js                   # Express entry point
├── package.json
├── .env.example                # Copy to .env and fill in
│
├── database/
│   ├── db.js                   # MySQL connection pool
│   └── schema.sql              # All tables + seed data
│
├── middleware/
│   ├── auth.js                 # JWT authentication guard
│   └── grade.js                # Grade calculation utility
│
├── routes/
│   ├── auth.js                 # POST /login, POST /register, GET /me
│   ├── students.js             # GET/POST/PUT /students
│   ├── results.js              # GET/POST/PUT/DELETE /results
│   └── pins.js                 # POST /generate, POST /check, GET /pins
│
└── public/
    ├── index.html              # 🌐 Public Result Checker
    ├── login.html              # 🔐 Staff Login
    ├── dashboard.html          # 🟣 Staff Dashboard
    ├── css/
    │   └── style.css           # Full gold+pink theme
    └── js/
        └── dashboard.js        # Dashboard client logic
```

---

## ⚙️ Setup Instructions

### 1. Prerequisites
- Node.js v18+
- MySQL 8.0+

### 2. Clone & Install
```bash
# Install dependencies
npm install
```

### 3. Create MySQL Database
```bash
mysql -u root -p < database/schema.sql
```
This creates the `school_results` database, all tables, seeds subjects and creates the default admin account.

### 4. Configure Environment
```bash
cp .env.example .env
```
Edit `.env`:
```env
PORT=3000
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=school_results
JWT_SECRET=generate_a_long_random_string_here
JWT_EXPIRES_IN=8h
SCHOOL_NAME=Your School Name
```

**Generate a JWT secret:**
```bash
node -e "require('crypto').randomBytes(64).toString('hex')"
```

### 5. Start the Server
```bash
# Production
npm start

# Development (auto-restart)
npm run dev
```

---

## 🌐 Access the System

| Page | URL | Who |
|------|-----|-----|
| Result Checker | `http://localhost:3000/` | Students & Parents |
| Staff Login | `http://localhost:3000/login` | Staff |
| Staff Dashboard | `http://localhost:3000/dashboard` | Staff (after login) |

---

## 🔐 Default Admin Account

| Field | Value |
|-------|-------|
| Email | `admin@school.edu` |
| Password | `Admin@1234` |

> ⚠️ **Change this password immediately after first login** via the Add Staff page.

---

## 🗂️ Database Schema

### Tables

| Table | Purpose |
|-------|---------|
| `staff` | Staff accounts with bcrypt-hashed passwords |
| `students` | Student records with auto-generated codes |
| `subjects` | Subject list (seeded, filtered by school level) |
| `results` | Per-student, per-subject, per-term results |
| `result_pins` | Unique PINs linking students to term results |

### Key Relationships
```
staff ──< students (created_by)
staff ──< results  (created_by)
staff ──< result_pins (generated_by)
students ──< results
students ──< result_pins
subjects ──< results
```

### Grading Scale
| Grade | Score Range | Remark |
|-------|-------------|--------|
| A | 70–100 | Excellent |
| B | 60–69 | Very Good |
| C | 50–59 | Good |
| D | 45–49 | Pass |
| E | 40–44 | Below Average |
| F | 0–39 | Fail |

> CA: max 40 pts · Exam: max 60 pts · Total: max 100 pts

---

## 🟣 Staff Dashboard Features

### Student Management
- Add students (first, middle, last name + class)
- Auto-generated student codes: `STU-2024-00001`
- Filter by class, search by name
- Edit student details

### Result Entry
1. Select class → student → term → session
2. System loads correct subjects for that school level
3. Enter CA (0–40) and Exam (0–60) scores per subject
4. Total and Grade calculated automatically
5. Bulk save with one click

### Result Editing
- Load existing results for any student/term/session
- Edit unpublished results
- Delete unpublished entries
- Published results are locked (prevents post-PIN changes)

### PIN Generation
- Select student + term + session
- System validates results exist
- Generates unique PIN format: `RSP-XXXXXXXX`
- Publishing the results locks them automatically
- If PIN already exists for that slot, it's returned (no duplicates)

### Staff Management
- Add new staff accounts (name, email, password, role)
- Roles: `staff` or `admin`

---

## 🟡 Result Checker (Public)

Parents/students visit `/` and enter:
- First Name
- Last Name  
- Class
- PIN (format: `RSP-XXXXXXXX`)

The system validates name + class against the PIN, then displays a clean result sheet with all subjects, scores, grades and summary statistics. Printable!

---

## 🔒 Security

- Passwords hashed with **bcrypt** (cost factor 12)
- All staff routes protected with **JWT Bearer tokens** (8h expiry)
- Rate limiting on login (10 req/15 min) and result checker (20 req/10 min)
- PIN validation checks name + class match before revealing results
- Published results cannot be edited or deleted
- No plain-text passwords stored anywhere

---

## 🚀 API Reference

### Auth
```
POST /api/auth/login          { email, password }
POST /api/auth/register       { name, email, password, role }  🔐
GET  /api/auth/me                                               🔐
```

### Students
```
GET    /api/students          ?class=JSS1&search=name&page=1   🔐
GET    /api/students/:id                                        🔐
POST   /api/students          { first_name, middle_name, last_name, class } 🔐
PUT    /api/students/:id      { first_name, middle_name, last_name, class } 🔐
GET    /api/students/classes/list                               🔐
```

### Results
```
GET    /api/results           ?student_id=&term=&session=       🔐
GET    /api/results/subjects  ?class=JSS1                       🔐
GET    /api/results/summary   ?student_id=&term=&session=       🔐
POST   /api/results           { student_id, term, session, results[] } 🔐
PUT    /api/results/:id       { ca_score, exam_score }          🔐
DELETE /api/results/:id                                         🔐
```

### PINs
```
POST   /api/pins/generate     { student_id, term, session }     🔐
GET    /api/pins              ?student_id=&term=&session=        🔐
POST   /api/pins/check        { first_name, last_name, class, pin }  🌐
```

🔐 = Requires `Authorization: Bearer <token>` header  
🌐 = Public endpoint

---

## 🚀 Deployment Notes

For production:
1. Set `NODE_ENV=production` in `.env`
2. Use a strong random `JWT_SECRET`
3. Put Nginx or Apache in front as a reverse proxy
4. Use PM2 to keep the process alive:
   ```bash
   npm install -g pm2
   pm2 start server.js --name school-result-system
   pm2 save && pm2 startup
   ```
5. Restrict MySQL user to only the `school_results` database

---

## 🔮 Phase 2 / Future Upgrades

- [ ] PDF result download (using `pdfkit` or `puppeteer`)
- [ ] Admin role with full system visibility
- [ ] School ID / branding customization
- [ ] Bulk student import via CSV
- [ ] Class position / ranking calculation
- [ ] Email PIN delivery to parents
- [ ] Result history across multiple sessions
