import { Response } from 'express';

export const successResponse = (res: Response, data: object, message: string) => {
  return res.status(200).json({
    success: true,
    message,
    data,
  });
};

export const errorResponse = (res: Response, message: string, statusCode: number) => {
  return res.status(statusCode).json({
    success: false,
    message,
  });
};

