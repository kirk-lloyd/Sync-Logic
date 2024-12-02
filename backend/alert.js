export default function sendAlertEmail(error) {
  let transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,    },
  });

  let mailOptions = {
    from: 'apps@projektagency.com.au',
    to: 'kirk@projektagency.com.au',
    subject: 'Shopify App Server Alert',
    text: `The Shopify app server encountered an error: ${error}`,
  };
  transporter.sendMail(mailOptions, (err, info) => {
    if (err) {
      console.error('Error sending alert email:', err);
    } else {
      console.log('Alert email sent:', info.response);
    }
  });
}
