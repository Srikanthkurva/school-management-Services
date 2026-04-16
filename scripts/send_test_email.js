require('dotenv').config();
const nodemailer = require('nodemailer');

(async () => {
  try {
    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, ADMIN_EMAIL } = process.env;

    let transport;
    if (SMTP_HOST && SMTP_USER) {
      transport = nodemailer.createTransport({
        host: SMTP_HOST,
        port: Number(SMTP_PORT) || 587,
        secure: false,
        auth: { user: SMTP_USER, pass: SMTP_PASS }
      });
      console.log('Using configured SMTP server:', SMTP_HOST);
    } else {
      console.log('No SMTP configured — creating Ethereal test account (dev)');
      const testAccount = await nodemailer.createTestAccount();
      transport = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: { user: testAccount.user, pass: testAccount.pass }
      });
      console.log('Ethereal account:', testAccount.user);
    }

    const to = ADMIN_EMAIL || SMTP_USER || 'test@example.com';
    const info = await transport.sendMail({
      from: '"SchoolSaaS" <no-reply@schoolsaas.com>',
      to,
      subject: 'Test email from School-website',
      text: 'This is a test email to verify SMTP configuration.',
      html: '<p>This is a <strong>test</strong> email to verify SMTP configuration.</p>'
    });

    console.log('Message sent:', info.messageId);
    const preview = nodemailer.getTestMessageUrl(info);
    if (preview) console.log('Preview URL (Ethereal):', preview);
    process.exit(0);
  } catch (err) {
    console.error('Failed to send test email:', err);
    process.exit(1);
  }
})();
