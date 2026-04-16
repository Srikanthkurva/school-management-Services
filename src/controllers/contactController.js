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

      // Mocking saving to DB or sending email
      console.log('Contact Form Submission:', { name, email, subject, phone, message, timestamp: new Date() });

      res.status(200).json({
        success: true,
        message: 'Your message has been sent successfully. We will get back to you soon!'
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
