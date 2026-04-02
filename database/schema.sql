-- ============================================================
-- SCHOOL RESULT MANAGEMENT SYSTEM — DATABASE SCHEMA
-- ============================================================

CREATE DATABASE IF NOT EXISTS school_results CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE school_results;

-- ────────────────────────────────────────────────────────────
-- STAFF TABLE
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS staff (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(100)  NOT NULL,
  email         VARCHAR(100)  NOT NULL UNIQUE,
  password      VARCHAR(255)  NOT NULL,           -- bcrypt hashed
  role          VARCHAR(20)   NOT NULL DEFAULT 'staff',
  created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ────────────────────────────────────────────────────────────
-- STUDENTS TABLE
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS students (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  first_name    VARCHAR(60)   NOT NULL,
  middle_name   VARCHAR(60)   DEFAULT NULL,
  last_name     VARCHAR(60)   NOT NULL,
  class         VARCHAR(10)   NOT NULL,           -- PRI1…SS3
  student_code  VARCHAR(20)   NOT NULL UNIQUE,    -- e.g. STU-2024-00001
  created_by    INT           NOT NULL,
  created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES staff(id)
);

-- ────────────────────────────────────────────────────────────
-- SUBJECTS TABLE (seeded once, reused)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subjects (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(100)  NOT NULL,
  category      VARCHAR(20)   NOT NULL             -- 'primary' | 'junior' | 'senior' | 'all'
);

-- ────────────────────────────────────────────────────────────
-- RESULTS TABLE
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS results (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  student_id    INT           NOT NULL,
  subject_id    INT           NOT NULL,
  term          VARCHAR(20)   NOT NULL,            -- 'First' | 'Second' | 'Third'
  session       VARCHAR(12)   NOT NULL,            -- e.g. '2023/2024'
  ca_score      DECIMAL(5,2)  NOT NULL DEFAULT 0,  -- max 40
  exam_score    DECIMAL(5,2)  NOT NULL DEFAULT 0,  -- max 60
  total         DECIMAL(5,2)  GENERATED ALWAYS AS (ca_score + exam_score) STORED,
  grade         VARCHAR(2)    NOT NULL DEFAULT 'F',
  remark        VARCHAR(30)   NOT NULL DEFAULT 'Fail',
  published     TINYINT(1)    NOT NULL DEFAULT 0,
  created_by    INT           NOT NULL,
  created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_result (student_id, subject_id, term, session),
  FOREIGN KEY (student_id)  REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (subject_id)  REFERENCES subjects(id),
  FOREIGN KEY (created_by)  REFERENCES staff(id)
);

-- ────────────────────────────────────────────────────────────
-- RESULT PINS TABLE
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS result_pins (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  student_id    INT           NOT NULL,
  term          VARCHAR(20)   NOT NULL,
  session       VARCHAR(12)   NOT NULL,
  pin           VARCHAR(20)   NOT NULL UNIQUE,    -- e.g. RSP-XXXXXXXX
  used          TINYINT(1)    NOT NULL DEFAULT 0,
  used_at       DATETIME      DEFAULT NULL,
  generated_by  INT           NOT NULL,
  created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_pin_slot (student_id, term, session),
  FOREIGN KEY (student_id)   REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (generated_by) REFERENCES staff(id)
);

-- ────────────────────────────────────────────────────────────
-- SEED: DEFAULT ADMIN STAFF
-- password = Admin@1234  (bcrypt, cost 12)
-- ────────────────────────────────────────────────────────────
INSERT IGNORE INTO staff (name, email, password, role)
VALUES (
  'System Admin',
  'admin@school.edu',
  '$2a$12$3II5AbVk5KzjfuAkq6T2qe/i5S/xhYba8TIfn3s2DdG2cdthSuBBO',
  'admin'
);

-- ────────────────────────────────────────────────────────────
-- SEED: SUBJECTS
-- ────────────────────────────────────────────────────────────
INSERT IGNORE INTO subjects (name, category) VALUES
  -- All levels
  ('English Language',        'all'),
  ('Mathematics',             'all'),
  ('Basic Science',           'all'),
  ('Social Studies',          'all'),
  ('Civic Education',         'all'),
  ('Physical & Health Edu',   'all'),
  ('Computer Studies',        'all'),
  -- Primary only
  ('Verbal Reasoning',        'primary'),
  ('Quantitative Reasoning',  'primary'),
  ('Cultural & Creative Art',  'primary'),
  ('Agricultural Science',    'primary'),
  ('Yoruba Language',         'primary'),
  -- Junior Secondary
  ('Business Studies',        'junior'),
  ('Home Economics',          'junior'),
  ('Agricultural Science',    'junior'),
  ('French',                  'junior'),
  ('Christian Religious Studies', 'junior'),
  ('Fine Art',                'junior'),
  -- Senior Secondary
  ('Economics',               'senior'),
  ('Government',              'senior'),
  ('Literature in English',   'senior'),
  ('Chemistry',               'senior'),
  ('Physics',                 'senior'),
  ('Biology',                 'senior'),
  ('Further Mathematics',     'senior'),
  ('Geography',               'senior'),
  ('Financial Accounting',    'senior'),
  ('Commerce',                'senior');
