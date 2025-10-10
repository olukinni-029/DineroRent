import { Request, Response } from 'express';

export const getVendor = (req: Request, res: Response) => {
  // TODO: Implement get vendor logic
  res.json({ message: 'Get vendor endpoint' });
};

export const createVendor = (req: Request, res: Response) => {
  // TODO: Implement create vendor logic
  res.json({ message: 'Create vendor endpoint' });
};
