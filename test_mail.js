
require('dotenv').config();
const nodemailer = require('nodemailer');
const transport = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT || 587,
  secure: false,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
});

const applicantMailOptions = {
   from: '"St. Martins Group of Schools" <careers@stmartinsgroup.com>',
   to: 'srikanthfreelancer2170@gmail.com',
   subject: 'Application Received — St. Martins Group of Schools',
   html: '<p>Test</p>'
};

transport.sendMail(applicantMailOptions, (err, info) => {
   if (err) console.error('Error sending mail:', err);
   else console.log('Mail sent:', info.response);
});

