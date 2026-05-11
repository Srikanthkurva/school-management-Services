require("dotenv").config();
const db = require("./src/config/db");

(async () => {
  try {
    const [rows] = await db.query("SELECT * FROM users WHERE email = 'cheela.swathinaveen@gmail.com'");
    console.log("DB USER:", rows);
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
