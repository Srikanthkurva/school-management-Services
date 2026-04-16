const db = require('../config/db');

// Return distinct class names from students table. If none, return a sensible default range.
const defaultClasses = [
  'Nursery', 'Pre-Primary', 'Primary', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'
];

const getClasses = async (req, res) => {
  try {
    const [rows] = await db.query('SELECT DISTINCT class_name as class FROM students WHERE class_name IS NOT NULL ORDER BY class_name');
    const classes = (rows || []).map((r) => r.class).filter(Boolean);
    if (classes.length === 0) return res.json({ success: true, data: defaultClasses });
    return res.json({ success: true, data: classes });
  } catch (error) {
    console.error('Error fetching classes:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

module.exports = { getClasses };
