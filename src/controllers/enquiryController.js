const nodemailer = require('nodemailer');
const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');

// transporter will be created on demand below; in dev we can use Ethereal test account

exports.submitEnquiry = async (req, res) => {
   try {
      const { 
         academicYear, board, state, city, 
         school, grade, childName, gender, 
         parentName, mobile, email 
      } = req.body;

      // 1. Log the enquiry
      console.log('New Admission Enquiry:', req.body);

      // 2. Persist enquiry to DB
      const enquiryId = uuidv4();
      const insertQuery = `
         INSERT INTO enquiries (id, academic_year, board, state, city, school, grade, child_name, gender, parent_name, mobile, email)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      await db.query(insertQuery, [
         enquiryId,
         academicYear || null,
         board || null,
         state || null,
         city || null,
         school || null,
         grade || null,
         childName || null,
         gender || null,
         parentName || null,
         mobile || null,
         email || null,
      ]);

      // 3. Send Email
      const recipients = [];
      if (process.env.ADMIN_EMAIL) recipients.push(process.env.ADMIN_EMAIL);
      if (email) recipients.push(email);

      const mailOptions = {
         from: '"Sri Chaitanya Schools" <no-reply@schoolsaas.com>',
         to: recipients.join(','),
         subject: `New Admission Enquiry - ${childName}`,
         html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px;">
               <h2 style="color: #1a237e; border-bottom: 2px solid #e91e63; padding-bottom: 10px;">New Admission Enquiry</h2>
               <p style="font-size: 16px;"><strong>Academic Year:</strong> ${academicYear}</p>
               <div style="background: #f9f9f9; padding: 15px; border-radius: 8px;">
                  <h3 style="margin-top: 0; color: #1a237e;">Child Details</h3>
                  <p><strong>Name:</strong> ${childName}</p>
                  <p><strong>Grade:</strong> ${grade}</p>
                  <p><strong>Gender:</strong> ${gender}</p>
               </div>
               <div style="margin-top: 20px; background: #fff; padding: 15px; border: 1px solid #eee;">
                  <h3 style="margin-top: 0; color: #1a237e;">Parent/Contact Details</h3>
                  <p><strong>Name:</strong> ${parentName}</p>
                  <p><strong>Mobile:</strong> ${mobile}</p>
                  <p><strong>Email:</strong> ${email}</p>
               </div>
               <div style="margin-top: 20px;">
                  <h3 style="margin-top: 0; color: #1a237e;">Campus Preferences</h3>
                  <p><strong>School:</strong> ${school}</p>
                  <p><strong>City:</strong> ${city}, ${state}</p>
                  <p><strong>Board:</strong> ${board}</p>
               </div>
               <p style="margin-top: 30px; font-size: 12px; color: #888;">This is an automated notification from the School Management Platform.</p>
            </div>
         `
      };

      // Attempt to send email. If SMTP not configured, create Ethereal test account for dev.
      try {
         let transport;
         if (process.env.SMTP_HOST && process.env.SMTP_USER) {
            transport = nodemailer.createTransport({
               host: process.env.SMTP_HOST,
               port: process.env.SMTP_PORT || 587,
               secure: false,
               auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
            });
         } else {
            console.log('No SMTP configured — creating Ethereal test account for email preview');
            const testAccount = await nodemailer.createTestAccount();
            transport = nodemailer.createTransport({
               host: 'smtp.ethereal.email',
               port: 587,
               secure: false,
               auth: { user: testAccount.user, pass: testAccount.pass }
            });
         }

         const info = await transport.sendMail(mailOptions);
         console.log('Enquiry Notification Email Sent. MessageId:', info.messageId);
         const preview = nodemailer.getTestMessageUrl(info);
         if (preview) console.log('Preview email at:', preview);
      } catch (mailErr) {
         console.error('Failed to send enquiry notification email:', mailErr);
      }

      res.status(200).json({ 
         success: true, 
         message: 'Enquiry submitted successfully. Our team will contact you.',
         data: { id: enquiryId }
      });

   } catch (error) {
      console.error('Enquiry Error:', error);
      res.status(500).json({ 
         success: false, 
         message: 'Failed to process enquiry. Please try again later.' 
      });
   }
};

   exports.getEnquiries = async (req, res) => {
      try {
         const [rows] = await db.query('SELECT id, academic_year as academicYear, board, state, city, school, grade, child_name as childName, gender, parent_name as parentName, mobile, email, status, created_at as createdAt FROM enquiries ORDER BY created_at DESC LIMIT 200');
         res.json({ success: true, data: rows });
      } catch (error) {
         console.error('Get Enquiries Error:', error);
         res.status(500).json({ success: false, message: 'Failed to fetch enquiries' });
      }
   };
