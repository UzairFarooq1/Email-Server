require("dotenv").config();
const express = require("express");
const multer = require("multer");
const cors = require("cors");
const { createTransporter, getFromAddress } = require("./lib/emailService");
const { generateTicketPdf } = require("./lib/ticketPdfService");
const { saveTicket } = require("./lib/ticketStorageService");
const {
  corsOptions,
  emailRateLimiter,
  requireApiKey,
  validateOrigin,
} = require("./lib/security");

const app = express();

app.set("trust proxy", 1);
app.use(cors(corsOptions));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});

const buildConfirmationHtml = ({
  full_name,
  ticketFor,
  type,
  amount,
  mpesaReceipt,
  finalTicketId,
  downloadUrl,
}) =>
  [
    '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">',
    "<h2>Ticket Confirmation</h2>",
    `<p>Dear ${full_name},</p>`,
    `<p>Thank you for your purchase. Your ticket for <strong>${ticketFor}</strong> has been confirmed.</p>`,
    '<div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">',
    "<h3>Ticket Details:</h3>",
    `<p><strong>Ticket Type:</strong> ${type || "N/A"}</p>`,
    `<p><strong>Amount:</strong> Ksh ${amount || "0.00"}</p>`,
    `<p><strong>Mpesa Receipt:</strong> ${mpesaReceipt || "N/A"}</p>`,
    `<p><strong>Ticket ID:</strong> ${finalTicketId}</p>`,
    "</div>",
    downloadUrl
      ? `<p>Your ticket PDF is attached. You can also download it here: <a href="${downloadUrl}">Download ticket</a></p>`
      : "<p>Your ticket PDF is attached to this email.</p>",
    "<p>Best regards,<br>Halal EventBrite Team</p>",
    "</div>",
  ].join("");

app.post(
  "/send-email",
  emailRateLimiter,
  validateOrigin,
  requireApiKey,
  upload.none(),
  async (req, res) => {
    try {
      const {
        email,
        phone_number,
        type,
        full_name,
        gender,
        amount,
        eventDesc,
        ticketId,
        mpesaReceipt,
        eventDate,
        eventTime,
        eventLocation,
        organizerName,
      } = req.body;

      if (!email || !full_name) {
        return res.status(400).json({
          error: "Missing required fields: email and full_name are required",
        });
      }

      const transporter = createTransporter();
      if (!transporter) {
        return res.status(503).json({
          error: "Email service not configured",
          message:
            "Set SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, and SMTP_PASSWORD in environment variables.",
        });
      }

      const ticketData = {
        email,
        phone_number,
        type,
        full_name,
        gender,
        amount,
        eventDesc,
        ticketId,
        mpesaReceipt,
        eventDate,
        eventTime,
        eventLocation,
        organizerName,
      };

      const { pdfBytes, ticketFor, finalTicketId } =
        await generateTicketPdf(ticketData);

      const savedTicket = await saveTicket({
        ticketId: finalTicketId,
        ticketFor,
        ticketData,
        pdfBytes,
      });

      const mailOptions = {
        from: getFromAddress(),
        to: email,
        subject: `Your Ticket Confirmation - ${ticketFor}`,
        text: `Dear ${full_name},\n\nThank you for your purchase. Your ticket for "${ticketFor}" has been confirmed.\n\nTicket Details:\n- Ticket Type: ${
          type || "N/A"
        }\n- Amount: Ksh ${amount || "0.00"}\n- Mpesa Receipt: ${
          mpesaReceipt || "N/A"
        }\n- Ticket ID: ${finalTicketId}\n\nBest regards,\nHalal EventBrite Team`,
        html: buildConfirmationHtml({
          full_name,
          ticketFor,
          type,
          amount,
          mpesaReceipt,
          finalTicketId,
          downloadUrl: savedTicket.downloadUrl,
        }),
        attachments: [
          {
            filename: "ticket_confirmation.pdf",
            content: Buffer.from(pdfBytes),
          },
        ],
      };

      await transporter.sendMail(mailOptions);

      res.status(200).json({
        success: true,
        message: "Email sent successfully",
        ticketId: finalTicketId,
        storagePath: savedTicket.storagePath,
        ticketUrl: savedTicket.downloadUrl,
      });
    } catch (error) {
      console.error("Error sending email:", error);
      const missingCredentials = error.message?.includes(
        'Missing credentials for "PLAIN"',
      );
      res.status(missingCredentials ? 503 : 500).json({
        error: "Error sending email",
        message: missingCredentials
          ? "Set SMTP_USER and SMTP_PASSWORD in environment variables."
          : error.message,
        details:
          process.env.NODE_ENV === "development" ? error.stack : undefined,
      });
    }
  },
);

app.post(
  "/ticket-pdf",
  emailRateLimiter,
  validateOrigin,
  requireApiKey,
  async (req, res) => {
  try {
    const {
      email,
      phone_number,
      type,
      full_name,
      gender,
      amount,
      eventDesc,
      ticketId,
      mpesaReceipt,
      eventDate,
      eventTime,
      eventLocation,
      organizerName,
    } = req.body;

    if (!full_name && !ticketId) {
      return res.status(400).json({
        error: "Missing required ticket data",
      });
    }

    const { pdfBytes, finalTicketId } = await generateTicketPdf({
      email,
      phone_number,
      type,
      full_name,
      gender,
      amount,
      eventDesc,
      ticketId,
      mpesaReceipt,
      eventDate,
      eventTime,
      eventLocation,
      organizerName,
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="ticket-${finalTicketId}.pdf"`,
    );
    res.status(200).send(Buffer.from(pdfBytes));
  } catch (error) {
    console.error("Error generating ticket PDF:", error);
    res.status(500).json({
      error: "Error generating ticket PDF",
      message: error.message,
    });
  }
  },
);

const PORT = process.env.PORT || 3007;

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

module.exports = app;
