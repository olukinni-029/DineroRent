import { Request, Response } from 'express';

export const getAdminData = (req: Request, res: Response) => {
  // TODO: Implement admin data logic
  res.json({ message: 'Admin data endpoint' });
};
