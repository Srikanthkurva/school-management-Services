const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');

exports.submitClubRequest = async (req, res) => {
   try {
      const { studentName, grade, clubName, clubVision } = req.body;

      if (!studentName || !grade || !clubName || !clubVision) {
         return res.status(400).json({ 
            success: false, 
            message: 'All fields (Student Name, Grade, Club Name, Vision) are required.' 
         });
      }

      const requestId = uuidv4();
      const insertQuery = `
         INSERT INTO club_requests (id, student_name, grade, club_name, club_vision)
         VALUES (?, ?, ?, ?, ?)
      `;

      await db.query(insertQuery, [requestId, studentName, grade, clubName, clubVision]);

      res.status(200).json({ 
         success: true, 
         message: 'Club request submitted successfully! Our cultural department will review it soon.',
         data: { id: requestId }
      });

   } catch (error) {
      console.error('Club Request Error:', error);
      res.status(500).json({ 
         success: false, 
         message: 'Failed to submit club request. Please try again later.' 
      });
   }
};

exports.getClubRequests = async (req, res) => {
   try {
      const [rows] = await db.query('SELECT * FROM club_requests ORDER BY created_at DESC');
      res.json({ success: true, data: rows });
   } catch (error) {
      console.error('Get Club Requests Error:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch club requests' });
   }
};
