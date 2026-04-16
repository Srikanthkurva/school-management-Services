const mysql = require('mysql2/promise');

const dbConfig = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || 'root',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

const pool = mysql.createPool({ ...dbConfig, database: process.env.DB_NAME || 'school_db' });

const initializeDB = async () => {
  try {
    // 1. Create DB if missing
    const tempConnection = await mysql.createConnection(dbConfig);
    const dbName = process.env.DB_NAME || 'school_db';
    await tempConnection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
    await tempConnection.end();

    // 2. Connect to actual DB pool
    const connection = await pool.getConnection();
    console.log('✅ Connected to MySQL Database');

    // Create tables if they do not exist
    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(20) NOT NULL,
        avatar VARCHAR(255),
        phone VARCHAR(20),
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        isActive BOOLEAN DEFAULT true
      );
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS students (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        rollNo VARCHAR(20) UNIQUE NOT NULL,
        class VARCHAR(10) NOT NULL,
        section VARCHAR(10) NOT NULL,
        parentName VARCHAR(100),
        parentPhone VARCHAR(20),
        dob DATE,
        gender VARCHAR(10),
        address TEXT,
        admissionDate DATETIME,
        isActive BOOLEAN DEFAULT true,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      );
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS teachers (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        subject VARCHAR(50) NOT NULL,
        phone VARCHAR(20) NOT NULL,
        qualification VARCHAR(100),
        experience VARCHAR(20),
        joinDate DATE,
        salary DECIMAL(10,2),
        isActive BOOLEAN DEFAULT true,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      );
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS enquiries (
        id VARCHAR(50) PRIMARY KEY,
        academic_year VARCHAR(20),
        board VARCHAR(50),
        state VARCHAR(50),
        city VARCHAR(50),
        school VARCHAR(100),
        grade VARCHAR(20),
        child_name VARCHAR(100),
        gender VARCHAR(20),
        parent_name VARCHAR(100),
        mobile VARCHAR(20),
        email VARCHAR(100),
        status VARCHAR(20) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS admissions (
        id VARCHAR(50) PRIMARY KEY,
        academic_year VARCHAR(20),
        class_name VARCHAR(50),
        school VARCHAR(100),
        child_name VARCHAR(100),
        first_name VARCHAR(100),
        last_name VARCHAR(100),
        parent_name VARCHAR(100),
        parent_email VARCHAR(100),
        parent_mobile VARCHAR(20),
        status VARCHAR(20) DEFAULT 'pending',
        admission_no VARCHAR(50),
        student_id VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        reviewed_at TIMESTAMP NULL
      );
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS assignments (
        id VARCHAR(50) PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        subject VARCHAR(100),
        class_name VARCHAR(50),
        teacher_id VARCHAR(50),
        teacher_name VARCHAR(100),
        due_date DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        max_marks INT DEFAULT 0,
        submission_count INT DEFAULT 0,
        total_students INT DEFAULT 0,
        status VARCHAR(20) DEFAULT 'active',
        attachments JSON NULL
      );
    `);

    // Seed assignments table from mockData if empty
    try {
      const [rows] = await connection.query('SELECT COUNT(*) as cnt FROM assignments');
      const count = rows[0].cnt || 0;
      if (count === 0) {
        // Delay requiring mockData until here to avoid circular deps
        const mock = require('../data/mockData');
        if (Array.isArray(mock.assignments) && mock.assignments.length > 0) {
          const insertPromises = mock.assignments.map((a) => {
            return connection.query(
              `INSERT INTO assignments (id, title, description, subject, class_name, teacher_id, teacher_name, due_date, created_at, max_marks, submission_count, total_students, status, attachments)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [a.id, a.title, a.description, a.subject, a.class, a.teacherId, a.teacherName, a.dueDate || null, a.createdAt || new Date().toISOString(), a.maxMarks || 0, a.submissionCount || 0, a.totalStudents || 0, a.status || 'active', JSON.stringify(a.attachments || [])]
            );
          });
          await Promise.all(insertPromises);
          console.log(`✅ Seeded assignments table with ${mock.assignments.length} items`);
        }
      }
    } catch (seedErr) {
      console.warn('Warning: failed to seed assignments table', seedErr.message);
    }

    connection.release();
  } catch (err) {
    if (err.code === 'ER_BAD_DB_ERROR') {
      console.error('❌ Database does not exist. Please create it manually or check permissions.');
    } else {
      console.error('❌ Database Connection Error:', err);
    }
  }
};

initializeDB();

module.exports = pool;
