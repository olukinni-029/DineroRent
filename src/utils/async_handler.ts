/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response, NextFunction } from 'express';
import logger from './logger';

const asyncHandler = (controller: any) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await controller(req, res, next);
    } catch (error) {
      logger.error(error);
      next(error);
    }
  };
};

export default asyncHandler;
