import express, { NextFunction, Request, Response } from "express";
import dotenv from "dotenv";
import responseTime from "response-time";
import cors from "cors";
import compression from "compression";
import createError from "http-errors";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import logger from "../utils/logger";
import path from "path";
import {
  prometheusMetrics,
  trackRequestDuration,
} from "../utils/prometheusconfig";

dotenv.config();
const allowedOrigins = ["http://localhost:5173", process.env.CLIENT_URL].filter(
  Boolean,
);

export const setupMiddleware = (app: express.Application): void => {
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error("Not allowed by CORS"));
        }
      },
      credentials: true,
    }),
  );
  app.use((req: Request, res: Response, next) => {
    logger.info(
      `Request URL: ${req.url} - Method: ${req.method} - IP: ${req.ip} - ${req.get("user-agent")}`,
    );
    next();
  });
  app.disable("x-powered-by");
  app.use(express.static("public"));
  app.set("views", path.join(__dirname, "../views"));
  app.set("view engine", "ejs");

  app.use(cookieParser());
  app.use(express.json());
  app.use(helmet());
  app.use(express.static("public"));
  app.use(express.urlencoded({ extended: true }));
  app.use(responseTime());
  app.use(
    compression({
      level: 6,
      threshold: 100 * 100,
      filter: (req: Request, res: Response) => {
        if (req.headers["x-no-compression"]) {
          return false;
        }
        return compression.filter(req, res);
      },
    }),
  );
  app.use(responseTime());
  app.use(
    rateLimit({
      windowMs: 60 * 1000,
      max: 1000,
      message: () => {
        return createError(
          429,
          "You have exceeded the 5 requests in 1 minute limit!",
        );
      },
    }),
  );

  // Integrate Prometheus metrics middleware
  app.use(prometheusMetrics);
  app.use(trackRequestDuration);
};
