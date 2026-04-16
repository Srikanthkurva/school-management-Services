const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');

const teacherSelect = `
  SELECT
    t.id,
    t.user_id AS userId,
    COALESCE(u.name, '') AS name,
    COALESCE(u.email, '') AS email,
    COALESCE(u.phone, '') AS phone,
    u.avatar AS avatar,
    COALESCE(u.is_active, true) AS isActive,
    COALESCE(t.subject, '') AS subject,
    COALESCE(t.qualification, '') AS qualification,
    COALESCE(t.experience, '') AS experience,
    t.join_date AS joinDate,
    COALESCE(t.salary, 0) AS salary,
    u.created_at AS createdAt
  FROM teachers t
  LEFT JOIN users u ON u.id = t.user_id
`;

const formatTeacher = (teacher) => ({
  id: teacher.id,
  userId: teacher.userId,
  name: teacher.name,
  email: teacher.email,
  phone: teacher.phone,
  avatar: teacher.avatar,
  subject: teacher.subject,
  qualification: teacher.qualification,
  experience: teacher.experience,
  joinDate: teacher.joinDate,
  salary: Number(teacher.salary || 0),
  isActive: Boolean(teacher.isActive),
  classes: [],
  createdAt: teacher.createdAt,
});

// GET /api/teachers
const getTeachers = async (req, res) => {
  try {
    const { search, subject, page = 1, limit = 10 } = req.query;
    
    let query = `${teacherSelect} WHERE 1=1`;
    let countQuery = `
      SELECT COUNT(*) as total
      FROM teachers t
      LEFT JOIN users u ON u.id = t.user_id
      WHERE 1=1
    `;
    const queryParams = [];

    if (search) {
      const q = `%${search}%`;
      query += ' AND (u.name LIKE ? OR u.email LIKE ? OR t.subject LIKE ?)';
      countQuery += ' AND (u.name LIKE ? OR u.email LIKE ? OR t.subject LIKE ?)';
      queryParams.push(q, q, q);
    }
    if (subject) {
      const s = `%${subject}%`;
      query += ' AND t.subject LIKE ?';
      countQuery += ' AND t.subject LIKE ?';
      queryParams.push(s);
    }

    const startIndex = (Number(page) - 1) * Number(limit);
    query += ' ORDER BY COALESCE(u.created_at, t.join_date) DESC, t.id DESC LIMIT ? OFFSET ?';
    
    const [countRows] = await db.query(countQuery, queryParams);
    const total = countRows[0].total;

    const [rows] = await db.query(query, [...queryParams, Number(limit), startIndex]);

    res.json({ 
      success: true, 
      data: rows.map(formatTeacher), 
      pagination: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / Number(limit)) } 
    });
  } catch (error) {
    console.error('Error fetching teachers:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// GET /api/teachers/:id
const getTeacherById = async (req, res) => {
  try {
    const isTeacherSelfLookup = req.user?.role === 'teacher' && req.params.id === req.user.id;
    const teacherQuery = isTeacherSelfLookup
      ? `${teacherSelect} WHERE t.user_id = ?`
      : `${teacherSelect} WHERE t.id = ?`;
    const [rows] = await db.query(teacherQuery, [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'Teacher not found' });
    res.json({ success: true, data: formatTeacher(rows[0]) });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// POST /api/teachers
const createTeacher = async (req, res) => {
  try {
    const id = uuidv4();
    const { name, email, subject, phone, qualification, experience, joinDate, salary } = req.body;
    
    const query = `
      INSERT INTO teachers (id, name, email, subject, phone, qualification, experience, joinDate, salary)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    await db.query(query, [id, name, email, subject, phone, qualification, experience, joinDate, salary]);
    
    res.status(201).json({ success: true, message: 'Teacher created successfully', data: { id, ...req.body } });
  } catch (error) {
    console.error('Error creating teacher:', error);
    res.status(500).json({ success: false, message: 'Error creating teacher' });
  }
};

// PUT /api/teachers/:id
const updateTeacher = async (req, res) => {
  try {
    const { name, email, subject, phone, qualification, experience, isActive, salary } = req.body;
    const query = `
      UPDATE teachers 
      SET name=?, email=?, subject=?, phone=?, qualification=?, experience=?, isActive=?, salary=? 
      WHERE id=?
    `;
    const [result] = await db.query(query, [name, email, subject, phone, qualification, experience, isActive, salary, req.params.id]);
    
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Teacher not found' });
    res.json({ success: true, message: 'Teacher updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// DELETE /api/teachers/:id
const deleteTeacher = async (req, res) => {
  try {
    const [result] = await db.query('DELETE FROM teachers WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Teacher not found' });
    res.json({ success: true, message: 'Teacher deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

module.exports = { getTeachers, getTeacherById, createTeacher, updateTeacher, deleteTeacher };
