const nodemailer = require('nodemailer');
const { v4: uuidv4 } = require('uuid');
const pool = require('../config/db');
const bcrypt = require('bcryptjs');

// Submit admission: persist as 'pending' and send verification email
exports.submitAdmission = async (req, res) => {
   try {
      const {
         academicYear, board, state, city, school, className, orientation, studentType,
         firstName, lastName, dob, gender, fatherName, motherName, parentMobile, parentEmail,
         aadhaarNo, address, quota, admissionType, fatherOccupation, status
      } = req.body;

      const childName = `${firstName || ''} ${lastName || ''}`.trim();
      const parentName = fatherName || motherName || 'Parent';
      const admissionStatus = status || 'pending';

      const id = uuidv4();

      await pool.query(
         `INSERT INTO admissions (id, academic_year, board, state, city, school, class_name, orientation, student_type, first_name, last_name, dob, gender, father_name, mother_name, parent_mobile, parent_email, aadhaar_no, address, quota, admission_type, father_occupation, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
         [id, academicYear, board, state, city, school, className, orientation, studentType, firstName, lastName, dob || null, gender, fatherName, motherName, parentMobile, parentEmail, aadhaarNo, address, quota, admissionType, fatherOccupation, admissionStatus]
      );

      console.log('Stored new admission (pending):', { id, parentEmail, childName, className });

      // Send verification email to applicant (we received your application)
      const mailOptions = {
         from: '"Sri Chaitanya Schools" <admissions@schoolsaas.com>',
         to: parentEmail,
         subject: 'Application Received — Verification Underway',
         html: `
            <div style="font-family: Arial, Helvetica, sans-serif; max-width:600px;margin:auto;border-radius:12px;overflow:hidden;border:1px solid #e6e9ee;">
               <div style="background:#0f172a;padding:28px;color:#fff;text-align:center;">
                  <h2 style="margin:0;font-size:20px;letter-spacing:1px;">Application Received</h2>
               </div>
               <div style="padding:24px;background:#fff;color:#0f172a;">
                  <p style="margin:0 0 12px 0;font-size:15px;">Dear ${parentName || 'Parent'},</p>
                  <p style="margin:0 0 12px 0;color:#475569;">Thank you for submitting the admission application for <strong>${childName}</strong> to <strong>${className}</strong> (${academicYear}).</p>
                  <p style="margin:0 0 12px 0;color:#475569;">Verification in progress — Our team reviews applications and will contact you for document verification and next steps.</p>
                  <div style="margin-top:18px;padding:16px;background:#f8fafc;border-radius:8px;border:1px solid #eef2ff;">
                     <p style="margin:0;font-size:13px;color:#475569;">Application ID: <strong>${id}</strong></p>
                  </div>
                  <p style="margin-top:16px;font-size:13px;color:#64748b;">If you have any questions, reply to this email or call the admissions office.</p>
               </div>
               <div style="padding:12px;text-align:center;background:#f8fafc;color:#94a3b8;font-size:12px;">Sri Chaitanya Schools</div>
            </div>
         `
      };

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
            console.log('No SMTP configured — creating Ethereal test account for verification email');
            const testAccount = await nodemailer.createTestAccount();
            transport = nodemailer.createTransport({
               host: 'smtp.ethereal.email',
               port: 587,
               secure: false,
               auth: { user: testAccount.user, pass: testAccount.pass }
            });
         }

         const info = await transport.sendMail(mailOptions);
         console.log('Verification email sent:', info.messageId);
         const preview = nodemailer.getTestMessageUrl(info);
         if (preview) console.log('Preview email at:', preview);
      } catch (mailErr) {
         console.error('Verification email failed:', mailErr);
      }

      return res.status(200).json({ success: true, id, message: 'Application received. Verification underway.' });
   } catch (err) {
      console.error('submitAdmission error:', err);
      return res.status(500).json({ success: false, message: 'Failed to submit application' });
   }
};

// Get pending admissions (for super admin)
exports.getPendingAdmissions = async (req, res) => {
   try {
      const [rows] = await pool.query(`SELECT * FROM admissions WHERE status = 'pending' ORDER BY created_at DESC`);
      return res.status(200).json({ success: true, data: rows });
   } catch (err) {
      console.error('getPendingAdmissions error:', err);
      return res.status(500).json({ success: false, message: 'Failed to fetch pending admissions' });
   }
};

// Approve an admission: create student + user, generate credentials, send admission email
exports.approveAdmission = async (req, res) => {
   try {
      const { id } = req.params;
      const [rows] = await pool.query(`SELECT * FROM admissions WHERE id = ?`, [id]);
      if (!rows || rows.length === 0) return res.status(404).json({ success: false, message: 'Application not found' });
      const app = rows[0];

      // Generate Admission Number
      const yearPrefix = (app.academic_year || '').split('-')[0] || new Date().getFullYear();
      const randomDigits = Math.floor(10000 + Math.random() * 90000);
      const admissionNo = `SCA-${yearPrefix}-${randomDigits}`;

      const childName = `${app.first_name || ''} ${app.last_name || ''}`.trim();
      const parentName = app.father_name || app.mother_name || 'Parent';

      // Create or finding existing user (for login)
      let userId;
      let rawPassword = '';
      const [existingUser] = await pool.query(`SELECT id FROM users WHERE email = ?`, [app.parent_email]);

      if (existingUser && existingUser.length > 0) {
         userId = existingUser[0].id;
         rawPassword = '(Use your existing portal password)';
      } else {
         userId = uuidv4();
         rawPassword = Math.random().toString(36).slice(-8);
         const hashed = bcrypt.hashSync(rawPassword, 10);
         const userName = childName || parentName || 'Student';
         await pool.query(`INSERT INTO users (id, name, email, password, role, created_at, is_active) VALUES (?, ?, ?, ?, 'student', NOW(), true)`,
            [userId, userName, app.parent_email, hashed]
         );
      }

      // Create student record
      const studentId = uuidv4();
      await pool.query(`INSERT INTO students (id, user_id, roll_no, class_name, section, parent_name, parent_phone, dob, gender, address, admission_date, total_fees, paid_fees) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?)`,
         [studentId, userId, admissionNo, app.class_name, app.section || 'A', parentName, app.parent_mobile, app.dob || null, app.gender || '', app.address || '', 0, 0]
      );

      // Update admission record
      await pool.query(`UPDATE admissions SET status = 'approved', admission_no = ?, student_id = ?, reviewed_at = NOW() WHERE id = ?`,
         [admissionNo, studentId, id]
      );

      // Send approval email with credentials
      const mailOptions = {
         from: '"Sri Chaitanya Schools" <admissions@schoolsaas.com>',
         to: app.parent_email,
         subject: 'Admission Approved — Login Details',
         html: `
            <div style="font-family: Arial, Helvetica, sans-serif; max-width:600px;margin:auto;border-radius:12px;overflow:hidden;border:1px solid #e6e9ee;">
               <div style="background:#0f172a;padding:28px;color:#fff;text-align:center;">
                  <h2 style="margin:0;font-size:20px;letter-spacing:1px;">Admission Approved</h2>
               </div>
               <div style="padding:24px;background:#fff;color:#0f172a;">
                  <p style="margin:0 0 12px 0;">Dear ${parentName},</p>
                  <p style="margin:0 0 12px 0;color:#475569;">Congratulations — the application for <strong>${childName}</strong> has been approved.</p>
                  <div style="margin-top:12px;padding:16px;background:#f1f5f9;border-radius:8px;">
                     <p style="margin:0;font-size:13px;color:#0f172a;"><strong>Admission Number:</strong> ${admissionNo}</p>
                     <p style="margin:6px 0 0 0;font-size:13px;color:#0f172a;"><strong>Temporary Password:</strong> ${rawPassword}</p>
                  </div>
                  <p style="margin-top:16px;font-size:13px;color:#64748b;">Use these credentials to login to the parent/student portal. Please change the password after first login.</p>
               </div>
               <div style="padding:12px;text-align:center;background:#f8fafc;color:#94a3b8;font-size:12px;">Sri Chaitanya Schools</div>
            </div>
         `
      };

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
            console.log('No SMTP configured — creating Ethereal test account for approval email');
            const testAccount = await nodemailer.createTestAccount();
            transport = nodemailer.createTransport({
               host: 'smtp.ethereal.email',
               port: 587,
               secure: false,
               auth: { user: testAccount.user, pass: testAccount.pass }
            });
         }

         const info = await transport.sendMail(mailOptions);
         console.log('Approval email sent:', info.messageId);
         const preview = nodemailer.getTestMessageUrl(info);
         if (preview) console.log('Preview email at:', preview);
      } catch (mailErr) {
         console.error('Approval email failed:', mailErr);
      }

      return res.status(200).json({ success: true, message: 'Application approved and credentials emailed.' });
   } catch (err) {
      console.error('approveAdmission error:', err);
      return res.status(500).json({ success: false, message: 'Failed to approve application' });
   }
};

// Admin: Add student directly (approved immediately, no pending status)
exports.addStudentDirect = async (req, res) => {
   try {
      const {
         academicYear, firstName, lastName, dob, gender, fatherName, motherName, parentMobile, parentEmail,
         className, section, rollNo
      } = req.body;

      const childName = `${firstName || ''} ${lastName || ''}`.trim();
      const parentName = fatherName || motherName || 'Parent';

      // Generate Admission Number if not provided
      let admissionNo = rollNo;
      if (!admissionNo) {
         const yearPrefix = (academicYear || '').split('-')[0] || new Date().getFullYear();
         const randomDigits = Math.floor(10000 + Math.random() * 90000);
         admissionNo = `SCA-${yearPrefix}-${randomDigits}`;
      }

      // Create or find existing user
      let userId;
      let rawPassword = '';
      const [existingUser] = await pool.query(`SELECT id FROM users WHERE email = ?`, [parentEmail]);

      if (existingUser && existingUser.length > 0) {
         userId = existingUser[0].id;
         rawPassword = '(Use existing portal password)';
      } else {
         userId = uuidv4();
         rawPassword = Math.random().toString(36).slice(-8);
         const hashed = bcrypt.hashSync(rawPassword, 10);
         const userName = childName || parentName || 'Student';
         await pool.query(`INSERT INTO users (id, name, email, password, role, created_at, is_active) VALUES (?, ?, ?, ?, 'student', NOW(), true)`,
            [userId, userName, parentEmail, hashed]
         );
      }

      // Create student record (directly approved)
      const studentId = uuidv4();
      await pool.query(`INSERT INTO students (id, user_id, roll_no, class_name, section, parent_name, parent_phone, dob, gender, address, admission_date, total_fees, paid_fees) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?)`,
         [studentId, userId, admissionNo, className, section || 'A', parentName, parentMobile, dob || null, gender || '', '', 0, 0]
      );

      // Create admission record as 'approved' directly
      await pool.query(`INSERT INTO admissions (id, academic_year, first_name, last_name, dob, gender, father_name, mother_name, parent_mobile, parent_email, class_name, section, student_id, status, admission_no, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'approved', ?, NOW())`,
         [uuidv4(), academicYear, firstName, lastName, dob || null, gender, fatherName, motherName, parentMobile, parentEmail, className, section || 'A', studentId, admissionNo]
      );

      // Auto-login parent: create parent user with student role if not exists
      
      // Send confirmation email
      const mailOptions = {
         from: '"Sri Chaitanya Schools" <admissions@schoolsaas.com>',
         subject: 'Student Added Successfully',
         html: `
            <div style="font-family: Arial, Helvetica, sans-serif; max-width:600px;margin:auto;border-radius:12px;overflow:hidden;border:1px solid #e6e9ee;">
               <div style="background:#0f172a;padding:28px;color:#fff;text-align:center;">
                  <h2 style="margin:0;font-size:20px;letter-spacing:1px;">Student Added</h2>
               </div>
               <div style="padding:24px;background:#fff;color:#0f172a;">
                  <p style="margin:0 0 12px 0;">Dear ${parentName},</p>
                  <p style="margin:0 0 12px 0;color:#475569;">Your child <strong>${childName}</strong> has been registered in <strong>${className}</strong> (${academicYear}).</p>
                  <div style="margin-top:12px;padding:16px;background:#f1f5f9;border-radius:8px;">
                     <p style="margin:0;font-size:13px;color:#0f172a;"><strong>Admission Number:</strong> ${admissionNo}</p>
                     <p style="margin:6px 0 0 0;font-size:13px;color:#0f172a;"><strong>Temporary Password:</strong> ${rawPassword}</p>
                  </div>
                  <p style="margin-top:16px;font-size:13px;color:#64748b;">Use these credentials to login to the parent portal.</p>
               </div>
               <div style="padding:12px;text-align:center;background:#f8fafc;color:#94a3b8;font-size:12px;">Sri Chaitanya Schools</div>
            </div>
         `
      };

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
         const info = await transport.sendMail(mailOptions);
         console.log('Student added email sent:', info.messageId);
      } catch (mailErr) {
         console.error('Add student email failed:', mailErr);
      }

      return res.status(200).json({ success: true, message: 'Student added successfully', studentId, admissionNo });
   } catch (err) {
      console.error('addStudentDirect error:', err);
      return res.status(500).json({ success: false, message: 'Failed to add student' });
   }
};

// Reject an admission and notify
exports.rejectAdmission = async (req, res) => {
   try {
      const { id } = req.params;
      const { reason } = req.body;
      const [rows] = await pool.query(`SELECT * FROM admissions WHERE id = ?`, [id]);
      if (!rows || rows.length === 0) return res.status(404).json({ success: false, message: 'Application not found' });
      const app = rows[0];
      
      const childName = `${app.first_name || ''} ${app.last_name || ''}`.trim();
      const parentName = app.father_name || app.mother_name || 'Parent';

      await pool.query(`UPDATE admissions SET status = 'rejected', reviewed_at = NOW() WHERE id = ?`, [id]);

      const mailOptions = {
         from: '"Sri Chaitanya Schools" <admissions@schoolsaas.com>',
         to: app.parent_email,
         subject: 'Admission Application Update',
         html: `
            <div style="font-family: Arial, Helvetica, sans-serif; max-width:600px;margin:auto;border-radius:12px;overflow:hidden;border:1px solid #e6e9ee;">
               <div style="background:#0f172a;padding:28px;color:#fff;text-align:center;">
                  <h2 style="margin:0;font-size:20px;">Application Update</h2>
               </div>
               <div style="padding:24px;background:#fff;color:#0f172a;">
                  <p style="margin:0 0 12px 0;">Dear ${parentName},</p>
                  <p style="margin:0 0 12px 0;color:#475569;">We regret to inform you that the application for <strong>${childName}</strong> has not been approved.</p>
                  ${reason ? `<p style="color:#64748b;">Reason: ${reason}</p>` : ''}
                  <p style="margin-top:16px;font-size:13px;color:#64748b;">If you believe this is a mistake, please contact the admissions office.</p>
               </div>
               <div style="padding:12px;text-align:center;background:#f8fafc;color:#94a3b8;font-size:12px;">Sri Chaitanya Schools</div>
            </div>
         `
      };

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

         const info = await transport.sendMail(mailOptions);
         console.log('Rejection email sent:', info.messageId);
         const preview = nodemailer.getTestMessageUrl(info);
         if (preview) console.log('Preview email at:', preview);
      } catch (mailErr) {
         console.error('Rejection email failed:', mailErr);
      }

      return res.status(200).json({ success: true, message: 'Application rejected and applicant notified.' });
   } catch (err) {
      console.error('rejectAdmission error:', err);
      return res.status(500).json({ success: false, message: 'Failed to reject application' });
   }
};
