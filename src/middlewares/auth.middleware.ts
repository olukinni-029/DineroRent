import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/hashes/jwthandler';
import { errorResponse } from '../utils/response';

export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return errorResponse(res, 'No token provided', 401);

  try {
    const decoded = verifyToken(token, process.env.JWT_SECRET || 'defaultSecret');
    (req as any).user = decoded; 
    next();
  } catch (err) {
    return errorResponse(res, 'Invalid or expired token', 401);
  }
};

export const authorizeRoles = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const userRole = (req as any).user?.role;
    if (!roles.includes(userRole)) {
      return errorResponse(res, 'Access denied', 403);
    }
    next();
  };
};
