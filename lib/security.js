const rateLimit = require("express-rate-limit");

const splitList = (value) =>
  (value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const allowedOrigins = splitList(process.env.ALLOWED_ORIGINS);

const corsOptions = {
  origin(origin, callback) {
    if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error("Origin not allowed"));
  },
};

const emailRateLimiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 60_000),
  max: Number(process.env.RATE_LIMIT_MAX || 50),
  standardHeaders: true,
  legacyHeaders: false,
});

const validateOrigin = (req, res, next) => {
  if (allowedOrigins.length === 0) {
    return next();
  }

  const origin = req.get("origin");
  if (!origin || allowedOrigins.includes(origin)) {
    return next();
  }

  return res.status(403).json({
    error: "Origin not allowed",
  });
};

const requireApiKey = (req, res, next) => {
  const expectedApiKey = process.env.EMAIL_API_KEY?.trim();
  if (!expectedApiKey) {
    if (process.env.NODE_ENV === "production") {
      return res.status(503).json({
        error: "Email API key not configured",
      });
    }
    return next();
  }

  const bearerToken = req.get("authorization")?.replace(/^Bearer\s+/i, "");
  const providedApiKey = req.get("x-api-key") || bearerToken;
  if (providedApiKey !== expectedApiKey) {
    return res.status(401).json({
      error: "Unauthorized",
    });
  }

  next();
};

module.exports = {
  corsOptions,
  emailRateLimiter,
  requireApiKey,
  validateOrigin,
};
