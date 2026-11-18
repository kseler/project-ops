import { fromNodeHeaders } from 'better-auth/node';
import { and, eq } from 'drizzle-orm';
import type { NextFunction, Request, Response } from 'express';

import { auth } from '../auth/auth.js';
import { member } from '../db/auth-schema.js';
import { db } from '../db/index.js';

export async function isOrganizationMember(userId: string, organizationId: string) {
  const [membership] = await db
    .select({ id: member.id })
    .from(member)
    .where(and(eq(member.userId, userId), eq(member.organizationId, organizationId)))
    .limit(1);

  return Boolean(membership);
}

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

    const { activeOrganizationId } = session.session;

    // the session can outlive the membership (e.g. the user was removed), so verify it
    if (activeOrganizationId && !(await isOrganizationMember(session.user.id, activeOrganizationId))) {
      return res.status(403).json({
        error: 'Not a member of the active organization',
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
