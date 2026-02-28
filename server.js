const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const morgan = require('morgan');
const dotenv = require('dotenv');

dotenv.config();

const app = express();

// ── CORS ─────────────────────────────────────────────────────────────────────
const allowedOrigins = [
  'https://medicare-ai-clinic-management-system.vercel.app',
  'http://localhost:5173',
  'http://localhost:5174',
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(null, true); // allow all for now — tighten after testing
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.options('*', cors());

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
if (process.env.NODE_ENV !== 'production') app.use(morgan('dev'));

// ── MongoDB (connection caching for Vercel serverless) ────────────────────────
let cachedConn = null;
async function connectDB() {
  if (cachedConn && mongoose.connection.readyState === 1) return cachedConn;
  cachedConn = await mongoose.connect(
    process.env.MONGO_URI || 'mongodb://localhost:27017/clinic_management',
    { serverSelectionTimeoutMS: 10000 }
  );
  console.log('✅ MongoDB Connected');
  return cachedConn;
}
connectDB().catch(err => console.error('❌ MongoDB Error:', err));

// ── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth',         require('./routes/auth'));
app.use('/api/users',        require('./routes/users'));
app.use('/api/patients',     require('./routes/patients'));
app.use('/api/appointments', require('./routes/appointments'));
app.use('/api/prescriptions',require('./routes/prescriptions'));
app.use('/api/ai',           require('./routes/ai'));
app.use('/api/analytics',    require('./routes/analytics'));
app.use('/api/diagnosis',    require('./routes/diagnosis'));

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Clinic Management API Running', timestamp: new Date() });
});

// ── Error handler ─────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ success: false, message: err.message || 'Internal Server Error' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

module.exports = app;
