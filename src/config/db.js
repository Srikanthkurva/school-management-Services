const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  ssl: {
    rejectUnauthorized: false
  }
});

const convertPlaceholders = (sql) => {
  let paramIndex = 1;
  sql = sql.replace(/\?/g, () => `$${paramIndex++}`);
  sql = sql.replace(/NOW\(\)/gi, 'CURRENT_TIMESTAMP');
  return sql;
};

const query = async (sql, params) => {
  sql = convertPlaceholders(sql);
  const result = await pool.query(sql, params);
  return [result.rows, null];
};

// Wrap pool.query for PostgreSQL
const poolQuery = async (sql, params) => {
  sql = convertPlaceholders(sql);
  return pool.query(sql, params);
};

const createTableIfNotExists = async (client, tableName, createSQL) => {
  try {
    await client.query(createSQL);
  } catch (err) {
    if (err.code === '42P07') {
      // Table already exists
    } else {
      console.warn(`Warning creating table ${tableName}:`, err.message);
    }
  }
};

const initializeDB = async () => {
  try {
    const client = await pool.connect();
    console.log('✅ Connected to NeonDB (PostgreSQL)');

    await createTableIfNotExists(client, 'users', `
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(20) NOT NULL,
        admission_no VARCHAR(50) UNIQUE,
        employee_id VARCHAR(50) UNIQUE,
        dob DATE,
        avatar VARCHAR(255),
        phone VARCHAR(20),
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await createTableIfNotExists(client, 'students', `
      CREATE TABLE IF NOT EXISTS students (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        roll_no VARCHAR(20) UNIQUE NOT NULL,
        class_name VARCHAR(10) NOT NULL,
        section VARCHAR(10) NOT NULL,
        parent_name VARCHAR(100),
        parent_phone VARCHAR(20),
        dob DATE,
        gender VARCHAR(10),
        address TEXT,
        admission_date DATE,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await createTableIfNotExists(client, 'teachers', `
      CREATE TABLE IF NOT EXISTS teachers (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        subject VARCHAR(50) NOT NULL,
        phone VARCHAR(20) NOT NULL,
        qualification VARCHAR(100),
        experience VARCHAR(20),
        join_date DATE,
        salary DECIMAL(10,2),
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await createTableIfNotExists(client, 'enquiries', `
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

    await createTableIfNotExists(client, 'admissions', `
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

    await createTableIfNotExists(client, 'assignments', `
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
        attachments JSON
      );
    `);

    await createTableIfNotExists(client, 'attendance', `
      CREATE TABLE IF NOT EXISTS attendance (
        id VARCHAR(50) PRIMARY KEY,
        student_id VARCHAR(50),
        class_name VARCHAR(20),
        date DATE NOT NULL,
        status VARCHAR(20),
        subject VARCHAR(50),
        teacher_id VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await createTableIfNotExists(client, 'results', `
      CREATE TABLE IF NOT EXISTS results (
        id VARCHAR(50) PRIMARY KEY,
        student_id VARCHAR(50),
        exam_name VARCHAR(100),
        total_marks INTEGER,
        marks_obtained INTEGER,
        percentage DECIMAL(5, 2),
        grade VARCHAR(5),
        result_status VARCHAR(10),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await createTableIfNotExists(client, 'activity_logs', `
      CREATE TABLE IF NOT EXISTS activity_logs (
        id VARCHAR(50) PRIMARY KEY,
        user_id VARCHAR(50),
        user_name VARCHAR(100),
        action TEXT,
        type VARCHAR(20),
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await createTableIfNotExists(client, 'notifications', `
      CREATE TABLE IF NOT EXISTS notifications (
        id VARCHAR(50) PRIMARY KEY,
        title VARCHAR(255),
        message TEXT,
        type VARCHAR(20),
        target_role VARCHAR(20),
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    client.release();
    console.log('✅ Database tables initialized');
  } catch (err) {
    console.error('❌ Database Connection Error:', err.message);
  }
};

initializeDB();

const db = {
  query,
  pool: poolQuery,
  originalPool: pool
};

module.exports = db;