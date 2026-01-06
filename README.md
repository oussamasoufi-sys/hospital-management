# Hospital Management Dashboard (Express + MySQL)

A modern hospital management dashboard UI (Vanilla HTML/CSS/JS) with a **professional Express backend** and **MySQL database**.

## Features

- Responsive dashboard UI (sidebar, cards, tables)
- Express API + MySQL integration
- Create from UI:
  - Add Patient
  - Add Doctor
  - Create Bill + Add Bill Items
- Read-only modules:
  - Departments
  - Pharmacy inventory
  - Laboratory tests

## Requirements

- Node.js (recommended LTS)
- MySQL (or MariaDB-compatible MySQL)

## 1) Database setup (MySQL)

Create the database and import schema + seed:

```bash
mysql -u root -p -e "CREATE DATABASE hospital_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -u root -p hospital_db < hospital.mysql.sql
```

## 2) Configure environment

Create a `.env` file in the project root (copy from `.env.example`):

```env
PORT=3000
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=hospital_db
```

Important: `.env` is ignored by git via `.gitignore`.

## 3) Install & run

```bash
npm install
npm start
```

Open:

- http://localhost:3000

## API endpoints

- `GET /api/health`
- `GET /api/stats`
- `GET /api/patients?limit=50`
- `POST /api/patients`
- `GET /api/doctors?limit=50`
- `POST /api/doctors`
- `GET /api/appointments?day=today|all`
- `GET /api/departments`
- `GET /api/pharmacy`
- `GET /api/laboratory`
- `GET /api/billing`
- `POST /api/billing`
- `GET /api/billing/items?billId=1`
- `POST /api/billing/items`

### POST payload examples

Create patient:

```json
{
  "full_name": "John Doe",
  "status": "stable",
  "gender": "male"
}
```

Create doctor:

```json
{
  "full_name": "Dr. Example",
  "department_id": 1,
  "status": "available"
}
```

Create bill:

```json
{
  "patient_id": 1,
  "currency": "DZD",
  "status": "unpaid"
}
```

Add bill item:

```json
{
  "bill_id": 1,
  "description": "Consultation fee",
  "qty": 1,
  "unit_price": 2500
}
```

## Push to GitHub

From this folder:

```bash
git add -A
git commit -m "Add README"
git push
```

If you haven’t pushed yet, set the remote first:

```bash
git remote add origin https://github.com/oussamasoufi-sys/hospital-management.git
git push -u origin main
```
