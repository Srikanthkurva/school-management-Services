const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');

const studentSelect = `
  SELECT
    s.id,
    s.user_id AS userId,
    COALESCE(u.name, '') AS name,
    COALESCE(u.email, '') AS email,
    COALESCE(u.phone, '') AS phone,
    u.avatar AS avatar,
    COALESCE(u.is_active, true) AS isActive,
    s.roll_no AS rollNo,
    s.class_name AS class,
    -- section removed
    COALESCE(s.parent_name, '') AS parentName,
    COALESCE(s.parent_phone, '') AS parentPhone,
    s.dob,
    COALESCE(s.gender, '') AS gender,
    COALESCE(s.address, '') AS address,
    s.admission_date AS admissionDate,
    COALESCE(s.total_fees, 0) AS totalFees,
    COALESCE(s.paid_fees, 0) AS paidFees,
    u.created_at AS createdAt
  FROM students s
  LEFT JOIN users u ON u.id = s.user_id
  LEFT JOIN admissions a ON a.student_id = s.id
`;

const formatStudent = (student) => {
  const totalFees = Number(student.totalFees || 0);
  const paidFees = Number(student.paidFees || 0);

  return {
    id: student.id,
    userId: student.userId,
    name: student.name,
    email: student.email,
    phone: student.phone,
    avatar: student.avatar,
    isActive: Boolean(student.isActive),
    rollNo: student.rollNo,
    class: student.class,
    // section removed
    parentName: student.parentName,
    parentPhone: student.parentPhone,
    dob: student.dob,
    gender: student.gender,
    address: student.address,
    admissionDate: student.admissionDate,
    createdAt: student.createdAt,
    fees: {
      total: totalFees,
      paid: paidFees,
      due: Math.max(totalFees - paidFees, 0),
    },
  };
};

// GET /api/students
const getStudents = async (req, res) => {
  try {
    const { search, class: cls, page = 1, limit = 10 } = req.query;
    
    // Only include students that have an approved admission record
    let query = `${studentSelect} WHERE a.status = 'approved'`;
    let countQuery = `
      SELECT COUNT(*) as total
      FROM students s
      LEFT JOIN users u ON u.id = s.user_id
      LEFT JOIN admissions a ON a.student_id = s.id
      WHERE a.status = 'approved'
    `;
    const queryParams = [];

    if (search) {
      const q = `%${search}%`;
      query += ' AND (u.name LIKE ? OR s.roll_no LIKE ? OR u.email LIKE ?)';
      countQuery += ' AND (u.name LIKE ? OR s.roll_no LIKE ? OR u.email LIKE ?)';
      queryParams.push(q, q, q);
    }
    if (cls) {
      query += ' AND s.class_name = ?';
      countQuery += ' AND s.class_name = ?';
      queryParams.push(cls);
    }
    // section filter removed

    const startIndex = (Number(page) - 1) * Number(limit);
    query += ' ORDER BY COALESCE(u.created_at, s.admission_date) DESC, s.id DESC LIMIT ? OFFSET ?';
    
    const [countRows] = await db.query(countQuery, queryParams);
    const total = countRows[0].total;

    const [rows] = await db.query(query, [...queryParams, Number(limit), startIndex]);

    res.json({ 
      success: true, 
      data: rows.map(formatStudent), 
      pagination: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / Number(limit)) } 
    });
  } catch (error) {
    console.error('Error fetching students:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// GET /api/students/:id
const getStudentById = async (req, res) => {
  try {
    const isStudentSelfLookup = req.user?.role === 'student' && req.params.id === req.user.id;
    const studentQuery = isStudentSelfLookup
      ? `${studentSelect} WHERE s.user_id = ?`
      : `${studentSelect} WHERE s.id = ?`;
    const [rows] = await db.query(studentQuery, [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'Student not found' });
    res.json({ success: true, data: formatStudent(rows[0]) });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// POST /api/students
const createStudent = async (req, res) => {
  try {
    const id = uuidv4();
    const { name, email, rollNo, class: cls, parentName, parentPhone, dob, gender, address } = req.body;
    
    const query = `
      INSERT INTO students (id, name, email, rollNo, class, parentName, parentPhone, dob, gender, address, admissionDate)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `;
    await db.query(query, [id, name, email, rollNo, cls, parentName, parentPhone, dob, gender, address]);
    
    res.status(201).json({ success: true, message: 'Student created successfully', data: { id, ...req.body } });
  } catch (error) {
    console.error('Error creating student:', error);
    res.status(500).json({ success: false, message: 'Error creating student' });
  }
};

// PUT /api/students/:id
const updateStudent = async (req, res) => {
  try {
    const { name, email, class: cls, parentName, parentPhone, isActive } = req.body;
    const query = `
      UPDATE students 
      SET name=?, email=?, class=?, parentName=?, parentPhone=?, isActive=? 
      WHERE id=?
    `;
    const [result] = await db.query(query, [name, email, cls, parentName, parentPhone, isActive, req.params.id]);
    
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Student not found' });
    res.json({ success: true, message: 'Student updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// DELETE /api/students/:id
const deleteStudent = async (req, res) => {
  try {
    const [result] = await db.query('DELETE FROM students WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Student not found' });
    res.json({ success: true, message: 'Student deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

module.exports = { getStudents, getStudentById, createStudent, updateStudent, deleteStudent };
