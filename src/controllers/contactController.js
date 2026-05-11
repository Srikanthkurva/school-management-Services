const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');
const nodemailer = require('nodemailer');

const contactController = {
  submitContactForm: async (req, res) => {
    try {
      const { name, email, subject, phone, message } = req.body;

      if (!name || !email || !message) {
        return res.status(400).json({
          success: false,
          message: 'Please provide all required fields (name, email, message)'
        });
      }

      // 1. Persist to DB
      const messageId = uuidv4();
      const insertQuery = `
        INSERT INTO contact_messages (id, name, email, phone, subject, message)
        VALUES (?, ?, ?, ?, ?, ?)
      `;
      await db.query(insertQuery, [messageId, name, email, phone || null, subject || null, message]);

      // 2. Setup Transport
      let transport;
      try {
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

        // 3. Admin Notification Email
        const adminMailOptions = {
          from: '"St. Martins Group of Schools" <info@stmartinsgroup.com>',
          to: process.env.ADMIN_EMAIL || 'admin@stmartinsgroup.com',
          subject: `New Contact Inquiry: ${subject || 'General Inquiry'}`,
          html: `
            <div style="font-family: Arial, Helvetica, sans-serif; max-width:600px;margin:auto;border-radius:12px;overflow:hidden;border:1px solid #e6e9ee;">
               <div style="background:#8b0000;padding:28px;color:#fff;text-align:center;">
                  <h2 style="margin:0;font-size:20px;letter-spacing:1px;">New Contact Inquiry</h2>
               </div>
               <div style="padding:24px;background:#fff;color:#0f172a;">
                  <p style="margin:0 0 12px 0;font-weight:bold;">Message Details:</p>
                  <table style="width:100%;font-size:14px;border-collapse:collapse;">
                     <tr><td style="padding:8px 0;color:#64748b;width:120px;">Name:</td><td style="padding:8px 0;font-weight:bold;">${name}</td></tr>
                     <tr><td style="padding:8px 0;color:#64748b;">Email:</td><td style="padding:8px 0;font-weight:bold;">${email}</td></tr>
                     <tr><td style="padding:8px 0;color:#64748b;">Phone:</td><td style="padding:8px 0;font-weight:bold;">${phone || 'N/A'}</td></tr>
                     <tr><td style="padding:8px 0;color:#64748b;">Subject:</td><td style="padding:8px 0;font-weight:bold;">${subject || 'General'}</td></tr>
                  </table>
                  <div style="margin-top:20px;padding:20px;background:#fdf2f2;border-radius:8px;border:1px solid #fee2e2;">
                     <p style="margin:0 0 8px 0;font-weight:bold;color:#8b0000;">Message:</p>
                     <p style="margin:0;line-height:1.6;color:#333;">${message}</p>
                  </div>
               </div>
               <div style="padding:12px;text-align:center;background:#f8fafc;color:#94a3b8;font-size:12px;">St. Martins Group of Schools — Admin Notification</div>
            </div>
          `
        };

        // 4. User Confirmation Email
        const userMailOptions = {
          from: '"St. Martins Group of Schools" <info@stmartinsgroup.com>',
          to: email,
          subject: 'We Have Received Your Inquiry — St. Martins Group of Schools',
          html: `
            <div style="font-family: Arial, Helvetica, sans-serif; max-width:600px;margin:auto;border-radius:12px;overflow:hidden;border:1px solid #e6e9ee;">
               <div style="background:#0f172a;padding:28px;color:#fff;text-align:center;">
                  <h2 style="margin:0;font-size:20px;letter-spacing:1px;">We've Received Your Message</h2>
               </div>
               <div style="padding:24px;background:#fff;color:#0f172a;">
                  <p style="margin:0 0 12px 0;">Dear ${name},</p>
                  <p style="margin:0 0 12px 0;color:#475569;">Thank you for reaching out to <strong>St. Martins Group of Schools</strong>. We have received your inquiry regarding "<strong>${subject || 'General'}</strong>".</p>
                  <p style="margin:0 0 12px 0;color:#475569;">Our dedicated team will review your message and contact you shortly.</p>
                  <div style="margin-top:18px;padding:16px;background:#f8fafc;border-radius:8px;border:1px solid #eef2ff;">
                     <p style="margin:0;font-size:13px;color:#475569;"><strong>Reference Copy of Your Message:</strong></p>
                     <p style="margin:8px 0 0 0;font-size:14px;color:#0f172a;font-style:italic;">"${message}"</p>
                  </div>
                  <p style="margin-top:16px;font-size:13px;color:#64748b;">This is an automated confirmation. Please do not reply directly to this email.</p>
               </div>
               <div style="padding:12px;text-align:center;background:#f8fafc;color:#94a3b8;font-size:12px;">St. Martins Group of Schools</div>
            </div>
          `
        };

        // Send both emails
        await Promise.all([
          transport.sendMail(adminMailOptions),
          transport.sendMail(userMailOptions)
        ]);
        
        console.log('Contact notifications sent successfully');
      } catch (mailErr) {
        console.error('Failed to send contact notification emails:', mailErr);
      }

      console.log('Contact Form Submission Saved:', { id: messageId, name, email, timestamp: new Date() });

      res.status(200).json({
        success: true,
        message: 'Your message has been sent successfully. Both you and the administrator will receive a confirmation email shortly.'
      });
    } catch (error) {
      console.error('Contact Form Error:', error);
      res.status(500).json({
        success: false,
        message: 'Something went wrong. Please try again later.'
      });
    }
  }
};

module.exports = contactController;
