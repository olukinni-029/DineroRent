import { Response } from 'express';

const isSecureCookie = (): boolean => {
  return process.env.NODE_ENV === 'production';
};

const baseCookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: 'none' as const,
};

export const setSessionTokenCookie = (res: Response, token: string): void => {
  res.cookie('sessionToken', token, {
    ...baseCookieOptions,
    path: '/',
    maxAge: 2 * 24 * 60 * 60 * 1000, // 2 days
  });
};

export const clearSessionTokenCookie = (res: Response): void => {
  res.clearCookie('sessionToken', {
    ...baseCookieOptions,
    path: '/',
  });
};

export const setRefreshTokenCookie = (res: Response, token: string): void => {
  res.cookie('refreshToken', token, {
    ...baseCookieOptions,
    path: '/api/v1/auth/refresh',
    maxAge: 5 * 24 * 60 * 60 * 1000,
  });
};

export const clearRefreshTokenCookie = (res: Response): void => {
  res.clearCookie('refreshToken', {
    ...baseCookieOptions,
    path: '/api/v1/auth/refresh',
  });
};
