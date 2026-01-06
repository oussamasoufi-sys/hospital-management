/*
  Static + API server (Express)
  - Serves: /, /index.html, /style.css, /script.js
  - API (MySQL-backed):
      /api/stats
      /api/patients?limit=
      /api/doctors?limit=
      /api/appointments?day=today|all
      /api/departments
      /api/pharmacy
      /api/laboratory
      /api/billing
      /api/billing/items?billId=

  Setup:
    1) Import MySQL schema: hospital.mysql.sql
    2) Create a .env file (see .env.example)
    3) npm install
    4) npm start

  Then open:
    http://localhost:3000
*/

const path = require("path");
const express = require("express");
const morgan = require("morgan");

require("dotenv").config();

const { query } = require("./db");

const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;

function isNonEmptyString(v) {
  return typeof v === "string" && v.trim().length > 0;
}

function pickEnum(value, allowed, fallback) {
  const v = String(value || "").toLowerCase();
  return allowed.includes(v) ? v : fallback;
}

function generatePatientCode() {
  const n = Math.floor(10000 + Math.random() * 90000);
  return `P-${n}`;
}

function generateBillNo() {
  const yyyy = new Date().getFullYear();
  const suffix = String(Date.now()).slice(-6);
  return `BILL-${yyyy}-${suffix}`;
}

function dbErrorPayload() {
  return {
    error: "Database error",
    hint: "Check DB_* settings in .env and ensure hospital.mysql.sql is imported.",
  };
}

function apiError(res, status, payload) {
  res.status(status).set("Cache-Control", "no-store").json(payload);
}

const app = express();

app.disable("x-powered-by");
app.use(morgan("dev"));
app.use(express.json({ limit: "64kb" }));

// Static hosting (same folder as before)
app.use(express.static(ROOT, { etag: false, maxAge: 0 }));

// -------- API routes (MySQL-backed) --------

app.get("/api/health", async (req, res) => {
  try {
    await query("SELECT 1 AS ok");
    res.set("Cache-Control", "no-store").json({ ok: true });
  } catch {
    apiError(res, 500, dbErrorPayload());
  }
});

app.get("/api/stats", async (req, res) => {
  try {
      const [patientsRows, doctorsRows, apptRows, bedsRows] = await Promise.all([
        query("SELECT COUNT(*) AS c FROM patients"),
        query("SELECT COUNT(*) AS c FROM doctors WHERE status IN ('available','on_duty')"),
        query("SELECT COUNT(*) AS c FROM appointments WHERE appt_date = CURDATE()"),
        query("SELECT COUNT(*) AS c FROM beds WHERE is_available = 1"),
      ]);

      const patients = patientsRows?.[0]?.c ?? 0;
      const doctorsAvailable = doctorsRows?.[0]?.c ?? 0;
      const appointmentsToday = apptRows?.[0]?.c ?? 0;
      const bedsAvailable = bedsRows?.[0]?.c ?? 0;

      res.set("Cache-Control", "no-store").json({
        totalPatients: Number(patients || 0),
        doctorsAvailable: Number(doctorsAvailable || 0),
        appointmentsToday: Number(appointmentsToday || 0),
        availableBeds: Number(bedsAvailable || 0),
      });
  } catch {
    apiError(res, 500, dbErrorPayload());
  }
});

app.get("/api/patients", async (req, res) => {
  try {
      const lq = Math.min(Number(req.query.limit || 10), 100);
      // Recent patients with their latest appointment department/room (if any)
      const rows = await query(
        `
          SELECT
            p.id AS patientId,
            p.patient_code AS id,
            p.full_name AS name,
            COALESCE(d.name, '—') AS department,
            p.status AS status,
            COALESCE(a.room, '—') AS room
          FROM patients p
          LEFT JOIN (
            SELECT a1.*
            FROM appointments a1
            JOIN (
              SELECT patient_id, MAX(CONCAT(appt_date,' ',appt_time)) AS latest_dt
              FROM appointments
              GROUP BY patient_id
            ) last_a
              ON last_a.patient_id = a1.patient_id
             AND last_a.latest_dt = CONCAT(a1.appt_date,' ',a1.appt_time)
          ) a ON a.patient_id = p.id
          LEFT JOIN departments d ON d.id = a.department_id
          ORDER BY p.created_at DESC
          LIMIT ${lq}
        `
      );

      // Normalize status capitalization for UI consistency
      const normalize = (s) => {
        const map = {
          stable: "Stable",
          observation: "Observation",
          testing: "Testing",
          critical: "Critical",
          discharged: "Discharged",
        };
        return map[String(s || "").toLowerCase()] || String(s || "—");
      };

      res.set("Cache-Control", "no-store").json(
        rows.map((r) => ({
          id: r.id,
          patientId: r.patientId,
          name: r.name,
          department: r.department,
          status: normalize(r.status),
          room: r.room === null ? "—" : r.room,
        }))
      );
  } catch {
    apiError(res, 500, dbErrorPayload());
  }
});

app.post("/api/patients", async (req, res) => {
  try {
      const body = req.body || {};

      const fullName = isNonEmptyString(body.full_name) ? body.full_name.trim() : "";
      if (!fullName) return apiError(res, 400, { error: "full_name is required" });

      const patientCode = isNonEmptyString(body.patient_code) ? body.patient_code.trim() : generatePatientCode();
      const gender = pickEnum(body.gender, ["female", "male", "other"], null);
      const status = pickEnum(body.status, ["stable", "observation", "testing", "critical", "discharged"], "stable");
      const phone = isNonEmptyString(body.phone) ? body.phone.trim() : null;
      const dob = isNonEmptyString(body.dob) ? body.dob.trim() : null;

      const result = await query(
        "INSERT INTO patients (patient_code, full_name, dob, gender, phone, status) VALUES (?, ?, ?, ?, ?, ?)",
        [patientCode, fullName, dob, gender, phone, status]
      );
      res.status(201).set("Cache-Control", "no-store").json({ id: result.insertId, patient_code: patientCode });
  } catch {
    apiError(res, 500, dbErrorPayload());
  }
});

app.get("/api/appointments", async (req, res) => {
  try {
      const dayQ = String(req.query.day || "today").toLowerCase();
      const where = dayQ === "all" ? "" : "WHERE a.appt_date = CURDATE()";
      const rows = await query(
        `
          SELECT
            DATE_FORMAT(a.appt_time, '%H:%i') AS time,
            CONCAT(dpt.name, ' ', 'Appointment') AS title,
            CONCAT(doc.full_name, ' • ', COALESCE(a.room, '—')) AS meta,
            a.status AS status
          FROM appointments a
          JOIN doctors doc ON doc.id = a.doctor_id
          JOIN departments dpt ON dpt.id = a.department_id
          ${where}
          ORDER BY a.appt_time ASC
          LIMIT 20
        `
      );

      const normalize = (s) => {
        const map = {
          scheduled: "Scheduled",
          pending: "Pending",
          confirmed: "Confirmed",
          in_progress: "In progress",
          completed: "Completed",
          cancelled: "Cancelled",
        };
        return map[String(s || "").toLowerCase()] || String(s || "—");
      };

      res.set("Cache-Control", "no-store").json(
        rows.map((r) => ({
          time: r.time,
          title: r.title,
          meta: r.meta,
          status: normalize(r.status),
        }))
      );
  } catch {
    apiError(res, 500, dbErrorPayload());
  }
});

app.get("/api/doctors", async (req, res) => {
  try {
      const lq = Math.min(Number(req.query.limit || 20), 100);
      const rows = await query(
        `
          SELECT
            doc.full_name AS name,
            dpt.name AS department,
            doc.status AS status
          FROM doctors doc
          JOIN departments dpt ON dpt.id = doc.department_id
          ORDER BY FIELD(doc.status, 'on_duty','available','on_rounds','off_duty'), doc.full_name
          LIMIT ${lq}
        `
      );

      const toInitials = (fullName) => {
        const letters = String(fullName || "")
          .replace(/^Dr\.?\s+/i, "")
          .split(/\s+/)
          .filter(Boolean)
          .slice(0, 2)
          .map((p) => p[0].toUpperCase());
        return (letters.join("") || "DR").slice(0, 2);
      };

      const availability = (s) => {
        const map = {
          on_duty: "On duty",
          on_rounds: "In rounds",
          available: "Available",
          off_duty: "Off duty",
        };
        return map[String(s || "").toLowerCase()] || String(s || "—");
      };

      res.set("Cache-Control", "no-store").json(
        rows.map((r) => ({
          initials: toInitials(r.name),
          name: r.name,
          department: r.department,
          availability: availability(r.status),
        }))
      );
  } catch {
    apiError(res, 500, dbErrorPayload());
  }
});

app.post("/api/doctors", async (req, res) => {
  try {
      const body = req.body || {};
      const fullName = isNonEmptyString(body.full_name) ? body.full_name.trim() : "";
      if (!fullName) return apiError(res, 400, { error: "full_name is required" });

      const departmentId = Number(body.department_id || 0);
      if (!departmentId) return apiError(res, 400, { error: "department_id is required" });

      const specialty = isNonEmptyString(body.specialty) ? body.specialty.trim() : null;
      const email = isNonEmptyString(body.email) ? body.email.trim() : null;
      const phone = isNonEmptyString(body.phone) ? body.phone.trim() : null;
      const status = pickEnum(body.status, ["available", "on_duty", "off_duty", "on_rounds"], "available");

      const result = await query(
        "INSERT INTO doctors (department_id, full_name, specialty, email, phone, status) VALUES (?, ?, ?, ?, ?, ?)",
        [departmentId, fullName, specialty, email, phone, status]
      );
      res.status(201).set("Cache-Control", "no-store").json({ id: result.insertId });
  } catch {
    apiError(res, 500, dbErrorPayload());
  }
});

app.get("/api/departments", async (req, res) => {
  try {
      const rows = await query(
        `
          SELECT id, name, COALESCE(location, '—') AS location, COALESCE(phone, '—') AS phone
          FROM departments
          ORDER BY name ASC
        `
      );
      res.set("Cache-Control", "no-store").json(rows);
  } catch {
    apiError(res, 500, dbErrorPayload());
  }
});

app.get("/api/pharmacy", async (req, res) => {
  try {
      const rows = await query(
        `
          SELECT item_code AS code, name, COALESCE(category, '—') AS category, stock_qty AS stock,
                 unit, status, DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i') AS updated_at
          FROM pharmacy_items
          ORDER BY updated_at DESC
          LIMIT 50
        `
      );
      res.set("Cache-Control", "no-store").json(rows);
  } catch {
    apiError(res, 500, dbErrorPayload());
  }
});

app.get("/api/laboratory", async (req, res) => {
  try {
      const rows = await query(
        `
          SELECT
            lt.id,
            p.patient_code AS patient_id,
            p.full_name AS patient,
            lt.test_name,
            lt.priority,
            lt.status,
            DATE_FORMAT(lt.ordered_at, '%Y-%m-%d %H:%i') AS ordered_at,
            CASE WHEN lt.result_at IS NULL THEN '—' ELSE DATE_FORMAT(lt.result_at, '%Y-%m-%d %H:%i') END AS result_at
          FROM lab_tests lt
          JOIN patients p ON p.id = lt.patient_id
          ORDER BY lt.ordered_at DESC
          LIMIT 50
        `
      );
      res.set("Cache-Control", "no-store").json(rows);
  } catch {
    apiError(res, 500, dbErrorPayload());
  }
});

app.get("/api/billing", async (req, res) => {
  try {
      const rows = await query(
        `
          SELECT
            b.id,
            b.bill_no,
            DATE_FORMAT(b.bill_date, '%Y-%m-%d') AS bill_date,
            p.patient_code AS patient_id,
            p.full_name AS patient,
            b.currency,
            b.total_amount,
            b.status
          FROM bills b
          JOIN patients p ON p.id = b.patient_id
          ORDER BY b.bill_date DESC, b.id DESC
          LIMIT 50
        `
      );
      res.set("Cache-Control", "no-store").json(rows);
  } catch {
    apiError(res, 500, dbErrorPayload());
  }
});

app.post("/api/billing", async (req, res) => {
  try {
      const body = req.body || {};
      const patientId = Number(body.patient_id || 0);
      if (!patientId) return apiError(res, 400, { error: "patient_id is required" });

      const currency = isNonEmptyString(body.currency) ? body.currency.trim().slice(0, 3).toUpperCase() : "DZD";
      const status = pickEnum(body.status, ["unpaid", "paid", "partially_paid", "void"], "unpaid");
      const billNo = isNonEmptyString(body.bill_no) ? body.bill_no.trim() : generateBillNo();
      const billDate = isNonEmptyString(body.bill_date) ? body.bill_date.trim() : null;

      const result = await query(
        "INSERT INTO bills (patient_id, bill_no, bill_date, currency, total_amount, status) VALUES (?, ?, COALESCE(?, CURDATE()), ?, 0.00, ?)",
        [patientId, billNo, billDate, currency, status]
      );
      res.status(201).set("Cache-Control", "no-store").json({ id: result.insertId, bill_no: billNo });
  } catch {
    apiError(res, 500, dbErrorPayload());
  }
});

app.get("/api/billing/items", async (req, res) => {
  try {
      const billId = Number(req.query.billId || 0);
      if (!billId) return apiError(res, 400, { error: "billId is required" });

      const rows = await query(
        `
          SELECT id, description, qty, unit_price,
                 ROUND(qty * unit_price, 2) AS line_total
          FROM billing_items
          WHERE bill_id = ?
          ORDER BY id ASC
        `,
        [billId]
      );
      res.set("Cache-Control", "no-store").json(rows);
  } catch {
    apiError(res, 500, dbErrorPayload());
  }
});

app.post("/api/billing/items", async (req, res) => {
  try {
      const body = req.body || {};
      const billId = Number(body.bill_id || 0);
      if (!billId) return apiError(res, 400, { error: "bill_id is required" });

      const description = isNonEmptyString(body.description) ? body.description.trim() : "";
      if (!description) return apiError(res, 400, { error: "description is required" });

      const qty = Math.max(1, Math.min(100000, Number(body.qty || 1)));
      const unitPrice = Number(body.unit_price || 0);
      if (!Number.isFinite(unitPrice) || unitPrice < 0) return apiError(res, 400, { error: "unit_price must be >= 0" });

      const result = await query(
        "INSERT INTO billing_items (bill_id, description, qty, unit_price) VALUES (?, ?, ?, ?)",
        [billId, description, qty, unitPrice]
      );

      await query(
        `
          UPDATE bills b
          SET b.total_amount = (
            SELECT COALESCE(SUM(i.qty * i.unit_price), 0)
            FROM billing_items i
            WHERE i.bill_id = b.id
          )
          WHERE b.id = ?
        `,
        [billId]
      );

      res.status(201).set("Cache-Control", "no-store").json({ id: result.insertId });
  } catch {
    apiError(res, 500, dbErrorPayload());
  }
});

// API 404
app.use("/api", (req, res) => apiError(res, 404, { error: "Not found" }));

// Serve SPA entry for unknown routes (hash-based routing still works)
app.get("/", (req, res) => {
  res.sendFile(path.join(ROOT, "index.html"));
});

// Global error handler (e.g., invalid JSON)
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err?.type === "entity.too.large") return apiError(res, 413, { error: "Payload too large" });
  if (err instanceof SyntaxError) return apiError(res, 400, { error: "Invalid JSON" });
  return apiError(res, 500, { error: "Server error" });
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Server running at http://localhost:${PORT}`);
});
