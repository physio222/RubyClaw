import type { Request, Response, NextFunction } from "express";
import { logger } from "../lib/logger";

// ============================================================================
// Rate Limiter (in-memory, production-grade for single-instance)
// ============================================================================
interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore) {
    if (now > entry.resetAt) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

export function rateLimit(options: {
  windowMs: number;
  max: number;
  message?: string;
}) {
  const { windowMs, max, message = "Too many requests, please try again later." } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    const key = `${ip}:${req.path}`;
    const now = Date.now();

    let entry = rateLimitStore.get(key);
    if (!entry || now > entry.resetAt) {
      entry = { count: 0, resetAt: now + windowMs };
      rateLimitStore.set(key, entry);
    }

    entry.count++;

    // Set rate limit headers
    res.setHeader("X-RateLimit-Limit", max);
    res.setHeader("X-RateLimit-Remaining", Math.max(0, max - entry.count));
    res.setHeader("X-RateLimit-Reset", Math.ceil(entry.resetAt / 1000));

    if (entry.count > max) {
      logger.warn({ ip, path: req.path, count: entry.count }, "Rate limit exceeded");
      res.status(429).json({ error: message });
      return;
    }

    next();
  };
}

// ============================================================================
// Security Headers (Helmet-like, zero-dependency)
// ============================================================================
export function securityHeaders(_req: Request, res: Response, next: NextFunction) {
  // Prevent XSS attacks
  res.setHeader("X-Content-Type-Options", "nosniff");
  // Prevent clickjacking
  res.setHeader("X-Frame-Options", "DENY");
  // XSS Protection
  res.setHeader("X-XSS-Protection", "1; mode=block");
  // Strict Transport Security (HTTPS only)
  res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
  // Referrer Policy
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  // Permissions Policy
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  // Content Security Policy
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https:; font-src 'self' https:; object-src 'none'; frame-ancestors 'none';"
  );
  // Remove X-Powered-By
  res.removeHeader("X-Powered-By");

  next();
}

// ============================================================================
// Request Size Limiter
// ============================================================================
export function requestSizeLimit(maxBytes: number = 1024 * 1024) {
  return (req: Request, res: Response, next: NextFunction) => {
    const contentLength = parseInt(req.headers["content-length"] || "0", 10);
    if (contentLength > maxBytes) {
      res.status(413).json({ error: "Request body too large" });
      return;
    }
    next();
  };
}

// ============================================================================
// Input Sanitizer
// ============================================================================
export function sanitizeInput(input: string): string {
  return input
    .replace(/\0/g, "") // Remove null bytes
    .trim();
}

// ============================================================================
// CORS Configuration
// ============================================================================
export function getCorsOptions() {
  const allowedOrigins = process.env["ALLOWED_ORIGINS"]
    ? process.env["ALLOWED_ORIGINS"].split(",").map((o) => o.trim())
    : ["*"]; // Allow all in dev, configure in production

  return {
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void
    ) => {
      // Allow requests with no origin (mobile apps, curl, etc.)
      if (!origin) {
        callback(null, true);
        return;
      }
      if (allowedOrigins.includes("*") || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        logger.warn({ origin }, "CORS request blocked");
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    optionsSuccessStatus: 200,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Accept"],
    maxAge: 86400, // 24 hours preflight cache
  };
}
