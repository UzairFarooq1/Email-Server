import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import QRCode from "qrcode";

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN = 40;

const drawWrappedText = (page, text, x, y, maxWidth, size, font, color) => {
  const words = String(text || "N/A").split(/\s+/);
  let line = "";
  let cursorY = y;

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    const width = font.widthOfTextAtSize(candidate, size);
    if (width > maxWidth && line) {
      page.drawText(line, { x, y: cursorY, size, font, color });
      cursorY -= size + 4;
      line = word;
    } else {
      line = candidate;
    }
  }

  if (line) {
    page.drawText(line, { x, y: cursorY, size, font, color });
    cursorY -= size + 4;
  }

  return cursorY;
};

export const generateTicketPdfBytes = async ({
  ticketFor,
  finalTicketId,
  full_name,
  phone_number,
  type,
  gender,
  email,
  amount,
  mpesaReceipt,
  eventDate,
  eventTime,
  eventLocation,
  organizerName,
  logoBytes,
}) => {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const primary = rgb(0.1, 0.35, 0.2);
  const muted = rgb(0.35, 0.35, 0.35);
  const panel = rgb(0.95, 0.97, 0.95);

  let y = PAGE_HEIGHT - MARGIN;

  if (logoBytes) {
    try {
      const logoImage = await pdfDoc.embedPng(logoBytes);
      const logoSize = 72;
      page.drawImage(logoImage, {
        x: MARGIN,
        y: y - logoSize,
        width: logoSize,
        height: logoSize,
      });
    } catch {
      // Ignore invalid logo bytes and continue without a logo.
    }
  }

  page.drawText("EVENT TICKET", {
    x: PAGE_WIDTH - MARGIN - fontBold.widthOfTextAtSize("EVENT TICKET", 18),
    y: y - 24,
    size: 18,
    font: fontBold,
    color: primary,
  });

  y -= 90;

  page.drawRectangle({
    x: MARGIN,
    y: y - 110,
    width: PAGE_WIDTH - MARGIN * 2,
    height: 110,
    color: panel,
    borderColor: primary,
    borderWidth: 1,
  });

  page.drawText(String(ticketFor || "Event"), {
    x: MARGIN + 16,
    y: y - 28,
    size: 20,
    font: fontBold,
    color: primary,
  });

  const eventMeta = [
    eventDate ? `Date: ${eventDate}` : null,
    eventTime ? `Time: ${eventTime}` : null,
    eventLocation ? `Location: ${eventLocation}` : null,
    organizerName ? `Organizer: ${organizerName}` : null,
  ].filter(Boolean);

  let metaY = y - 52;
  for (const line of eventMeta) {
    page.drawText(line, {
      x: MARGIN + 16,
      y: metaY,
      size: 11,
      font,
      color: muted,
    });
    metaY -= 16;
  }

  y -= 140;

  page.drawText("Attendee", {
    x: MARGIN,
    y,
    size: 13,
    font: fontBold,
    color: primary,
  });
  y -= 22;

  const attendeeLines = [
    `Name: ${full_name || "N/A"}`,
    `Email: ${email || "N/A"}`,
    `Phone: ${phone_number || "N/A"}`,
    `Gender: ${gender || "N/A"}`,
    `Ticket Type: ${type || "N/A"}`,
    `Amount: Ksh ${amount ?? "0.00"}`,
    `Mpesa Receipt: ${mpesaReceipt || "N/A"}`,
  ];

  for (const line of attendeeLines) {
    page.drawText(line, { x: MARGIN, y, size: 12, font, color: muted });
    y -= 18;
  }

  const qrPayload = JSON.stringify({
    ticketId: finalTicketId,
    full_name,
    phone_number,
    type,
    gender,
    email,
    amount,
    mpesaReceipt,
    eventDesc: ticketFor,
    eventDate,
    eventTime,
    eventLocation,
  });

  const qrDataUrl = await QRCode.toDataURL(qrPayload, {
    margin: 1,
    width: 280,
  });
  const qrImageBytes = Buffer.from(
    qrDataUrl.replace(/^data:image\/\w+;base64,/, ""),
    "base64",
  );
  const qrImage = await pdfDoc.embedPng(qrImageBytes);
  const qrSize = 180;
  const qrX = (PAGE_WIDTH - qrSize) / 2;

  page.drawImage(qrImage, {
    x: qrX,
    y: y - qrSize - 10,
    width: qrSize,
    height: qrSize,
  });

  y -= qrSize + 28;

  const ticketIdText = `Ticket ID: ${finalTicketId}`;
  page.drawText(ticketIdText, {
    x: (PAGE_WIDTH - fontBold.widthOfTextAtSize(ticketIdText, 12)) / 2,
    y,
    size: 12,
    font: fontBold,
    color: primary,
  });

  y -= 24;
  drawWrappedText(
    page,
    "Present this ticket (printed or on your phone) at the venue entrance.",
    MARGIN,
    y,
    PAGE_WIDTH - MARGIN * 2,
    10,
    font,
    muted,
  );

  return pdfDoc.save();
};
