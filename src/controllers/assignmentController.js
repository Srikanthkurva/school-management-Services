const pool = require('../config/db');
const { v4: uuidv4 } = require('uuid');

const mapRowToAssignment = (row) => ({
  id: row.id,
  title: row.title,
  description: row.description,
  subject: row.subject,
  class: row.class_name,
  teacherId: row.teacher_id,
  teacherName: row.teacher_name,
  dueDate: row.due_date,
  createdAt: row.created_at,
  maxMarks: row.max_marks,
  submissionCount: row.submission_count,
  totalStudents: row.total_students,
  status: row.status,
  attachments: row.attachments ? JSON.parse(row.attachments) : [],
});

const getAssignments = async (req, res) => {
  try {
    const { class: cls, subject, teacherId, status } = req.query;
    const effectiveTeacherId = req.user?.role === 'teacher' ? req.user.id : teacherId;
    const conditions = [];
    const params = [];
    if (cls) { conditions.push('class_name = ?'); params.push(cls); }
    if (subject) { conditions.push('LOWER(subject) LIKE ?'); params.push(`%${subject.toLowerCase()}%`); }
    if (effectiveTeacherId) { conditions.push('teacher_id = ?'); params.push(effectiveTeacherId); }
    if (status) { conditions.push('status = ?'); params.push(status); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const [rows] = await pool.query(`SELECT * FROM assignments ${where} ORDER BY created_at DESC`, params);
    const data = rows.map(mapRowToAssignment);
    res.json({ success: true, data, total: data.length });
  } catch (err) {
    console.error('getAssignments error', err);
    res.status(500).json({ success: false, message: 'Failed to fetch assignments' });
  }
};

const getAssignmentById = async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM assignments WHERE id = ?', [req.params.id]);
    if (!rows || rows.length === 0) return res.status(404).json({ success: false, message: 'Assignment not found' });
    res.json({ success: true, data: mapRowToAssignment(rows[0]) });
  } catch (err) {
    console.error('getAssignmentById error', err);
    res.status(500).json({ success: false, message: 'Failed to fetch assignment' });
  }
};

const createAssignment = async (req, res) => {
  try {
    const id = uuidv4();
    const teacherId = req.user?.id || req.body.teacherId || null;
    const teacherName = req.user?.name || req.body.teacherName || null;
    const { title, description, subject, class: className, dueDate, maxMarks, totalStudents, attachments } = req.body;
    await pool.query(
      `INSERT INTO assignments (id, title, description, subject, class_name, teacher_id, teacher_name, due_date, created_at, max_marks, submission_count, total_students, status, attachments)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, title, description || null, subject || null, className || null, teacherId, teacherName, dueDate || null, new Date().toISOString(), maxMarks || 0, 0, totalStudents || 0, 'active', JSON.stringify(attachments || [])]
    );
    const [rows] = await pool.query('SELECT * FROM assignments WHERE id = ?', [id]);
    res.status(201).json({ success: true, message: 'Assignment created successfully', data: mapRowToAssignment(rows[0]) });
  } catch (err) {
    console.error('createAssignment error', err);
    res.status(500).json({ success: false, message: 'Failed to create assignment' });
  }
};

const updateAssignment = async (req, res) => {
  try {
    const id = req.params.id;
    const fields = [];
    const params = [];
    Object.entries(req.body).forEach(([k, v]) => {
      if (k === 'class') { fields.push('class_name = ?'); params.push(v); }
      else if (k === 'attachments') { fields.push('attachments = ?'); params.push(JSON.stringify(v)); }
      else { fields.push(`${k} = ?`); params.push(v); }
    });
    if (fields.length === 0) return res.status(400).json({ success: false, message: 'No fields to update' });
    params.push(id);
    await pool.query(`UPDATE assignments SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, params);
    const [rows] = await pool.query('SELECT * FROM assignments WHERE id = ?', [id]);
    res.json({ success: true, message: 'Assignment updated', data: mapRowToAssignment(rows[0]) });
  } catch (err) {
    console.error('updateAssignment error', err);
    res.status(500).json({ success: false, message: 'Failed to update assignment' });
  }
};

const deleteAssignment = async (req, res) => {
  try {
    const id = req.params.id;
    const [rows] = await pool.query('SELECT COUNT(*) as cnt FROM assignments WHERE id = ?', [id]);
    if (!rows || rows[0].cnt === 0) return res.status(404).json({ success: false, message: 'Assignment not found' });
    await pool.query('DELETE FROM assignments WHERE id = ?', [id]);
    res.json({ success: true, message: 'Assignment deleted' });
  } catch (err) {
    console.error('deleteAssignment error', err);
    res.status(500).json({ success: false, message: 'Failed to delete assignment' });
  }
};

module.exports = { getAssignments, getAssignmentById, createAssignment, updateAssignment, deleteAssignment };
