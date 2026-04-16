const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
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

const findDbUserByIdentifier = async (identifier) => {
  const [rows] = await db.query(
    'SELECT id, name, email, password, role, avatar, phone, is_active, created_at FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1',
    [identifier]
  );

  return rows[0] || null;
};

const findMockUserByIdentifier = (identifier) =>
  mockUsers.find((user) => user.email.toLowerCase() === String(identifier).toLowerCase()) || null;

const login = async (req, res) => {
  try {
    const { identifier, password, userType } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({ success: false, message: 'Identifier and password are required.' });
    }

    const expectedRole = normalizeRoleFromUserType(userType);
    const dbUser = await findDbUserByIdentifier(identifier);
    const mockUser = findMockUserByIdentifier(identifier);

    let authenticatedUser = null;

    if (dbUser) {
      const passwordMatches = await bcrypt.compare(password, dbUser.password);
      if (passwordMatches) {
        authenticatedUser = dbUser;
      } else if (mockUser && (await bcrypt.compare(password, mockUser.password))) {
        authenticatedUser = {
          ...dbUser,
          password: mockUser.password,
        };
      }
    } else if (mockUser && (await bcrypt.compare(password, mockUser.password))) {
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
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    if (expectedRole && authenticatedUser.role !== expectedRole && !(authenticatedUser.role === 'admin' && userType === 'teacher')) {
      return res.status(403).json({ success: false, message: 'This account does not belong to the selected portal.' });
    }

    if (!(authenticatedUser.is_active ?? authenticatedUser.isActive ?? true)) {
      return res.status(403).json({ success: false, message: 'This account is inactive.' });
    }

    const user = mapUser(authenticatedUser);
    const token = jwt.sign({ id: user.id, role: user.role, email: user.email }, jwtSecret, {
      expiresIn: jwtExpiresIn,
    });

    return res.json({
      success: true,
      message: 'Login successful.',
      data: { user, token },
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ success: false, message: 'Server Error' });
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

    return res.json({
      success: true,
      data: { user: mapUser(user) },
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
