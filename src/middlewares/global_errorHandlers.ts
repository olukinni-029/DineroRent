import express, { Request, Response, NextFunction } from "express";
import multer from "multer";
import { errorResponse } from "../utils/response";
import logger from "../utils/logger";

interface CustomError extends Error {
  status?: number;
  message: string;
}

export const setupErrorHandlers = (app: express.Application): void => {
  app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    logger.error(
      `Error: ${err.message} - ${err.stack} - ${req.originalUrl} - ${req.method} - ${req.ip}`
    );

    if (err instanceof multer.MulterError) {
      return errorResponse(res, err.message, 400);
    } else if (err) {
      return errorResponse(res, err.message || "Internal server error", 500);
    }
    next(err);
  });

  app.use((req: Request, res: Response, next: NextFunction) => {
    next(errorResponse(res, "Resource Not Found", 404));
  });

  app.use((err: CustomError, req: Request, res: Response) => {
    const status = err.status || 500;
    return errorResponse(res, err.message, status);
  });
};
