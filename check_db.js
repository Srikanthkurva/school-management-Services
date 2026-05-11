require('dotenv').config();
const db = require('./src/config/db');

async function check() {
  try {
    const [rows] = await db.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
    console.log("Tables:", rows.map(r => r.table_name));
    
    const [cols] = await db.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'admissions'");
    console.log("Admissions columns:", cols);

    const [scols] = await db.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'students'");
    console.log("Students columns:", scols);
  } catch (err) {
    console.error("Check error:", err);
  } finally {
    process.exit();
  }
}

check();
