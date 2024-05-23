// Require necessary modules
require('dotenv').config();
const express = require('express');
const multer = require('multer');
const nodemailer = require('nodemailer');
const { PDFDocument } = require('pdf-lib');
const QRCode = require('qrcode');
const uuid = require('uuid'); // Import uuid for generating unique IDs
const fs = require('fs'); // Import fs for file system operations
const cors = require('cors');

// Create an Express app
const app = express();

// Use the cors middleware
app.use(cors());

// Parse incoming JSON request bodies
app.use(express.json());

// Set up Multer for handling file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Create Nodemailer transporter
const transporter = nodemailer.createTransport({
  service: 'Gmail',
  auth: {
    user: process.env.EMAIL_ADDRESS,
    pass: process.env.EMAIL_PASSWORD
  }
});

// Define route for sending emails with attachments
app.post('/send-email', upload.none(), async (req, res) => {
  try {
    // Extract data from request body
    const { email, phone_number, type, full_name, gender, mpesaReceipt, amount, eventDesc } = req.body;
    const ticketFor = 'Reviving hearts'; // Ticket for always equals to 'Reviving hearts'

    // Generate unique ID for the ticket
    const ticketId = uuid.v4();

    // Generate QR code from ticket data and ID
    const qrCodeData = JSON.stringify({ full_name, phone_number, type, ticketId, gender,mpesaReceipt, amount, eventDesc });
    const qrCodeImage = await QRCode.toDataURL(qrCodeData);

    // Generate PDF attachment
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage();
    
    // Add PNG logo on the top left
    const logoImageBytes = fs.readFileSync('../server/heblogo.png');
    const logoImage = await pdfDoc.embedPng(logoImageBytes);
    const logoDims = 100;
    page.drawImage(logoImage, {
      x: page.getWidth() * 0.2, // Moved left by 20%
      y: page.getHeight() * 0.7, // Moved up by 70%
      width: logoDims,
      height: logoDims,
    });
    // Add ticket details
    const textX = page.getWidth() * 0.2; // Moved left by 20%
    let textY = page.getHeight() * 0.5; // Moved down by 50%

    // Add ticket details
    page.drawText(`Name: ${full_name}`, { x: textX, y: textY + 100, size: 18, align: 'center' });
    page.drawText(`Ticket Type: ${type}`, { x: textX, y: textY + 70, size: 14, align: 'center' });
    page.drawText(`Amount: ${amount}`, { x: textX, y: textY + 40, size: 14, align: 'center' });
    page.drawText(`Mpesa Code: ${mpesaReceipt}`, { x: textX, y: textY + 10, size: 14, align: 'center' });
    page.drawText(`Ticket For: ${eventDesc}`, { x: textX, y: textY - 15, size: 14, align: 'center' });
    page.drawText(`Gender: ${gender}`, { x: textX+150, y: textY + 70, size: 14, align: 'center' });
    // page.drawText(`Gender: ${gender}`, { x: textX+150, y: textY + 40, size: 14, align: 'center' });



    // Add QR code in the center
    const qrDims = 200;
    const qrX = (page.getWidth() - qrDims) / 2;
    const qrY = textY - 220; // Pushed up by 120 units
    const qrCodeImageBuffer = Buffer.from(qrCodeImage.replace(/^data:image\/\w+;base64,/, ""), 'base64');
    page.drawImage(await pdfDoc.embedPng(qrCodeImageBuffer), { x: qrX, y: qrY, width: qrDims, height: qrDims });

    // Add ticket ID underneath the QR code
    page.drawText(`Ticket ID: ${ticketId}`, { x: qrX, y: qrY - 20, size: 12 });

    // Generate PDF bytes
    const pdfBytes = await pdfDoc.save();

    // Create email options
    const mailOptions = {
      from: process.env.EMAIL_ADDRESS,
      to: email,
      subject: 'Your Ticket Confirmation',
      text: `Dear ${full_name},\n\nThank you for your purchase. Your ticket for "${ticketFor}" has been confirmed.\n\nBest regards,\nHalal EventBrite Team`,
      attachments: [
        {
          filename: 'ticket_confirmation.pdf',
          content: pdfBytes,
          encoding: 'base64'
        }
      ]
    };

    // Send email
    await transporter.sendMail(mailOptions);

    // Send a success response
    res.status(200).send('Email sent successfully');
  } catch (error) {
    console.error(error);
    res.status(500).send('Error sending email');
  }
});

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// Export the app instance
module.exports = app;
