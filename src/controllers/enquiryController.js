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

      // 3. Send Emails
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
            const testAccount = await nodemailer.createTestAccount();
            transport = nodemailer.createTransport({
               host: 'smtp.ethereal.email',
               port: 587,
               secure: false,
               auth: { user: testAccount.user, pass: testAccount.pass }
            });
         }

         // 1. Parent Confirmation Email
         const parentMailOptions = {
            from: '"St. Martins Group of Schools" <info@stmartinsgroup.com>',
            to: email,
            subject: 'Admission Enquiry Received — St. Martins Group of Schools',
            html: `
               <div style="font-family: Arial, Helvetica, sans-serif; max-width:600px;margin:auto;border-radius:12px;overflow:hidden;border:1px solid #e6e9ee;">
                  <div style="background:#0f172a;padding:28px;color:#fff;text-align:center;">
                     <h2 style="margin:0;font-size:20px;letter-spacing:1px;">Enquiry Received</h2>
                  </div>
                  <div style="padding:24px;background:#fff;color:#0f172a;">
                     <p style="margin:0 0 12px 0;font-size:15px;">Dear ${parentName || 'Parent'},</p>
                     <p style="margin:0 0 12px 0;color:#475569;">Thank you for your interest in <strong>St. Martins Group of Schools</strong>. We have received your admission enquiry for <strong>${childName}</strong> (Grade: ${grade}).</p>
                     <p style="margin:0 0 12px 0;color:#475569;">Our relationship manager will get in touch with you shortly at <strong>${mobile}</strong> to discuss the next steps and answer any questions you may have.</p>
                     <div style="margin-top:18px;padding:16px;background:#f8fafc;border-radius:8px;border:1px solid #eef2ff;">
                        <p style="margin:0;font-size:13px;color:#475569;">Enquiry ID: <strong>${enquiryId}</strong></p>
                     </div>
                     <p style="margin-top:16px;font-size:13px;color:#64748b;">We look forward to welcoming you to our campus.</p>
                  </div>
                  <div style="padding:12px;text-align:center;background:#f8fafc;color:#94a3b8;font-size:12px;">St. Martins Group of Schools</div>
               </div>
            `
         };

         // 2. Admin Notification Email
         const adminMailOptions = {
            from: '"St. Martins Group of Schools" <system@stmartinsgroup.com>',
            to: process.env.ADMIN_EMAIL || 'admin@stmartinsgroup.com',
            subject: `New Admission Enquiry: ${childName}`,
            html: `
               <div style="font-family: Arial, Helvetica, sans-serif; max-width:600px;margin:auto;border-radius:12px;overflow:hidden;border:1px solid #e6e9ee;">
                  <div style="background:#8b0000;padding:28px;color:#fff;text-align:center;">
                     <h2 style="margin:0;font-size:20px;letter-spacing:1px;">New Enquiry Alert</h2>
                  </div>
                  <div style="padding:24px;background:#fff;color:#0f172a;">
                     <p style="margin:0 0 12px 0;font-weight:bold;">Enquiry Details:</p>
                     <table style="width:100%;font-size:14px;border-collapse:collapse;">
                        <tr><td style="padding:8px 0;color:#64748b;width:140px;">Child Name:</td><td style="padding:8px 0;font-weight:bold;">${childName}</td></tr>
                        <tr><td style="padding:8px 0;color:#64748b;">Grade:</td><td style="padding:8px 0;font-weight:bold;">${grade}</td></tr>
                        <tr><td style="padding:8px 0;color:#64748b;">School Campus:</td><td style="padding:8px 0;font-weight:bold;">${school}</td></tr>
                        <tr><td style="padding:8px 0;color:#64748b;">Parent Name:</td><td style="padding:8px 0;font-weight:bold;">${parentName}</td></tr>
                        <tr><td style="padding:8px 0;color:#64748b;">Contact:</td><td style="padding:8px 0;font-weight:bold;">${mobile} / ${email}</td></tr>
                     </table>
                  </div>
                  <div style="padding:12px;text-align:center;background:#f8fafc;color:#94a3b8;font-size:12px;">St. Martins Group of Schools — Enquiry Notification</div>
               </div>
            `
         };

         await Promise.all([
            transport.sendMail(parentMailOptions),
            transport.sendMail(adminMailOptions)
         ]);

         console.log('Enquiry notifications sent successfully');
      } catch (mailErr) {
         console.error('Failed to send enquiry notification emails:', mailErr);
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
