require('dotenv').config();
const pool = require('../src/config/db').originalPool;

async function migrate() {
  const client = await pool.connect();
  
  try {
    console.log('Running comprehensive migrations...');
    
    // Helper to add column if not exists
    const addColumnIfNotExists = async (table, column, type) => {
      try {
        await client.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
        console.log(`✅ Added ${column} to ${table}`);
      } catch (e) {
        if (e.code === '42701') {
          console.log(`ℹ️ ${column} already exists in ${table}`);
        } else {
          console.log(`⚠️ Error: ${e.message}`);
        }
      }
    };
    
    // Add all missing columns to students table
    await addColumnIfNotExists('students', 'user_id', 'VARCHAR(50)');
    await addColumnIfNotExists('students', 'name', 'VARCHAR(100)');
    await addColumnIfNotExists('students', 'email', 'VARCHAR(100)');
    await addColumnIfNotExists('students', 'roll_no', 'VARCHAR(20)');
    await addColumnIfNotExists('students', 'class_name', 'VARCHAR(20)');
    await addColumnIfNotExists('students', 'section', 'VARCHAR(10)');
    await addColumnIfNotExists('students', 'parent_name', 'VARCHAR(100)');
    await addColumnIfNotExists('students', 'parent_phone', 'VARCHAR(20)');
    await addColumnIfNotExists('students', 'dob', 'DATE');
    await addColumnIfNotExists('students', 'gender', 'VARCHAR(10)');
    await addColumnIfNotExists('students', 'address', 'TEXT');
    await addColumnIfNotExists('students', 'admission_date', 'DATE');
    await addColumnIfNotExists('students', 'total_fees', 'DECIMAL(10,2)');
    await addColumnIfNotExists('students', 'paid_fees', 'DECIMAL(10,2)');
    await addColumnIfNotExists('students', 'is_active', 'BOOLEAN DEFAULT TRUE');
    await addColumnIfNotExists('students', 'created_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP');
    await addColumnIfNotExists('students', 'updated_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP');
    
    // Add all missing columns to teachers table
    await addColumnIfNotExists('teachers', 'user_id', 'VARCHAR(50)');
    await addColumnIfNotExists('teachers', 'name', 'VARCHAR(100)');
    await addColumnIfNotExists('teachers', 'email', 'VARCHAR(100)');
    await addColumnIfNotExists('teachers', 'subject', 'VARCHAR(50)');
    await addColumnIfNotExists('teachers', 'phone', 'VARCHAR(20)');
    await addColumnIfNotExists('teachers', 'qualification', 'VARCHAR(100)');
    await addColumnIfNotExists('teachers', 'experience', 'VARCHAR(20)');
    await addColumnIfNotExists('teachers', 'join_date', 'DATE');
    await addColumnIfNotExists('teachers', 'salary', 'DECIMAL(10,2)');
    await addColumnIfNotExists('teachers', 'is_active', 'BOOLEAN DEFAULT TRUE');
    await addColumnIfNotExists('teachers', 'created_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP');
    await addColumnIfNotExists('teachers', 'updated_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP');
    
    // Add missing columns to other tables
    await addColumnIfNotExists('admissions', 'class_name', 'VARCHAR(50)');
    await addColumnIfNotExists('admissions', 'section', 'VARCHAR(20)');
    await addColumnIfNotExists('admissions', 'student_id', 'VARCHAR(50)');
    
    // Create classes table if not exists
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS classes (
          id VARCHAR(50) PRIMARY KEY,
          name VARCHAR(50) NOT NULL,
          section VARCHAR(10),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('✅ Created classes table');
    } catch (e) {
      if (e.code !== '42P07') console.log('⚠️ Classes table:', e.message);
    }
    
    console.log('\n✅ All migrations complete!');
  } catch (err) {
    console.error('Migration error:', err);
  } finally {
    client.release();
    await pool.end();
    process.exit(0);
  }
}

migrate();