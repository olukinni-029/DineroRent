import { Request, Response } from 'express';

export const getListings = (req: Request, res: Response) => {
  // TODO: Implement get listings logic
  res.json({ message: 'Get listings endpoint' });
};

export const createListing = (req: Request, res: Response) => {
  // TODO: Implement create listing logic
  res.json({ message: 'Create listing endpoint' });
};
