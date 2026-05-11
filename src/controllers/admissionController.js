const nodemailer = require('nodemailer');
const { v4: uuidv4 } = require('uuid');
const pool = require('../config/db');
const bcrypt = require('bcryptjs');

const buildStudentPortalEmail = (admissionNo, fallbackId) => {
   const slug = String(admissionNo || fallbackId || uuidv4())
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40);

   return `student+${slug || 'portal-user'}@portal.stmartins.local`;
};

const createOrReuseStudentPortalUser = async ({ parentEmail, childName, parentName, parentPhone, admissionNo, passwordHash }) => {
   const [existingUsers] = await pool.query(`SELECT id, email, role FROM users WHERE email = ? LIMIT 1`, [parentEmail]);
   const existingUser = existingUsers?.[0] || null;
   const userName = childName || parentName || 'Student';

   if (existingUser && existingUser.role === 'student') {
      await pool.query(
         `UPDATE users
          SET password = ?, admission_no = ?, name = ?, phone = COALESCE(?, phone)
          WHERE id = ?`,
         [passwordHash, admissionNo, userName, parentPhone || null, existingUser.id]
      );

      return {
         userId: existingUser.id,
         sharedEmailConflict: false,
      };
   }

   const userId = uuidv4();
   const loginEmail = existingUser ? buildStudentPortalEmail(admissionNo, userId) : parentEmail;

   await pool.query(
      `INSERT INTO users (id, name, email, password, role, admission_no, phone, created_at, is_active)
       VALUES (?, ?, ?, ?, 'student', ?, ?, NOW(), true)`,
      [userId, userName, loginEmail, passwordHash, admissionNo, parentPhone || '']
   );

   return {
      userId,
      sharedEmailConflict: Boolean(existingUser && existingUser.role !== 'student'),
   };
};

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
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
         [id, academicYear, board, state, city, school, className, orientation, studentType, firstName, lastName, dob || null, gender, fatherName, motherName, parentMobile, parentEmail, aadhaarNo, address, quota, admissionType, fatherOccupation, admissionStatus]
      );

      console.log('Stored new admission (pending):', { id, parentEmail, childName, className });

      // Send Emails
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
            from: '"St. Martins Group of Schools" <admissions@stmartinsgroup.com>',
            to: parentEmail,
            subject: 'Application Received — St. Martins Group of Schools',
            html: `
               <div style="font-family: Arial, Helvetica, sans-serif; max-width:600px;margin:auto;border-radius:12px;overflow:hidden;border:1px solid #e6e9ee;">
                  <div style="background:#0f172a;padding:28px;color:#fff;text-align:center;">
                     <h2 style="margin:0;font-size:20px;letter-spacing:1px;">Application Received</h2>
                  </div>
                  <div style="padding:24px;background:#fff;color:#0f172a;">
                     <p style="margin:0 0 12px 0;font-size:15px;">Dear ${parentName || 'Parent'},</p>
                     <p style="margin:0 0 12px 0;color:#475569;">Thank you for submitting the admission application for <strong>${childName}</strong> to <strong>${className}</strong> for the ${academicYear} session.</p>
                     <p style="margin:0 0 12px 0;color:#475569;">Our admissions committee is currently reviewing your submission. We will contact you shortly regarding document verification and the next steps in the enrollment process.</p>
                     <div style="margin-top:18px;padding:16px;background:#f8fafc;border-radius:8px;border:1px solid #eef2ff;">
                        <p style="margin:0;font-size:13px;color:#475569;">Application Reference ID: <strong>${id}</strong></p>
                     </div>
                     <p style="margin-top:16px;font-size:13px;color:#64748b;">If you have any urgent questions, please feel free to reach out to our helpdesk.</p>
                  </div>
                  <div style="padding:12px;text-align:center;background:#f8fafc;color:#94a3b8;font-size:12px;">St. Martins Group of Schools</div>
               </div>
            `
         };

         // 2. Admin Notification Email
         const adminMailOptions = {
            from: '"St. Martins Group of Schools" <system@stmartinsgroup.com>',
            to: process.env.ADMIN_EMAIL || 'admin@stmartinsgroup.com',
            subject: `New Online Admission Application: ${childName}`,
            html: `
               <div style="font-family: Arial, Helvetica, sans-serif; max-width:600px;margin:auto;border-radius:12px;overflow:hidden;border:1px solid #e6e9ee;">
                  <div style="background:#8b0000;padding:28px;color:#fff;text-align:center;">
                     <h2 style="margin:0;font-size:20px;letter-spacing:1px;">New Application Alert</h2>
                  </div>
                  <div style="padding:24px;background:#fff;color:#0f172a;">
                     <p style="margin:0 0 12px 0;font-weight:bold;">Student Details:</p>
                     <table style="width:100%;font-size:14px;border-collapse:collapse;">
                        <tr><td style="padding:8px 0;color:#64748b;width:140px;">Student Name:</td><td style="padding:8px 0;font-weight:bold;">${childName}</td></tr>
                        <tr><td style="padding:8px 0;color:#64748b;">Class Applying:</td><td style="padding:8px 0;font-weight:bold;">${className}</td></tr>
                        <tr><td style="padding:8px 0;color:#64748b;">Academic Year:</td><td style="padding:8px 0;font-weight:bold;">${academicYear}</td></tr>
                        <tr><td style="padding:8px 0;color:#64748b;">Parent Name:</td><td style="padding:8px 0;font-weight:bold;">${parentName}</td></tr>
                        <tr><td style="padding:8px 0;color:#64748b;">Parent Phone:</td><td style="padding:8px 0;font-weight:bold;">${parentMobile}</td></tr>
                        <tr><td style="padding:8px 0;color:#64748b;">Parent Email:</td><td style="padding:8px 0;font-weight:bold;">${parentEmail}</td></tr>
                     </table>
                     <div style="margin-top:20px;text-align:center;">
                        <a href="${process.env.ADMIN_PORTAL_URL || 'http://localhost:5173/admin/dashboard'}" style="background:#8b0000;color:#fff;padding:12px 24px;text-decoration:none;border-radius:8px;font-weight:bold;font-size:14px;">Review Application</a>
                     </div>
                  </div>
                  <div style="padding:12px;text-align:center;background:#f8fafc;color:#94a3b8;font-size:12px;">St. Martins Group of Schools — Internal Notification</div>
               </div>
            `
         };

         await Promise.all([
            transport.sendMail(parentMailOptions),
            transport.sendMail(adminMailOptions)
         ]);

         console.log('Admission notifications sent successfully');
      } catch (mailErr) {
         console.error('Admission notification emails failed:', mailErr);
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
      const admissionNo = `STM-${yearPrefix}-${randomDigits}`;

      const childName = `${app.first_name || ''} ${app.last_name || ''}`.trim();
      const parentName = app.father_name || app.mother_name || 'Parent';

      let rawPassword = '';

      rawPassword = (Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 6)).substring(0, 12);
      const hashed = bcrypt.hashSync(rawPassword, 10);
      const portalUser = await createOrReuseStudentPortalUser({
         parentEmail: app.parent_email,
         childName,
         parentName,
         parentPhone: app.parent_mobile,
         admissionNo,
         passwordHash: hashed,
      });
      const userId = portalUser.userId;

      // Create student record
      const studentId = uuidv4();
      await pool.query(`INSERT INTO students (id, user_id, name, email, roll_no, class_name, section, parent_name, parent_phone, dob, gender, address, admission_date, total_fees, paid_fees) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?)`,
         [studentId, userId, childName, app.parent_email, admissionNo, app.class_name, app.section || 'A', parentName, app.parent_mobile, app.dob || null, app.gender || '', app.address || '', 0, 0]
      );

      // Update admission record
      await pool.query(`UPDATE admissions SET status = 'approved', admission_no = ?, student_id = ?, reviewed_at = NOW() WHERE id = ?`,
         [admissionNo, studentId, id]
      );

      // Send approval email with credentials
      const mailOptions = {
         from: '"St. Martins Group of Schools" <admissions@schoolsaas.com>',
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
                     <p style="margin:6px 0 0 0;font-size:13px;color:#0f172a;"><strong>Email Address:</strong> ${app.parent_email}</p>
                     <p style="margin:6px 0 0 0;font-size:13px;color:#0f172a;"><strong>Temporary Password:</strong> ${rawPassword}</p>
                  </div>
                  <p style="margin-top:16px;font-size:13px;color:#64748b;">You can sign in using either the parent email address or the admission number shown above from the parent portal. Please change the password after first login.</p>
                  <p style="margin-top:10px;font-size:13px;color:#64748b;"><strong>Login URL:</strong> ${process.env.FRONTEND_URL || 'http://localhost:5173'}/login</p>
                  ${portalUser.sharedEmailConflict ? '<p style="margin-top:10px;font-size:13px;color:#92400e;background:#fffbeb;border:1px solid #fde68a;padding:10px;border-radius:8px;"><strong>Note:</strong> This contact email is also used in another portal. For parent access, choose the Parent portal and use this email or the admission number.</p>' : ''}
               </div>
               <div style="padding:12px;text-align:center;background:#f8fafc;color:#94a3b8;font-size:12px;">St. Martins Group of Schools</div>
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

      return res.status(200).json({ 
         success: true, 
         message: 'Application approved and credentials emailed.',
         data: {
            email: app.parent_email,
            tempPassword: rawPassword !== '(Use existing portal password)' ? rawPassword : '(existing password)',
            admissionNo: admissionNo,
            sharedEmailConflict: portalUser.sharedEmailConflict,
         }
      });
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
         admissionNo = `STM-${yearPrefix}-${randomDigits}`;
      }

      let rawPassword = '';
      rawPassword = (Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 6)).substring(0, 12);
      const hashed = bcrypt.hashSync(rawPassword, 10);
      const portalUser = await createOrReuseStudentPortalUser({
         parentEmail,
         childName,
         parentName,
         parentPhone: parentMobile,
         admissionNo,
         passwordHash: hashed,
      });
      const userId = portalUser.userId;

      // Create student record (directly approved)
      const studentId = uuidv4();
      await pool.query(`INSERT INTO students (id, user_id, name, email, roll_no, class_name, section, parent_name, parent_phone, dob, gender, address, admission_date, total_fees, paid_fees) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?)`,
         [studentId, userId, childName, parentEmail, admissionNo, className, section || 'A', parentName, parentMobile, dob || null, gender || '', '', 0, 0]
      );

      // Create admission record as 'approved' directly
      await pool.query(`INSERT INTO admissions (id, academic_year, first_name, last_name, dob, gender, father_name, mother_name, parent_mobile, parent_email, class_name, section, student_id, status, admission_no, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
         [uuidv4(), academicYear, firstName, lastName, dob || null, gender, fatherName, motherName, parentMobile, parentEmail, className, section || 'A', studentId, 'approved', admissionNo]
      );

      // Auto-login parent: create parent user with student role if not exists
      
      // Send confirmation email
      const mailOptions = {
         from: '"St. Martins Group of Schools" <admissions@schoolsaas.com>',
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
                     <p style="margin:6px 0 0 0;font-size:13px;color:#0f172a;"><strong>Email Address:</strong> ${parentEmail}</p>
                     <p style="margin:6px 0 0 0;font-size:13px;color:#0f172a;"><strong>Temporary Password:</strong> ${rawPassword}</p>
                  </div>
                  <p style="margin-top:16px;font-size:13px;color:#64748b;">Use either the email address or admission number to login to the parent portal.</p>
                  <p style="margin-top:10px;font-size:13px;color:#64748b;"><strong>Login URL:</strong> ${process.env.FRONTEND_URL || 'http://localhost:5173'}/login</p>
                  ${portalUser.sharedEmailConflict ? '<p style="margin-top:10px;font-size:13px;color:#92400e;background:#fffbeb;border:1px solid #fde68a;padding:10px;border-radius:8px;"><strong>Note:</strong> This contact email is also used in another portal. For parent access, choose the Parent portal and use this email or the admission number.</p>' : ''}
               </div>
               <div style="padding:12px;text-align:center;background:#f8fafc;color:#94a3b8;font-size:12px;">St. Martins Group of Schools</div>
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

      return res.status(200).json({
         success: true,
         message: 'Student added successfully',
         studentId,
         admissionNo,
         data: {
            email: parentEmail,
            tempPassword: rawPassword,
            admissionNo,
            sharedEmailConflict: portalUser.sharedEmailConflict,
         }
      });
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
         from: '"St. Martins Group of Schools" <admissions@schoolsaas.com>',
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
               <div style="padding:12px;text-align:center;background:#f8fafc;color:#94a3b8;font-size:12px;">St. Martins Group of Schools</div>
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
