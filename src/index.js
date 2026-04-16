require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const authRoutes = require('./routes/authRoutes');
const studentRoutes = require('./routes/studentRoutes');
const teacherRoutes = require('./routes/teacherRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const assignmentRoutes = require('./routes/assignmentRoutes');
const resultRoutes = require('./routes/resultRoutes');
const classRoutes = require('./routes/classRoutes');
const adminRoutes = require('./routes/adminRoutes');
const enquiryRoutes = require('./routes/enquiryRoutes');
const admissionRoutes = require('./routes/admissionRoutes');
const contactRoutes = require('./routes/contactRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// Security & Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health Check
app.get('/health', (req, res) => {
  res.json({ success: true, message: 'School SaaS API is running', timestamp: new Date().toISOString(), version: '1.0.0' });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/teachers', teacherRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/assignments', assignmentRoutes);
app.use('/api/results', resultRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/enquiry', enquiryRoutes);
app.use('/api/admission', admissionRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/classes', classRoutes);

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(err.status || 500).json({ success: false, message: err.message || 'Internal Server Error' });
});

app.listen(PORT, () => {
  console.log(`\n🚀 School SaaS API Server running on http://localhost:${PORT}`);
  console.log(`📋 Health check: http://localhost:${PORT}/health`);
  console.log(`🔐 Auth endpoint: http://localhost:${PORT}/api/auth/login`);
  console.log(`\nTest Credentials:`);
  console.log(`  Admin:   admin@schoolsaas.com / password123`);
  console.log(`  Teacher: teacher@schoolsaas.com / password123`);
  console.log(`  Student: student@schoolsaas.com / password123\n`);
});

module.exports = app;
