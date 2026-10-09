import { fromNodeHeaders } from 'better-auth/node';
import type { NextFunction, Request, Response } from 'express';

import { auth } from '../auth/auth.js';

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });

    if (!session) {
      return res.status(401).json({
        error: 'Unauthorized',
      });
    }

    res.locals.auth = session;

    next();
  } catch (error) {
    console.error('Failed to resolve auth session', error);

    return res.status(500).json({
      error: 'Failed to authenticate request',
    });
  }
}