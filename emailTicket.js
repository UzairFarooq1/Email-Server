require("dotenv").config();
const express = require("express");
const multer = require("multer");
const nodemailer = require("nodemailer");
const { v4: uuidv4 } = require("uuid");
const fs = require("fs");
const path = require("path");
const cors = require("cors");
const { pathToFileURL } = require("url");

const ticketPdfModuleUrl = pathToFileURL(
  path.join(__dirname, "lib", "ticketPdf.mjs"),
).href;

let ticketPdfModulePromise;
const loadTicketPdfModule = () => {
  if (!ticketPdfModulePromise) {
    ticketPdfModulePromise = import(ticketPdfModuleUrl);
  }
  return ticketPdfModulePromise;
};

const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

app.get("/smtp-debug", (req, res) => {
  res.json({
    EMAIL_ADDRESS: process.env.EMAIL_ADDRESS,
    SMTP_HOST: process.env.SMTP_HOST,
    SMTP_PORT: process.env.SMTP_PORT,
    SMTP_SECURE: process.env.SMTP_SECURE,
  });
});

app.get("/", (req, res) => {
  res.json({
    status: "OK",
    service: "Ticket API",
  });
});

app.get("/health", (req, res) => {
  res.send("healthy");
});

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});
const getEmailCredentials = () => {
  const user = process.env.EMAIL_ADDRESS?.trim();
  const pass = process.env.EMAIL_PASSWORD?.trim();
  return user && pass ? { user, pass } : null;
};
console.log({
  SMTP_HOST: process.env.SMTP_HOST,
  SMTP_PORT: process.env.SMTP_PORT,
  SMTP_SECURE: process.env.SMTP_SECURE,
});

const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.EMAIL_ADDRESS,
      pass: process.env.EMAIL_PASSWORD,
    },
  });
};
// const createTransporter = () => {
//   const credentials = getEmailCredentials();
//   if (!credentials) {
//     return null;
//   }

//   return nodemailer.createTransport({
//     service: "Gmail",
//     auth: credentials,
//   });
// };

const loadLogoBytes = () => {
  const logoPathCandidates = [
    path.join(__dirname, "heblogo.png"),
    path.join(process.cwd(), "heblogo.png"),
  ];
  const logoPath = logoPathCandidates.find((candidate) =>
    fs.existsSync(candidate),
  );
  return logoPath ? fs.readFileSync(logoPath) : null;
};

const generateTicketPdf = async (ticketData) => {
  const { generateTicketPdfBytes } = await loadTicketPdfModule();
  const ticketFor = ticketData.eventDesc || "Event";
  const finalTicketId = ticketData.ticketId || uuidv4();
  const pdfBytes = await generateTicketPdfBytes({
    ticketFor,
    finalTicketId,
    full_name: ticketData.full_name,
    phone_number: ticketData.phone_number,
    type: ticketData.type,
    gender: ticketData.gender,
    email: ticketData.email,
    amount: ticketData.amount,
    mpesaReceipt: ticketData.mpesaReceipt,
    eventDate: ticketData.eventDate,
    eventTime: ticketData.eventTime,
    eventLocation: ticketData.eventLocation,
    organizerName: ticketData.organizerName,
    logoBytes: loadLogoBytes(),
  });

  return {
    pdfBytes,
    ticketFor,
    finalTicketId,
  };
};

const buildConfirmationHtml = ({
  full_name,
  ticketFor,
  type,
  amount,
  mpesaReceipt,
  finalTicketId,
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
    "<p>Your ticket PDF is attached to this email.</p>",
    "<p>Best regards,<br>Halal EventBrite Team</p>",
    "</div>",
  ].join("");

app.post("/send-email", upload.none(), async (req, res) => {
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

    console.log("EMAIL DATA RECEIVED:", {
      eventDate,
      eventTime,
      eventLocation,
      organizerName,
    });

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
          "Set EMAIL_ADDRESS and EMAIL_PASSWORD (Gmail app password) in environment variables.",
      });
    }

    const { pdfBytes, ticketFor, finalTicketId } = await generateTicketPdf({
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

    const mailOptions = {
      from: `"Halal Eventbrite" <${process.env.EMAIL_ADDRESS}>`,
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
    });
  } catch (error) {
    console.error("Error sending email:", error);
    const missingCredentials = error.message?.includes(
      'Missing credentials for "PLAIN"',
    );
    res.status(missingCredentials ? 503 : 500).json({
      error: "Error sending email",
      message: missingCredentials
        ? "Set EMAIL_ADDRESS and EMAIL_PASSWORD (Gmail app password) in environment variables."
        : error.message,
      details: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
});

app.post("/ticket-pdf", async (req, res) => {
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
});

const PORT = process.env.PORT || 3007;

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

module.exports = app;
