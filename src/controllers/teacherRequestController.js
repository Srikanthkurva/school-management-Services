const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');
const nodemailer = require('nodemailer');
const bcrypt = require('bcryptjs');

const createMailTransport = async () => {
  if (process.env.SMTP_HOST && process.env.SMTP_USER) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT || 587,
      secure: false,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    });
  }

  const testAccount = await nodemailer.createTestAccount();
  return nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    secure: false,
    auth: { user: testAccount.user, pass: testAccount.pass }
  });
};

const rollbackQuietly = async (client) => {
  try {
    await client.query('ROLLBACK');
  } catch (_error) {
    // Ignore rollback failures so the original error can be returned.
  }
};

const teacherRequestController = {
  // Submit a teacher request (Public)
  submitRequest: async (req, res) => {
    try {
      const { name, email, phone, subject, qualification, experience, message } = req.body;

      if (!name || !email || !phone) {
        return res.status(400).json({
          success: false,
          message: 'Please provide name, email, and phone number'
        });
      }

      const id = uuidv4();
      const query = `
        INSERT INTO teacher_requests (id, name, email, phone, subject, qualification, experience, message)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `;
      await db.query(query, [id, name, email, phone, subject, qualification, experience, message]);

      try {
        const transport = await createMailTransport();

        const applicantMailOptions = {
          from: '"St. Martins Group of Schools" <careers@stmartinsgroup.com>',
          to: email,
          subject: 'Application Received - St. Martins Group of Schools',
          html: `
            <div style="font-family: Arial, Helvetica, sans-serif; max-width:600px;margin:auto;border-radius:12px;overflow:hidden;border:1px solid #e6e9ee;">
              <div style="background:#0f172a;padding:28px;color:#fff;text-align:center;">
                <h2 style="margin:0;font-size:20px;letter-spacing:1px;">Application Received</h2>
              </div>
              <div style="padding:24px;background:#fff;color:#0f172a;">
                <p style="margin:0 0 12px 0;font-size:15px;">Dear ${name},</p>
                <p style="margin:0 0 12px 0;color:#475569;">Thank you for your interest in joining the faculty at <strong>St. Martins Group of Schools</strong>.</p>
                <p style="margin:0 0 12px 0;color:#475569;">We have received your application for the <strong>${subject}</strong> teaching position. Our recruitment team will review your profile and experience (${experience}) and get back to you shortly.</p>

                ${message ? `
                <div style="margin-top:16px;padding:16px;background:#f1f5f9;border-left:4px solid #0f172a;border-radius:4px;">
                  <p style="margin:0 0 8px 0;font-size:13px;font-weight:bold;color:#334155;">Your Message / Cover Letter:</p>
                  <p style="margin:0;font-size:14px;color:#475569;white-space:pre-wrap;">${message}</p>
                </div>
                ` : ''}

                <div style="margin-top:18px;padding:16px;background:#f8fafc;border-radius:8px;border:1px solid #eef2ff;">
                  <p style="margin:0;font-size:13px;color:#475569;">Reference ID: <strong>${id}</strong></p>
                </div>
                <p style="margin-top:16px;font-size:13px;color:#64748b;">Best regards,<br/>The Recruitment Team</p>
              </div>
              <div style="padding:12px;text-align:center;background:#f8fafc;color:#94a3b8;font-size:12px;">St. Martins Group of Schools</div>
            </div>
          `
        };

        const adminMailOptions = {
          from: '"St. Martins Group of Schools" <system@stmartinsgroup.com>',
          to: process.env.ADMIN_EMAIL || 'admin@stmartinsgroup.com',
          subject: `New Teacher Application: ${name} (${subject})`,
          html: `
            <div style="font-family: Arial, Helvetica, sans-serif; max-width:600px;margin:auto;border-radius:12px;overflow:hidden;border:1px solid #e6e9ee;">
              <div style="background:#8b0000;padding:28px;color:#fff;text-align:center;">
                <h2 style="margin:0;font-size:20px;letter-spacing:1px;">New Faculty Application</h2>
              </div>
              <div style="padding:24px;background:#fff;color:#0f172a;">
                <p style="margin:0 0 12px 0;font-weight:bold;">Applicant Details:</p>
                <table style="width:100%;font-size:14px;border-collapse:collapse;">
                  <tr><td style="padding:8px 0;color:#64748b;width:140px;">Name:</td><td style="padding:8px 0;font-weight:bold;">${name}</td></tr>
                  <tr><td style="padding:8px 0;color:#64748b;">Subject:</td><td style="padding:8px 0;font-weight:bold;">${subject}</td></tr>
                  <tr><td style="padding:8px 0;color:#64748b;">Qualification:</td><td style="padding:8px 0;font-weight:bold;">${qualification}</td></tr>
                  <tr><td style="padding:8px 0;color:#64748b;">Experience:</td><td style="padding:8px 0;font-weight:bold;">${experience}</td></tr>
                  <tr><td style="padding:8px 0;color:#64748b;">Contact:</td><td style="padding:8px 0;font-weight:bold;">${phone} / ${email}</td></tr>
                </table>

                ${message ? `
                <div style="margin-top:20px;padding-top:16px;border-top:1px solid #e2e8f0;">
                  <p style="margin:0 0 8px 0;font-weight:bold;color:#0f172a;">Message / Cover Letter:</p>
                  <div style="background:#f8fafc;padding:16px;border-radius:8px;border:1px solid #e2e8f0;">
                    <p style="margin:0;font-size:14px;color:#475569;white-space:pre-wrap;">${message}</p>
                  </div>
                </div>
                ` : ''}
              </div>
            </div>
          `
        };

        await Promise.all([
          transport.sendMail(applicantMailOptions),
          transport.sendMail(adminMailOptions)
        ]);
      } catch (mailErr) {
        console.error('Failed to send teacher application emails:', mailErr);
      }

      res.status(200).json({
        success: true,
        message: 'Your application has been submitted successfully. Our team will review it and get back to you.'
      });
    } catch (error) {
      console.error('Teacher Request Submission Error:', error);
      res.status(500).json({ success: false, message: 'Server Error' });
    }
  },

  // Get all teacher requests (Admin)
  getAllRequests: async (req, res) => {
    try {
      const [rows] = await db.query('SELECT * FROM teacher_requests ORDER BY created_at DESC');
      res.json({ success: true, data: rows });
    } catch (error) {
      console.error('Get Teacher Requests Error:', error);
      res.status(500).json({ success: false, message: 'Server Error' });
    }
  },

  // Approve teacher request (Admin)
  approveRequest: async (req, res) => {
    const client = await db.originalPool.connect();
    let request = null;
    let rawPassword = null;
    let responseMessage = 'Teacher request approved.';

    try {
      const { id } = req.params;
      await client.query('BEGIN');

      const requestResult = await client.query(
        'SELECT * FROM teacher_requests WHERE id = $1 FOR UPDATE',
        [id]
      );

      if (requestResult.rows.length === 0) {
        await rollbackQuietly(client);
        return res.status(404).json({ success: false, message: 'Request not found' });
      }

      request = requestResult.rows[0];

      const existingUserResult = await client.query(
        'SELECT id, email, role FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1',
        [request.email]
      );
      const existingTeacherResult = await client.query(
        'SELECT id, user_id, email FROM teachers WHERE LOWER(email) = LOWER($1) LIMIT 1',
        [request.email]
      );

      const existingUser = existingUserResult.rows[0] || null;
      const existingTeacher = existingTeacherResult.rows[0] || null;

      if (existingUser && existingUser.role !== 'teacher') {
        await rollbackQuietly(client);
        return res.status(409).json({
          success: false,
          message: `This email is already linked to a ${existingUser.role} account. Use a different email for the teacher profile.`
        });
      }

      let userId = existingUser?.id || null;
      let employeeId = existingUser?.employee_id || `EMP-${Math.floor(1000 + Math.random() * 9000)}`;

      if (!userId) {
        userId = uuidv4();
        // Generate a more secure random password (12 characters)
        rawPassword = (Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 6)).substring(0, 12);
        const hashedPassword = bcrypt.hashSync(rawPassword, 10);

        await client.query(
          'INSERT INTO users (id, name, email, password, role, phone, employee_id, is_active) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
          [userId, request.name, request.email, hashedPassword, 'teacher', request.phone, employeeId, true]
        );

        responseMessage = 'Teacher request approved! User account created and teacher added.';
      } else {
        // Update existing user with employee_id if they don't have one
        await client.query(
          'UPDATE users SET employee_id = COALESCE(employee_id, $1) WHERE id = $2',
          [employeeId, userId]
        );
      }

      if (!existingTeacher) {
        const teacherId = uuidv4();
        await client.query(
          'INSERT INTO teachers (id, user_id, name, email, subject, phone, qualification, experience, join_date) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_DATE)',
          [teacherId, userId, request.name, request.email, request.subject, request.phone, request.qualification, request.experience]
        );

        if (!rawPassword) {
          responseMessage = 'Teacher request approved. Existing teacher login was linked to a new teacher profile.';
        }
      } else {
        responseMessage = request.status === 'approved'
          ? 'Teacher request was already approved.'
          : 'Teacher request approved. An existing teacher account is already using this email, so the application status was updated without creating duplicates.';
      }

      await client.query('UPDATE teacher_requests SET status = $1 WHERE id = $2', ['approved', id]);
      await client.query('COMMIT');

      if (rawPassword) {
        try {
          const transport = await createMailTransport();

          const credentialsMailOptions = {
            from: '"St. Martins Group of Schools" <admin@stmartinsgroup.com>',
            to: request.email,
            subject: 'Congratulations! Your Faculty Account is Ready',
            html: `
              <div style="font-family: Arial, Helvetica, sans-serif; max-width:600px;margin:auto;border-radius:12px;overflow:hidden;border:1px solid #e6e9ee;">
                <div style="background:#0f172a;padding:28px;color:#fff;text-align:center;">
                  <h2 style="margin:0;font-size:20px;letter-spacing:1px;">Welcome to St. Martins!</h2>
                </div>
                <div style="padding:24px;background:#fff;color:#0f172a;">
                  <p style="margin:0 0 12px 0;font-size:15px;">Dear ${request.name},</p>
                  <p style="margin:0 0 12px 0;color:#475569;">We are thrilled to inform you that your application for the <strong>${request.subject}</strong> teaching position has been approved.</p>
                  <p style="margin:0 0 12px 0;color:#475569;">Your faculty portal account has been created. You can use either your email address or employee ID together with the temporary password below:</p>

                  <div style="margin-top:18px;padding:16px;background:#f8fafc;border-radius:8px;border:1px solid #eef2ff;">
                    <p style="margin:0 0 8px 0;font-size:13px;color:#475569;">Platform Login URL: <strong>${process.env.FRONTEND_URL || 'http://localhost:5173'}/login</strong></p>
                    <p style="margin:0 0 8px 0;font-size:13px;color:#475569;">Email Address: <strong>${request.email}</strong></p>
                    <p style="margin:0 0 8px 0;font-size:13px;color:#475569;">Employee ID: <strong>${employeeId}</strong></p>
                    <p style="margin:0;font-size:13px;color:#475569;">Temporary Password: <strong>${rawPassword}</strong></p>
                  </div>

                  <p style="margin-top:16px;font-size:13px;color:#ef4444;font-weight:bold;">* Please log in and change your password immediately.</p>
                </div>
              </div>
            `
          };

          await transport.sendMail(credentialsMailOptions);
        } catch (mailErr) {
          console.error('Failed to send teacher approval credentials email:', mailErr);
        }
      }

      return res.json({
        success: true,
        message: responseMessage,
        data: { email: request.email, employeeId: employeeId, tempPassword: rawPassword }
      });
    } catch (error) {
      await rollbackQuietly(client);
      console.error('Approve Teacher Request Error:', error);

      if (error.code === '23505') {
        return res.status(409).json({
          success: false,
          message: 'A user or teacher record with this email already exists. Refresh the list and review the current status.'
        });
      }

      return res.status(500).json({ success: false, message: 'Server Error' });
    } finally {
      client.release();
    }
  },

  // Reject teacher request (Admin)
  rejectRequest: async (req, res) => {
    try {
      const { id } = req.params;
      const [rows] = await db.query('SELECT id, status FROM teacher_requests WHERE id = ?', [id]);

      if (rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Request not found' });
      }

      if (rows[0].status === 'rejected') {
        return res.json({ success: true, message: 'Teacher request was already rejected' });
      }

      await db.query('UPDATE teacher_requests SET status = ? WHERE id = ?', ['rejected', id]);
      return res.json({ success: true, message: 'Teacher request rejected' });
    } catch (error) {
      console.error('Reject Teacher Request Error:', error);
      return res.status(500).json({ success: false, message: 'Server Error' });
    }
  }
};

module.exports = teacherRequestController;
