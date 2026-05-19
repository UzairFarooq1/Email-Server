const nodemailer = require("nodemailer");

const parseBoolean = (value, fallback = false) => {
  if (value === undefined) {
    return fallback;
  }
  return ["1", "true", "yes"].includes(String(value).toLowerCase());
};

const getSmtpConfig = () => {
  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASSWORD?.trim();
  const port = Number(process.env.SMTP_PORT || 465);
  const secure = parseBoolean(process.env.SMTP_SECURE, port === 465);

  if (!host || !user || !pass) {
    return null;
  }

  return {
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
  };
};

const createTransporter = () => {
  const config = getSmtpConfig();
  if (!config) {
    return null;
  }
  return nodemailer.createTransport(config);
};

const getFromAddress = () =>
  process.env.SMTP_FROM?.trim() ||
  process.env.SMTP_USER?.trim() ||
  "tickets@halaleventbrite.co.ke";

module.exports = {
  createTransporter,
  getFromAddress,
};
