require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('../src/config/db');

async function seedUsers() {
  const client = await pool.connect();
  
  try {
    // Clear existing users
    await client.query('DELETE FROM users');
    
    const passwordHash = await bcrypt.hash('password123', 10);
    
    // Insert users
    await client.query(
      `INSERT INTO users (id, name, email, password, role, phone, is_active) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      ['u1', 'Super Admin', 'admin@schoolsaas.com', passwordHash, 'admin', '+91 9876543210', true]
    );
    
    await client.query(
      `INSERT INTO users (id, name, email, password, role, phone, is_active) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      ['u2', 'Dr. Priya Sharma', 'teacher@schoolsaas.com', passwordHash, 'teacher', '+91 9876543211', true]
    );
    
    await client.query(
      `INSERT INTO users (id, name, email, password, role, phone, is_active) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      ['u3', 'Rahul Verma', 'student@schoolsaas.com', passwordHash, 'student', '+91 9876543212', true]
    );
    
    console.log('\n✅ Users seeded to NeonDB');
    console.log('=================================');
    console.log('Email               | Password     | Role    ');
    console.log('-----------------------------------');
    console.log('admin@schoolsaas.com | password123 | admin  ');
    console.log('teacher@schoolsaas.com | password123 | teacher');
    console.log('student@schoolsaas.com | password123 | student');
    console.log('=================================\n');
    
  } catch (err) {
    console.error('Error seeding users:', err);
  } finally {
    client.release();
    process.exit(0);
  }
}

seedUsers();