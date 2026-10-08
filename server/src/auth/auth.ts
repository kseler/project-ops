import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import { betterAuth } from 'better-auth';
import { organization } from 'better-auth/plugins';

import * as authSchema from '../db/auth-schema.js';
import { db } from '../db/index.js';

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: authSchema,
  }),

  trustedOrigins: ['http://localhost:5173'],

  emailAndPassword: {
    enabled: true,
  },

  plugins: [
    organization()
  ]
});