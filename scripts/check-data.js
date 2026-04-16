require('dotenv').config();
const pool = require('../src/config/db').originalPool;

async function checkData() {
  const client = await pool.connect();
  
  try {
    // Check users
    const users = await client.query('SELECT id, name, email, role FROM users');
    console.log('Users:', users.rows);
    
    // Check teachers table
    const teachers = await client.query('SELECT id, user_id, name, subject FROM teachers');
    console.log('Teachers:', teachers.rows);
    
    // Check students table  
    const students = await client.query('SELECT id, user_id, name, roll_no FROM students');
    console.log('Students:', students.rows);
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    client.release();
    await pool.end();
    process.exit(0);
  }
}

checkData();