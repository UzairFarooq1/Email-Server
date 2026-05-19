const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");
const { v4: uuidv4 } = require("uuid");

const ticketPdfModuleUrl = pathToFileURL(
  path.join(__dirname, "ticketPdf.mjs"),
).href;

let ticketPdfModulePromise;
const loadTicketPdfModule = () => {
  if (!ticketPdfModulePromise) {
    ticketPdfModulePromise = import(ticketPdfModuleUrl);
  }
  return ticketPdfModulePromise;
};

const loadLogoBytes = () => {
  const logoPathCandidates = [
    path.join(__dirname, "..", "heblogo.png"),
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

module.exports = {
  generateTicketPdf,
};
