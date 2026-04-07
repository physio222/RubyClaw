import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import {
  securityHeaders,
  requestSizeLimit,
  rateLimit,
  getCorsOptions,
} from "./middlewares/security";

const app: Express = express();

// Trust proxy (required for rate limiting behind Render/reverse proxy)
app.set("trust proxy", 1);

// Security headers (Helmet-like)
app.use(securityHeaders);

// Request size limit (1MB max)
app.use(requestSizeLimit(1024 * 1024));

// Logging
app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

// CORS (strict in production, open in development)
app.use(cors(getCorsOptions()));

// Body parsers
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// General rate limit: 200 requests per 15 minutes per IP
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    message: "Too many requests. Please try again later.",
  })
);

// Chat-specific rate limit: 30 requests per minute
app.use(
  "/api/chat",
  rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    message: "Chat rate limit exceeded. Please wait a moment.",
  })
);

// API routes
app.use("/api", router);

export default app;
