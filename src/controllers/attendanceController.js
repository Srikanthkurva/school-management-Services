const { attendance } = require('../data/mockData');
const { v4: uuidv4 } = require('uuid');

// GET /api/attendance
const getAttendance = (req, res) => {
  const { studentId, class: cls, date, subject, teacherId } = req.query;
  let filtered = [...attendance];
  const effectiveTeacherId = req.user?.role === 'teacher' ? req.user.id : teacherId;
  if (studentId) filtered = filtered.filter((a) => a.studentId === studentId);
  if (cls) filtered = filtered.filter((a) => a.class === cls);
  if (date) filtered = filtered.filter((a) => a.date === date);
  if (subject) filtered = filtered.filter((a) => a.subject.toLowerCase().includes(subject.toLowerCase()));
  if (effectiveTeacherId) filtered = filtered.filter((a) => a.teacherId === effectiveTeacherId);
  res.json({ success: true, data: filtered, total: filtered.length });
};

// POST /api/attendance
const markAttendance = (req, res) => {
  const { records } = req.body; // Array of { studentId, class, date, status, subject }
  if (!Array.isArray(records) || records.length === 0) {
    return res.status(400).json({ success: false, message: 'Records array is required' });
  }
  const newRecords = records.map((r) => ({ id: uuidv4(), ...r, teacherId: req.user.id, markedAt: new Date().toISOString() }));
  attendance.push(...newRecords);
  res.status(201).json({ success: true, message: 'Attendance marked successfully', data: newRecords });
};

// GET /api/attendance/summary/:studentId
const getStudentAttendanceSummary = (req, res) => {
  const { studentId } = req.params;
  const studentAttendance = attendance.filter((a) => a.studentId === studentId);
  const total = studentAttendance.length;
  const present = studentAttendance.filter((a) => a.status === 'present').length;
  const absent = studentAttendance.filter((a) => a.status === 'absent').length;
  const late = studentAttendance.filter((a) => a.status === 'late').length;
  const percentage = total > 0 ? Math.round((present / total) * 100) : 0;
  res.json({ success: true, data: { total, present, absent, late, percentage, records: studentAttendance } });
};

module.exports = { getAttendance, markAttendance, getStudentAttendanceSummary };
