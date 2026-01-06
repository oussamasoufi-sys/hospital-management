-- Hospital Management
-- SQLite schema + seed data (single file)
--
-- Import examples:
--   sqlite3 hospital.db < hospital.sql
--
-- Notes:
-- - Uses SQLite-friendly types and constraints.
-- - Designed to cover core dashboard entities: departments, doctors, patients, beds, appointments, billing.

PRAGMA foreign_keys = ON;

-- -------------------------
-- Drop (idempotent import)
-- -------------------------
DROP TABLE IF EXISTS billing_items;
DROP TABLE IF EXISTS bills;
DROP TABLE IF EXISTS appointments;
DROP TABLE IF EXISTS beds;
DROP TABLE IF EXISTS patients;
DROP TABLE IF EXISTS doctors;
DROP TABLE IF EXISTS departments;

-- -------------------------
-- Core reference tables
-- -------------------------
CREATE TABLE departments (
  id              INTEGER PRIMARY KEY,
  name            TEXT NOT NULL UNIQUE,
  location        TEXT,
  phone           TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE doctors (
  id              INTEGER PRIMARY KEY,
  department_id   INTEGER NOT NULL,
  full_name       TEXT NOT NULL,
  specialty       TEXT,
  email           TEXT,
  phone           TEXT,
  status          TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available','on_duty','off_duty','on_rounds')),
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),

  FOREIGN KEY (department_id) REFERENCES departments(id) ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE TABLE patients (
  id              INTEGER PRIMARY KEY,
  patient_code    TEXT NOT NULL UNIQUE, -- e.g., P-10942
  full_name       TEXT NOT NULL,
  dob             TEXT, -- ISO date (YYYY-MM-DD)
  gender          TEXT CHECK (gender IN ('female','male','other')),
  phone           TEXT,
  status          TEXT NOT NULL DEFAULT 'stable' CHECK (status IN ('stable','observation','testing','critical','discharged')),
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE beds (
  id              INTEGER PRIMARY KEY,
  bed_code        TEXT NOT NULL UNIQUE, -- e.g., B-214
  ward            TEXT,
  is_available    INTEGER NOT NULL DEFAULT 1 CHECK (is_available IN (0,1)),
  notes           TEXT,
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE appointments (
  id              INTEGER PRIMARY KEY,
  patient_id      INTEGER NOT NULL,
  doctor_id       INTEGER NOT NULL,
  department_id   INTEGER NOT NULL,
  appt_date       TEXT NOT NULL, -- ISO date
  appt_time       TEXT NOT NULL, -- HH:MM
  room            TEXT,
  status          TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('scheduled','pending','confirmed','in_progress','completed','cancelled')),
  notes           TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),

  FOREIGN KEY (patient_id) REFERENCES patients(id) ON UPDATE CASCADE ON DELETE CASCADE,
  FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (department_id) REFERENCES departments(id) ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE TABLE bills (
  id              INTEGER PRIMARY KEY,
  patient_id      INTEGER NOT NULL,
  bill_no         TEXT NOT NULL UNIQUE,
  bill_date       TEXT NOT NULL,
  currency        TEXT NOT NULL DEFAULT 'DZD',
  total_amount    REAL NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid','paid','partially_paid','void')),
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),

  FOREIGN KEY (patient_id) REFERENCES patients(id) ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE TABLE billing_items (
  id              INTEGER PRIMARY KEY,
  bill_id         INTEGER NOT NULL,
  description     TEXT NOT NULL,
  qty             INTEGER NOT NULL DEFAULT 1,
  unit_price      REAL NOT NULL DEFAULT 0,

  FOREIGN KEY (bill_id) REFERENCES bills(id) ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE INDEX idx_doctors_department ON doctors(department_id);
CREATE INDEX idx_appointments_date ON appointments(appt_date);
CREATE INDEX idx_appointments_doctor ON appointments(doctor_id);
CREATE INDEX idx_bills_patient ON bills(patient_id);

-- -------------------------
-- Seed data (matches UI demo)
-- -------------------------
INSERT INTO departments (id, name, location, phone) VALUES
  (1, 'Cardiology',   'Building B', '+213 00 00 00 01'),
  (2, 'Orthopedics',  'Building C', '+213 00 00 00 02'),
  (3, 'Laboratory',   'Lab Wing',   '+213 00 00 00 03'),
  (4, 'Emergency',    'Ground ER',  '+213 00 00 00 04'),
  (5, 'Pediatrics',   'Building A', '+213 00 00 00 05'),
  (6, 'Pharmacy',     'Main Hall',  '+213 00 00 00 06');

INSERT INTO doctors (id, department_id, full_name, specialty, email, status) VALUES
  (1, 1, 'Dr. Selim R.',  'Cardiology', 'selim.r@hospital.local',  'on_duty'),
  (2, 3, 'Dr. Imene K.',  'Pathology',  'imene.k@hospital.local',  'on_duty'),
  (3, 5, 'Dr. Yacine B.', 'Pediatrics', 'yacine.b@hospital.local', 'on_rounds'),
  (4, 2, 'Dr. Meriem A.', 'Orthopedics','meriem.a@hospital.local', 'on_duty');

INSERT INTO patients (id, patient_code, full_name, gender, status) VALUES
  (1, 'P-10942', 'Amina H.',   'female', 'stable'),
  (2, 'P-10941', 'Karim S.',   'male',   'observation'),
  (3, 'P-10940', 'Leila M.',   'female', 'testing'),
  (4, 'P-10939', 'Youssef O.', 'male',   'critical'),
  (5, 'P-10938', 'Nadia F.',   'female', 'stable');

INSERT INTO beds (id, bed_code, ward, is_available, notes) VALUES
  (1, 'B-214', 'Cardiology', 0, 'Assigned'),
  (2, 'C-108', 'Orthopedics',0, 'Assigned'),
  (3, 'ER-03', 'Emergency',  0, 'Assigned'),
  (4, 'A-012', 'Pediatrics', 0, 'Assigned'),
  (5, 'B-215', 'Cardiology', 1, 'Available'),
  (6, 'B-216', 'Cardiology', 1, 'Available');

-- Appointments for "today" (use current local date)
INSERT INTO appointments (patient_id, doctor_id, department_id, appt_date, appt_time, room, status, notes) VALUES
  (1, 1, 1, date('now'), '09:30', 'B-12', 'confirmed', 'Routine consultation'),
  (3, 2, 3, date('now'), '10:15', 'Lab 2', 'in_progress', 'Results review'),
  (5, 3, 5, date('now'), '12:00', 'A-04', 'confirmed', 'Follow-up'),
  (2, 4, 2, date('now'), '14:20', 'Radiology', 'pending', 'Imaging required');

-- Example billing
INSERT INTO bills (id, patient_id, bill_no, bill_date, currency, total_amount, status) VALUES
  (1, 1, 'BILL-2026-0001', date('now'), 'DZD', 0, 'unpaid');

INSERT INTO billing_items (bill_id, description, qty, unit_price) VALUES
  (1, 'Consultation fee', 1, 2500),
  (1, 'ECG',              1, 1800);

UPDATE bills
SET total_amount = (
  SELECT COALESCE(SUM(qty * unit_price), 0)
  FROM billing_items
  WHERE billing_items.bill_id = bills.id
)
WHERE id = 1;
