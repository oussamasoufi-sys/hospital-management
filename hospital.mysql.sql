-- Hospital Management
-- MySQL schema + seed data (single file)
--
-- Import examples:
--   mysql -u root -p -e "CREATE DATABASE hospital_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
--   mysql -u root -p hospital_db < hospital.mysql.sql
--
-- Notes:
-- - Uses InnoDB for foreign keys.
-- - Uses utf8mb4 for full Unicode support.
-- - Seed data mirrors the dashboard UI demo.

SET NAMES utf8mb4;
SET time_zone = "+00:00";

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS lab_tests;
DROP TABLE IF EXISTS pharmacy_items;
DROP TABLE IF EXISTS billing_items;
DROP TABLE IF EXISTS bills;
DROP TABLE IF EXISTS appointments;
DROP TABLE IF EXISTS beds;
DROP TABLE IF EXISTS patients;
DROP TABLE IF EXISTS doctors;
DROP TABLE IF EXISTS departments;
SET FOREIGN_KEY_CHECKS = 1;

-- -------------------------
-- Core reference tables
-- -------------------------
CREATE TABLE departments (
  id            INT NOT NULL AUTO_INCREMENT,
  name          VARCHAR(120) NOT NULL,
  location      VARCHAR(120) NULL,
  phone         VARCHAR(40) NULL,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uk_departments_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE doctors (
  id            INT NOT NULL AUTO_INCREMENT,
  department_id INT NOT NULL,
  full_name     VARCHAR(160) NOT NULL,
  specialty     VARCHAR(160) NULL,
  email         VARCHAR(190) NULL,
  phone         VARCHAR(40) NULL,
  status        ENUM('available','on_duty','off_duty','on_rounds') NOT NULL DEFAULT 'available',
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  KEY idx_doctors_department (department_id),
  CONSTRAINT fk_doctors_department
    FOREIGN KEY (department_id) REFERENCES departments(id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE patients (
  id            INT NOT NULL AUTO_INCREMENT,
  patient_code  VARCHAR(40) NOT NULL,
  full_name     VARCHAR(160) NOT NULL,
  dob           DATE NULL,
  gender        ENUM('female','male','other') NULL,
  phone         VARCHAR(40) NULL,
  status        ENUM('stable','observation','testing','critical','discharged') NOT NULL DEFAULT 'stable',
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uk_patients_code (patient_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE beds (
  id            INT NOT NULL AUTO_INCREMENT,
  bed_code      VARCHAR(40) NOT NULL,
  ward          VARCHAR(120) NULL,
  is_available  TINYINT(1) NOT NULL DEFAULT 1,
  notes         VARCHAR(255) NULL,
  updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uk_beds_code (bed_code),
  CHECK (is_available IN (0, 1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE pharmacy_items (
  id            INT NOT NULL AUTO_INCREMENT,
  item_code     VARCHAR(40) NOT NULL,
  name          VARCHAR(160) NOT NULL,
  category      VARCHAR(80) NULL,
  stock_qty     INT NOT NULL DEFAULT 0,
  unit          VARCHAR(24) NOT NULL DEFAULT 'pcs',
  status        ENUM('in_stock','low_stock','out_of_stock') NOT NULL DEFAULT 'in_stock',
  updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uk_pharmacy_item_code (item_code),
  KEY idx_pharmacy_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE appointments (
  id            INT NOT NULL AUTO_INCREMENT,
  patient_id    INT NOT NULL,
  doctor_id     INT NOT NULL,
  department_id INT NOT NULL,
  appt_date     DATE NOT NULL,
  appt_time     TIME NOT NULL,
  room          VARCHAR(60) NULL,
  status        ENUM('scheduled','pending','confirmed','in_progress','completed','cancelled') NOT NULL DEFAULT 'confirmed',
  notes         VARCHAR(255) NULL,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  KEY idx_appointments_date (appt_date),
  KEY idx_appointments_doctor (doctor_id),
  KEY idx_appointments_patient (patient_id),
  KEY idx_appointments_department (department_id),

  CONSTRAINT fk_appointments_patient
    FOREIGN KEY (patient_id) REFERENCES patients(id)
    ON UPDATE CASCADE
    ON DELETE CASCADE,
  CONSTRAINT fk_appointments_doctor
    FOREIGN KEY (doctor_id) REFERENCES doctors(id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  CONSTRAINT fk_appointments_department
    FOREIGN KEY (department_id) REFERENCES departments(id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE lab_tests (
  id            INT NOT NULL AUTO_INCREMENT,
  patient_id    INT NOT NULL,
  test_name     VARCHAR(160) NOT NULL,
  priority      ENUM('routine','urgent') NOT NULL DEFAULT 'routine',
  status        ENUM('ordered','in_progress','completed') NOT NULL DEFAULT 'ordered',
  ordered_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  result_at     DATETIME NULL,
  notes         VARCHAR(255) NULL,

  PRIMARY KEY (id),
  KEY idx_lab_patient (patient_id),
  KEY idx_lab_status (status),
  CONSTRAINT fk_lab_patient
    FOREIGN KEY (patient_id) REFERENCES patients(id)
    ON UPDATE CASCADE
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE bills (
  id            INT NOT NULL AUTO_INCREMENT,
  patient_id    INT NOT NULL,
  bill_no       VARCHAR(60) NOT NULL,
  bill_date     DATE NOT NULL,
  currency      CHAR(3) NOT NULL DEFAULT 'DZD',
  total_amount  DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  status        ENUM('unpaid','paid','partially_paid','void') NOT NULL DEFAULT 'unpaid',
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uk_bills_bill_no (bill_no),
  KEY idx_bills_patient (patient_id),

  CONSTRAINT fk_bills_patient
    FOREIGN KEY (patient_id) REFERENCES patients(id)
    ON UPDATE CASCADE
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE billing_items (
  id          INT NOT NULL AUTO_INCREMENT,
  bill_id     INT NOT NULL,
  description VARCHAR(200) NOT NULL,
  qty         INT NOT NULL DEFAULT 1,
  unit_price  DECIMAL(10,2) NOT NULL DEFAULT 0.00,

  PRIMARY KEY (id),
  KEY idx_billing_items_bill (bill_id),

  CONSTRAINT fk_billing_items_bill
    FOREIGN KEY (bill_id) REFERENCES bills(id)
    ON UPDATE CASCADE
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------
-- Seed data (matches UI demo)
-- -------------------------
INSERT INTO departments (id, name, location, phone) VALUES
  (1, 'Cardiology',  'Building B', '+213 00 00 00 01'),
  (2, 'Orthopedics', 'Building C', '+213 00 00 00 02'),
  (3, 'Laboratory',  'Lab Wing',   '+213 00 00 00 03'),
  (4, 'Emergency',   'Ground ER',  '+213 00 00 00 04'),
  (5, 'Pediatrics',  'Building A', '+213 00 00 00 05'),
  (6, 'Pharmacy',    'Main Hall',  '+213 00 00 00 06');

INSERT INTO doctors (id, department_id, full_name, specialty, email, status) VALUES
  (1, 1, 'Dr. Selim R.',  'Cardiology',  'selim.r@hospital.local',  'on_duty'),
  (2, 3, 'Dr. Imene K.',  'Pathology',   'imene.k@hospital.local',  'on_duty'),
  (3, 5, 'Dr. Yacine B.', 'Pediatrics',  'yacine.b@hospital.local', 'on_rounds'),
  (4, 2, 'Dr. Meriem A.', 'Orthopedics', 'meriem.a@hospital.local', 'on_duty');

INSERT INTO patients (id, patient_code, full_name, gender, status) VALUES
  (1, 'P-10942', 'Amina H.',   'female', 'stable'),
  (2, 'P-10941', 'Karim S.',   'male',   'observation'),
  (3, 'P-10940', 'Leila M.',   'female', 'testing'),
  (4, 'P-10939', 'Youssef O.', 'male',   'critical'),
  (5, 'P-10938', 'Nadia F.',   'female', 'stable');

INSERT INTO beds (id, bed_code, ward, is_available, notes) VALUES
  (1, 'B-214', 'Cardiology',  0, 'Assigned'),
  (2, 'C-108', 'Orthopedics', 0, 'Assigned'),
  (3, 'ER-03', 'Emergency',   0, 'Assigned'),
  (4, 'A-012', 'Pediatrics',  0, 'Assigned'),
  (5, 'B-215', 'Cardiology',  1, 'Available'),
  (6, 'B-216', 'Cardiology',  1, 'Available');

INSERT INTO pharmacy_items (id, item_code, name, category, stock_qty, unit, status) VALUES
  (1, 'MED-0001', 'Paracetamol 500mg', 'Analgesic', 240, 'tabs', 'in_stock'),
  (2, 'MED-0002', 'Amoxicillin 500mg', 'Antibiotic', 42, 'caps', 'low_stock'),
  (3, 'MED-0003', 'Normal Saline 0.9% 500ml', 'IV Fluids', 120, 'bags', 'in_stock'),
  (4, 'MED-0004', 'Insulin (Regular)', 'Endocrine', 18, 'vials', 'low_stock'),
  (5, 'MED-0005', 'Surgical Gloves (M)', 'Supplies', 0, 'boxes', 'out_of_stock');

-- Appointments for "today" (UTC date by default; adjust time_zone if needed)
INSERT INTO appointments (patient_id, doctor_id, department_id, appt_date, appt_time, room, status, notes) VALUES
  (1, 1, 1, CURDATE(), '09:30:00', 'B-12', 'confirmed',   'Routine consultation'),
  (3, 2, 3, CURDATE(), '10:15:00', 'Lab 2', 'in_progress','Results review'),
  (5, 3, 5, CURDATE(), '12:00:00', 'A-04', 'confirmed',   'Follow-up'),
  (2, 4, 2, CURDATE(), '14:20:00', 'Radiology', 'pending','Imaging required');

INSERT INTO lab_tests (id, patient_id, test_name, priority, status, ordered_at, result_at, notes) VALUES
  (1, 1, 'ECG', 'routine', 'completed', NOW() - INTERVAL 2 DAY, NOW() - INTERVAL 2 DAY, 'Normal rhythm'),
  (2, 3, 'CBC (Complete Blood Count)', 'routine', 'in_progress', NOW() - INTERVAL 3 HOUR, NULL, 'Awaiting analyzer'),
  (3, 4, 'Blood Gas Analysis', 'urgent', 'ordered', NOW() - INTERVAL 40 MINUTE, NULL, 'ER request'),
  (4, 2, 'X-Ray Review', 'routine', 'completed', NOW() - INTERVAL 1 DAY, NOW() - INTERVAL 1 DAY, 'No fracture');

-- Example billing
INSERT INTO bills (id, patient_id, bill_no, bill_date, currency, total_amount, status) VALUES
  (1, 1, 'BILL-2026-0001', CURDATE(), 'DZD', 0.00, 'unpaid');

INSERT INTO billing_items (bill_id, description, qty, unit_price) VALUES
  (1, 'Consultation fee', 1, 2500.00),
  (1, 'ECG',              1, 1800.00);

UPDATE bills b
SET b.total_amount = (
  SELECT COALESCE(SUM(i.qty * i.unit_price), 0)
  FROM billing_items i
  WHERE i.bill_id = b.id
)
WHERE b.id = 1;
