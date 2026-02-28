# AI Clinic Management SaaS

A full-stack MERN clinic management system with AI-powered diagnosis, prescription management, and a SaaS subscription layer.

## Features

- **4 User Roles**: Admin, Doctor, Receptionist, Patient — each with a dedicated dashboard
- **JWT Authentication** with role-based access control (RBAC)
- **Patient Management**: Full CRUD with medical history (allergies, chronic conditions, emergency contacts)
- **Appointment Booking** with conflict detection and time slot grid
- **Prescription Management** with PDF generation (PDFKit)
- **AI Symptom Checker & Prescription Explainer** via Google Gemini 1.5 Flash
- **Risk Flagging** for high-risk patients
- **Analytics Dashboards** with Recharts (area charts, pie charts, bar charts)
- **SaaS Subscription Simulation** (Free vs Pro plan)
- **Medical-themed UI** with Tailwind CSS

---

## Tech Stack

| Layer     | Technology                                           |
|-----------|------------------------------------------------------|
| Backend   | Node.js, Express.js, MongoDB, Mongoose, JWT, PDFKit  |
| Frontend  | React 18, Vite, Redux Toolkit, React Router v6       |
| UI        | Tailwind CSS 3, Recharts, react-icons, framer-motion |
| AI        | Google Gemini 1.5 Flash (`@google/generative-ai`)    |
| Dates     | date-fns, react-datepicker                           |

---

## Quick Start

### Prerequisites
- Node.js 18+
- MongoDB (local or Atlas)
- Optional: Google Gemini API key (for AI features)

### 1. Clone / Download
```bash
cd "New folder"
```

### 2. Backend Setup
```bash
cd backend
npm install
```

Edit `backend/.env` and set your values:
```env
MONGO_URI=mongodb://localhost:27017/clinic-saas
JWT_SECRET=change_this_to_a_random_string
GEMINI_API_KEY=your_gemini_api_key   # optional — app works without it
PORT=5000
```

Start the backend:
```bash
npm run dev
```

### 3. Frontend Setup
```bash
cd ../frontend
npm install
npm run dev
```

Visit **http://localhost:5173**

---

## Demo Accounts

After starting for the first time, register users manually or seed the database. Use these emails to test:

| Role           | Email                      | Password   | Plan |
|----------------|----------------------------|------------|------|
| Admin          | admin@clinic.com           | password123| Pro  |
| Doctor         | doctor@clinic.com          | password123| Pro  |
| Doctor (Free)  | doctor2@clinic.com         | password123| Free |
| Receptionist   | receptionist@clinic.com    | password123| Free |
| Patient        | patient@clinic.com         | password123| Free |

> The Login page has **Quick Fill** buttons for each role to auto-fill credentials.

---

## Project Structure

```
New folder/
├── backend/
│   ├── models/           # Mongoose models (User, Patient, Appointment, Prescription, DiagnosisLog)
│   ├── middleware/        # auth.js (protect, authorize, checkSubscription)
│   ├── routes/            # auth, users, patients, appointments, prescriptions, ai, analytics, diagnosis
│   ├── server.js          # Express app entry point
│   └── .env               # Environment variables
│
└── frontend/
    └── src/
        ├── pages/
        │   ├── auth/          # Login, Register
        │   ├── admin/         # AdminDashboard, ManageUsers, SubscriptionPlans, SystemAnalytics
        │   ├── doctor/        # DoctorDashboard, Appointments, AIAssistant, Analytics
        │   ├── receptionist/  # Dashboard, RegisterPatient, BookAppointment, DailySchedule
        │   ├── patient/       # Dashboard, Appointments, Prescriptions
        │   └── shared/        # Patients, PatientDetail, Appointments, Prescriptions, PrescriptionForm, DiagnosisLogs
        ├── store/             # Redux auth slice
        ├── services/          # Axios API instance
        └── components/        # Layout (Sidebar, Header), ProtectedRoute
```

---

## API Endpoints

| Method | Path                            | Access              |
|--------|---------------------------------|---------------------|
| POST   | /api/auth/register              | Public              |
| POST   | /api/auth/login                 | Public              |
| GET    | /api/patients                   | All roles           |
| POST   | /api/patients                   | Admin/Doctor/Recep  |
| GET    | /api/appointments               | Role-filtered       |
| POST   | /api/appointments               | Admin/Recep/Doctor  |
| GET    | /api/prescriptions              | Role-filtered       |
| POST   | /api/prescriptions              | Doctor              |
| GET    | /api/prescriptions/:id/pdf      | Authenticated       |
| POST   | /api/ai/symptom-checker         | Doctor (Pro)        |
| POST   | /api/ai/prescription-explanation| Doctor              |
| POST   | /api/ai/risk-flag               | Doctor (Pro)        |
| POST   | /api/ai/predictive-analytics    | Admin (Pro)         |
| GET    | /api/analytics/admin            | Admin               |
| GET    | /api/analytics/doctor           | Doctor              |

---

## AI Features (Gemini)

Set `GEMINI_API_KEY` in `backend/.env` to enable full AI features. Without it, all AI endpoints return realistic **fallback responses** so the app remains fully functional.

AI features gated by **Pro plan**:
- Symptom Checker
- Risk Flagging
- Predictive Analytics (admin)

AI features available on all plans:
- Prescription Explanation

---

## SaaS Simulation

This project simulates a SaaS subscription model:
- **Free Plan**: Core features (patients, appointments, prescriptions)
- **Pro Plan**: AI features, advanced analytics

Plan management is in **Admin → Subscription Plans** and user management tables.

---

## License

MIT
"# Hekathon-backend" 
