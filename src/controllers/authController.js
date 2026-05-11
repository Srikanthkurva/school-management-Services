const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/db');
const { users: mockUsers, permissions } = require('../data/mockData');

const jwtSecret = process.env.JWT_SECRET || 'your_super_secret_jwt_key_12345';
const jwtExpiresIn = process.env.JWT_EXPIRES_IN || '7d';

const normalizeRoleFromUserType = (userType) => {
  if (userType === 'teacher') return 'teacher';
  if (userType === 'parent') return 'student';
  return userType || null;
};

const mapUser = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  avatar: user.avatar ?? null,
  phone: user.phone ?? '',
  isActive: Boolean(user.is_active ?? user.isActive ?? true),
  createdAt: user.created_at ?? user.createdAt ?? new Date().toISOString(),
  permissions: permissions[user.role] || [],
});

const buildStudentPortalEmail = (admissionNo, fallbackId) => {
  const slug = String(admissionNo || fallbackId || uuidv4())
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);

  return `student+${slug || 'portal-user'}@portal.stmartins.local`;
};

const findDbUserByIdentifier = async (identifier) => {
  const [rows] = await db.query(
    `SELECT id, name, email, password, role, avatar, phone, is_active, created_at, employee_id, admission_no
     FROM users
     WHERE LOWER(email) = LOWER(?)
       OR LOWER(employee_id) = LOWER(?)
       OR LOWER(admission_no) = LOWER(?)
     LIMIT 1`,
    [identifier, identifier, identifier]
  );

  return rows[0] || null;
};

const findStudentPortalRecordByIdentifier = async (identifier) => {
  const [rows] = await db.query(
    `SELECT
       s.id AS student_id,
       s.user_id AS student_user_id,
       s.name AS student_name,
       s.email AS student_email,
       s.roll_no AS roll_no,
       s.parent_phone AS student_parent_phone,
       a.parent_email AS parent_email,
       a.admission_no AS admission_no,
       a.status AS admission_status,
       a.created_at AS admission_created_at,
       u.id AS linked_user_id,
       u.name AS linked_user_name,
       u.email AS linked_user_email,
       u.password AS linked_user_password,
       u.role AS linked_user_role,
       u.avatar AS linked_user_avatar,
       u.phone AS linked_user_phone,
       u.is_active AS linked_user_is_active,
       u.created_at AS linked_user_created_at
     FROM students s
     LEFT JOIN admissions a ON a.student_id = s.id
     LEFT JOIN users u ON u.id = s.user_id
     WHERE LOWER(COALESCE(s.roll_no, '')) = LOWER(?)
        OR LOWER(COALESCE(a.admission_no, '')) = LOWER(?)
        OR LOWER(COALESCE(a.parent_email, '')) = LOWER(?)
        OR LOWER(COALESCE(s.email, '')) = LOWER(?)
     ORDER BY
       CASE
         WHEN LOWER(COALESCE(s.roll_no, '')) = LOWER(?) THEN 0
         WHEN LOWER(COALESCE(a.admission_no, '')) = LOWER(?) THEN 0
         ELSE 1
       END,
       COALESCE(a.created_at, u.created_at) DESC
     LIMIT 1`,
    [identifier, identifier, identifier, identifier, identifier, identifier]
  );

  return rows[0] || null;
};

const syncStudentPortalAdmissionNumber = async (userId, admissionNo) => {
  if (!userId || !admissionNo) return;

  await db.query(
    `UPDATE users
     SET admission_no = ?
     WHERE id = ?
       AND (admission_no IS NULL OR admission_no <> ?)`,
    [admissionNo, userId, admissionNo]
  );
};

const provisionDedicatedStudentPortalUser = async (record) => {
  const userId = uuidv4();
  const admissionNo = record.admission_no || record.roll_no || record.student_id;
  const portalEmail = buildStudentPortalEmail(admissionNo, record.student_id);
  const displayName = record.student_name || record.linked_user_name || 'Student';

  await db.query(
    `INSERT INTO users (id, name, email, password, role, admission_no, phone, created_at, is_active)
     VALUES (?, ?, ?, ?, 'student', ?, ?, NOW(), true)`,
    [
      userId,
      displayName,
      portalEmail,
      record.linked_user_password,
      admissionNo,
      record.student_parent_phone || record.linked_user_phone || '',
    ]
  );

  await db.query(`UPDATE students SET user_id = ? WHERE id = ?`, [userId, record.student_id]);

  if (record.linked_user_id && record.linked_user_role && record.linked_user_role !== 'student') {
    await db.query(
      `UPDATE users
       SET admission_no = NULL
       WHERE id = ?
         AND role <> 'student'`,
      [record.linked_user_id]
    );
  }

  return {
    id: userId,
    name: displayName,
    email: record.parent_email || record.student_email || portalEmail,
    password: record.linked_user_password,
    role: 'student',
    avatar: null,
    phone: record.student_parent_phone || record.linked_user_phone || '',
    is_active: true,
    created_at: new Date().toISOString(),
  };
};

const authenticateStudentPortalUser = async (identifier, password) => {
  const record = await findStudentPortalRecordByIdentifier(identifier);

  if (!record || (record.admission_status && record.admission_status !== 'approved')) {
    return null;
  }

  if (!record.linked_user_id || !record.linked_user_password) {
    return null;
  }

  const passwordMatches = await bcrypt.compare(password, record.linked_user_password);
  if (!passwordMatches) {
    return null;
  }

  const admissionNo = record.admission_no || record.roll_no;

  if (record.linked_user_role === 'student') {
    await syncStudentPortalAdmissionNumber(record.linked_user_id, admissionNo);

    return {
      id: record.linked_user_id,
      name: record.linked_user_name || record.student_name || 'Student',
      email: record.parent_email || record.student_email || record.linked_user_email,
      password: record.linked_user_password,
      role: 'student',
      avatar: record.linked_user_avatar ?? null,
      phone: record.linked_user_phone || record.student_parent_phone || '',
      is_active: record.linked_user_is_active ?? true,
      created_at: record.linked_user_created_at ?? new Date().toISOString(),
    };
  }

  return provisionDedicatedStudentPortalUser(record);
};

const findMockUserByIdentifier = (identifier) => {
  const normalized = String(identifier).trim().toLowerCase();
  return (
    mockUsers.find((user) =>
      user.email?.toLowerCase() === normalized ||
      user.employee_id?.toLowerCase() === normalized ||
      user.admission_no?.toLowerCase() === normalized
    ) || null
  );
};

const login = async (req, res) => {
  try {
    // Debug log for login payload
    console.log('[LOGIN DEBUG] Payload:', req.body);
    const { identifier, password, userType } = req.body;
    const normalizedIdentifier = String(identifier || '').trim();

    if (!normalizedIdentifier || !password) {
      return res.status(400).json({ success: false, message: 'Identifier and password are required.' });
    }

    const expectedRole = normalizeRoleFromUserType(userType);
    let dbUser = null;
    let studentPortalUser = null;

    if (expectedRole === 'student') {
      try {
        studentPortalUser = await authenticateStudentPortalUser(normalizedIdentifier, password);
      } catch (studentPortalError) {
        console.warn('Student portal lookup warning:', studentPortalError.message);
      }
    }

    try {
      dbUser = await findDbUserByIdentifier(normalizedIdentifier);
    } catch (dbErr) {
      console.warn('Database query warning (will fallback to mock data):', dbErr.message);
    }

    const mockUser = findMockUserByIdentifier(normalizedIdentifier);

    let authenticatedUser = studentPortalUser;

    if (!authenticatedUser && dbUser) {
      const passwordMatches = await bcrypt.compare(password, dbUser.password);
      if (passwordMatches) {
        authenticatedUser = dbUser;
      } else if (mockUser && (await bcrypt.compare(password, mockUser.password))) {
        authenticatedUser = {
          ...dbUser,
          password: mockUser.password,
        };
      }
    } else if (!authenticatedUser && mockUser && (await bcrypt.compare(password, mockUser.password))) {
      authenticatedUser = {
        id: mockUser.id,
        name: mockUser.name,
        email: mockUser.email,
        password: mockUser.password,
        role: mockUser.role,
        avatar: mockUser.avatar,
        phone: mockUser.phone,
        is_active: mockUser.isActive,
        created_at: mockUser.createdAt,
      };
    }

    if (!authenticatedUser) {
      console.log(`Login failed for identifier: ${normalizedIdentifier}, userType: ${userType}`);
      return res.status(401).json({ success: false, message: 'Invalid credentials. Please check your email/ID and password.' });
    }

    if (expectedRole && authenticatedUser.role !== expectedRole && !(authenticatedUser.role === 'admin' && userType === 'teacher')) {
      console.log(`Role mismatch: expected ${expectedRole}, got ${authenticatedUser.role}`);
      return res.status(403).json({ success: false, message: `This account has role '${authenticatedUser.role}' but you selected '${userType}'. Please select the correct portal.` });
    }

    if (!(authenticatedUser.is_active ?? authenticatedUser.isActive ?? true)) {
      return res.status(403).json({ success: false, message: 'This account is inactive. Please contact your administrator.' });
    }

    const user = mapUser(authenticatedUser);
    const token = jwt.sign({ id: user.id, role: user.role, email: user.email }, jwtSecret, {
      expiresIn: jwtExpiresIn,
    });

    console.log(`✅ Login successful for: ${user.email} (role: ${user.role})`);

    return res.json({
      success: true,
      message: 'Login successful.',
      data: { user, token },
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Server error during login. Please try again later.' 
    });
  }
};

const getMe = async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT id, name, email, role, avatar, phone, is_active, created_at FROM users WHERE id = ? LIMIT 1',
      [req.user.id]
    );

    const dbUser = rows[0];
    const fallbackUser = mockUsers.find((user) => user.id === req.user.id || user.email === req.user.email);
    const user = dbUser || fallbackUser;

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const mappedUser = mapUser(user);

    if (mappedUser.role === 'student') {
      const [studentRows] = await db.query(
        `SELECT s.name AS student_name, s.email AS student_email, a.parent_email AS parent_email
         FROM students s
         LEFT JOIN admissions a ON a.student_id = s.id
         WHERE s.user_id = ?
         ORDER BY a.created_at DESC
         LIMIT 1`,
        [mappedUser.id]
      );

      if (studentRows[0]) {
        mappedUser.name = studentRows[0].student_name || mappedUser.name;
        mappedUser.email = studentRows[0].parent_email || studentRows[0].student_email || mappedUser.email;
      }
    }

    return res.json({
      success: true,
      data: { user: mappedUser },
    });
  } catch (error) {
    console.error('Get current user error:', error);
    return res.status(500).json({ success: false, message: 'Server Error' });
  }
};

const logout = async (_req, res) =>
  res.json({
    success: true,
    message: 'Logged out successfully.',
  });

const setupFirstTime = async (req, res) => {
  try {
    const { identifier, dob, newPassword } = req.body;

    if (!identifier || !dob || !newPassword) {
      return res.status(400).json({ success: false, message: 'Identifier, date of birth and new password are required.' });
    }

    const mockUser = findMockUserByIdentifier(identifier);
    if (mockUser && mockUser.dob === dob) {
      return res.json({
        success: true,
        message: 'Account setup completed. Please sign in with your new password.',
      });
    }

    return res.status(400).json({
      success: false,
      message: 'First-time setup is not available for this account in the current database.',
    });
  } catch (error) {
    console.error('Setup first time error:', error);
    return res.status(500).json({ success: false, message: 'Server Error' });
  }
};

module.exports = { login, getMe, logout, setupFirstTime };
