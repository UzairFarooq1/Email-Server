import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import QRCode from "qrcode";

export const cleanPdfText = (value, fallback = "N/A") =>
  String(value || fallback)
    .replace(/[^\x20-\x7E]/g, "")
    .slice(0, 120);

export const drawLabelValue = (
  page,
  fonts,
  label,
  value,
  x,
  y,
  width = 210,
) => {
  page.drawText(cleanPdfText(label).toUpperCase(), {
    x,
    y,
    size: 8,
    font: fonts.bold,
    color: rgb(0.55, 0.42, 0.06),
  });
  page.drawText(cleanPdfText(value), {
    x,
    y: y - 16,
    size: 12,
    font: fonts.regular,
    color: rgb(0.08, 0.08, 0.08),
    maxWidth: width,
  });
};

export const formatEventDate = (value) => {
  if (!value) return "Date TBA";
  const date = value?.toDate ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

/** Shared ticket PDF layout used by My Tickets download and email attachments. */
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
  const qrPayload = JSON.stringify({
    full_name: full_name || "",
    phone_number: phone_number || "",
    type: type || "",
    ticketId: finalTicketId,
    gender: gender || "",
  });
  const qrCodeImage = await QRCode.toDataURL(qrPayload, {
    margin: 1,
    width: 420,
  });

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([612, 792]);
  const fonts = {
    regular: await pdfDoc.embedFont(StandardFonts.Helvetica),
    bold: await pdfDoc.embedFont(StandardFonts.HelveticaBold),
  };

  const width = page.getWidth();
  const height = page.getHeight();
  const yellow = rgb(0.96, 0.74, 0.12);
  const amber = rgb(0.98, 0.58, 0.12);
  const black = rgb(0.08, 0.08, 0.08);
  const muted = rgb(0.42, 0.42, 0.42);
  const line = rgb(0.9, 0.86, 0.76);

  page.drawRectangle({
    x: 0,
    y: 0,
    width,
    height,
    color: rgb(0.99, 0.98, 0.94),
  });
  page.drawRectangle({
    x: 40,
    y: 52,
    width: 532,
    height: 688,
    color: rgb(1, 1, 1),
    borderColor: line,
    borderWidth: 1,
  });
  page.drawRectangle({ x: 40, y: 628, width: 532, height: 112, color: black });
  page.drawRectangle({ x: 40, y: 628, width: 532, height: 10, color: yellow });

  if (logoBytes) {
    try {
      const embeddedLogo = await pdfDoc.embedPng(logoBytes);
      page.drawImage(embeddedLogo, {
        x: 462,
        y: 660,
        width: 58,
        height: 58,
      });
    } catch (logoError) {
      console.warn("Ticket logo could not be embedded:", logoError.message);
    }
  }

  page.drawText("HALAL EVENTBRITE", {
    x: 72,
    y: 704,
    size: 11,
    font: fonts.bold,
    color: yellow,
  });
  page.drawText(cleanPdfText(ticketFor), {
    x: 72,
    y: 666,
    size: 28,
    font: fonts.bold,
    color: rgb(1, 1, 1),
    maxWidth: 380,
  });
  // page.drawText("Premium event pass", {
  //   x: 72,
  //   y: 646,
  //   size: 11,
  //   font: fonts.regular,
  //   color: rgb(0.84, 0.84, 0.84),
  // });

  page.drawRectangle({
    x: 72,
    y: 554,
    width: 172,
    height: 42,
    color: rgb(1, 0.96, 0.82),
    borderColor: yellow,
    borderWidth: 1,
  });
  page.drawText(cleanPdfText(type || "General Admission"), {
    x: 88,
    y: 570,
    size: 13,
    font: fonts.bold,
    color: black,
    maxWidth: 140,
  });
  page.drawRectangle({ x: 392, y: 554, width: 108, height: 42, color: black });
  page.drawText("KSH", {
    x: 410,
    y: 577,
    size: 9,
    font: fonts.bold,
    color: yellow,
  });
  page.drawText(cleanPdfText(amount || "0.00"), {
    x: 410,
    y: 562,
    size: 14,
    font: fonts.bold,
    color: rgb(1, 1, 1),
    maxWidth: 74,
  });

  drawLabelValue(page, fonts, "Ticket holder", full_name, 72, 510, 210);
  drawLabelValue(page, fonts, "Ticket reference", finalTicketId, 320, 510, 190);
  drawLabelValue(
    page,
    fonts,
    "Date",
    eventDate || "See event details",
    72,
    456,
    210,
  );
  drawLabelValue(
    page,
    fonts,
    "Time",
    eventTime || "See event details",
    320,
    456,
    190,
  );
  drawLabelValue(
    page,
    fonts,
    "Location",
    eventLocation || "See event details",
    72,
    402,
    438,
  );
  drawLabelValue(
    page,
    fonts,
    "Organizer",
    organizerName || "HalalEvent organizer",
    72,
    348,
    210,
  );
  drawLabelValue(
    page,
    fonts,
    "M-Pesa receipt",
    mpesaReceipt || "N/A",
    320,
    348,
    190,
  );

  page.drawLine({
    start: { x: 72, y: 306 },
    end: { x: 540, y: 306 },
    thickness: 1,
    color: line,
    dashArray: [6, 5],
  });

  const qrDims = 156;
  const qrBase64 = qrCodeImage.replace(/^data:image\/\w+;base64,/, "");
  const qrBuffer =
    typeof Buffer !== "undefined"
      ? Buffer.from(qrBase64, "base64")
      : Uint8Array.from(atob(qrBase64), (char) => char.charCodeAt(0));
  const embeddedQr = await pdfDoc.embedPng(qrBuffer);
  page.drawRectangle({
    x: 72,
    y: 112,
    width: 190,
    height: 174,
    color: rgb(0.98, 0.98, 0.98),
    borderColor: line,
    borderWidth: 1,
  });
  page.drawImage(embeddedQr, {
    x: 89,
    y: 128,
    width: qrDims,
    height: qrDims,
  });

  page.drawText("Scan this QR code at entry", {
    x: 306,
    y: 250,
    size: 18,
    font: fonts.bold,
    color: black,
  });
  page.drawText("Keep this ticket available on your phone", {
    x: 306,
    y: 222,
    size: 11,
    font: fonts.regular,
    color: muted,
  });
  page.drawText("or print it before arrival.", {
    x: 306,
    y: 206,
    size: 11,
    font: fonts.regular,
    color: muted,
  });
  page.drawRectangle({ x: 306, y: 154, width: 174, height: 36, color: yellow });
  page.drawText("VALID EVENT PASS", {
    x: 328,
    y: 167,
    size: 12,
    font: fonts.bold,
    color: black,
  });
  page.drawText(cleanPdfText(email || ""), {
    x: 306,
    y: 132,
    size: 10,
    font: fonts.regular,
    color: muted,
    maxWidth: 210,
  });
  page.drawRectangle({ x: 40, y: 52, width: 532, height: 14, color: amber });

  return pdfDoc.save();
};
