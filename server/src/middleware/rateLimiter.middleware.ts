import rateLimit from "express-rate-limit";

// Rate limiter for login attempts
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 login requests per windowMs
  message: {
    success: false,
    message: "Too many login attempts, please try again after 15 minutes",
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  skipSuccessfulRequests: false, // Count successful requests
});

// Rate limiter for OTP verification
export const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 OTP attempts per windowMs
  message: {
    success: false,
    message: "Too many OTP verification attempts, please try again later",
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
});

// Rate limiter for password reset requests
export const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Limit each IP to 3 password reset requests per hour
  message: {
    success: false,
    message: "Too many password reset requests, please try again after an hour",
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful requests
});

// General API rate limiter
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message: "Too many requests, please try again later",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Integration (MIS -> Task Mentor) reads: 30 per minute per MIS user. Keyed by
// the verified MIS user id set by misBearerAuth, so it must run after it --
// every call comes from the MIS backend's IP, so an IP key would throttle
// the whole school at once.
export const integrationLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  keyGenerator: (req) => `mis:${(req as any).misUserId ?? req.ip}`,
  message: {
    success: false,
    code: "RATE_LIMITED",
    message: "Too many requests, please try again shortly",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// "Run" / "Run tests" on code questions: each call is one or more judge
// submissions (a shared, metered resource on exam day), so 10 per minute per
// signed-in user. Keyed by user id: a whole lab shares one IP. Must run after
// `protect`.
export const codeRunLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: Number(process.env.CODE_RUN_RATE_LIMIT_PER_MIN) || 10,
  keyGenerator: (req) => `code-run:${(req as any).user?.id ?? req.ip}`,
  message: {
    success: false,
    code: "RATE_LIMITED",
    message: "Too many code runs — wait a minute and try again.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});
