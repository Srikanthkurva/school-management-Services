require('dotenv').config();
const pool = require('../src/config/db').originalPool;

async function migrate() {
  const client = await pool.connect();
  
  try {
    console.log('Running migrations...');
    
    // Add user_id column to students if not exists
    try {
      await client.query(`ALTER TABLE students ADD COLUMN user_id VARCHAR(50)`);
      console.log('✅ Added user_id to students');
    } catch (e) {
      if (e.code === '42701') {
        console.log('ℹ️ user_id column already exists in students');
      } else {
        console.log('⚠️ Error adding user_id to students:', e.message);
      }
    }
    
    // Add user_id column to teachers if not exists
    try {
      await client.query(`ALTER TABLE teachers ADD COLUMN user_id VARCHAR(50)`);
      console.log('✅ Added user_id to teachers');
    } catch (e) {
      if (e.code === '42701') {
        console.log('ℹ️ user_id column already exists in teachers');
      } else {
        console.log('⚠️ Error adding user_id to teachers:', e.message);
      }
    }
    
    console.log('\n✅ Migrations complete!');
  } catch (err) {
    console.error('Migration error:', err);
  } finally {
    client.release();
    await pool.end();
    process.exit(0);
  }
}

migrate();