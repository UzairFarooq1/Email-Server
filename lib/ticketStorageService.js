const { getFirebaseServices } = require("./firebaseAdmin");

const requireTicketStorage = () =>
  String(process.env.REQUIRE_TICKET_STORAGE || "").toLowerCase() === "true";

const getTicketLinkExpiry = () => {
  const days = Number(process.env.TICKET_LINK_EXPIRES_DAYS || 14);
  return Date.now() + Math.max(days, 1) * 24 * 60 * 60 * 1000;
};

const assertFirebaseConfigured = () => {
  const services = getFirebaseServices();
  if (!services && requireTicketStorage()) {
    throw new Error(
      "Ticket storage is required. Set FIREBASE_STORAGE_BUCKET and Firebase credentials.",
    );
  }
  return services;
};

const saveTicket = async ({ ticketId, ticketFor, ticketData, pdfBytes }) => {
  const services = assertFirebaseConfigured();
  if (!services) {
    return {
      storagePath: null,
      downloadUrl: null,
      persisted: false,
    };
  }

  const storagePath = `tickets/${ticketId}.pdf`;
  const file = services.bucket.file(storagePath);
  await file.save(Buffer.from(pdfBytes), {
    contentType: "application/pdf",
    resumable: false,
    metadata: {
      cacheControl: "private, max-age=0, no-transform",
    },
  });

  let downloadUrl = null;
  try {
    [downloadUrl] = await file.getSignedUrl({
      action: "read",
      expires: getTicketLinkExpiry(),
    });
  } catch (error) {
    console.warn("Ticket PDF saved, but signed URL generation failed:", error);
  }

  await services.firestore.collection("tickets").doc(ticketId).set(
    {
      ticketId,
      ticketFor,
      email: ticketData.email || null,
      full_name: ticketData.full_name || null,
      phone_number: ticketData.phone_number || null,
      type: ticketData.type || null,
      gender: ticketData.gender || null,
      amount: ticketData.amount || null,
      mpesaReceipt: ticketData.mpesaReceipt || null,
      eventDate: ticketData.eventDate || null,
      eventTime: ticketData.eventTime || null,
      eventLocation: ticketData.eventLocation || null,
      organizerName: ticketData.organizerName || null,
      storagePath,
      downloadUrl,
      createdAt: new Date().toISOString(),
    },
    { merge: true },
  );

  return {
    storagePath,
    downloadUrl,
    persisted: true,
  };
};

module.exports = {
  saveTicket,
};
