import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiError, getTask, isNotFound } from '@/api';

function respond(status: number, body: unknown, statusText = '') {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
    new Response(typeof body === 'string' ? body : JSON.stringify(body), { status, statusText }),
  ));
}

async function failure() {
  try {
    await getTask('t1');
  } catch (error) {
    return error as ApiError;
  }
  throw new Error('expected the request to fail');
}

describe('API client errors', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('keeps the status and the server message', async () => {
    respond(404, { error: 'Task not found' });
    const error = await failure();

    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(404);
    expect(error.message).toBe('Task not found');
    expect(isNotFound(error)).toBe(true);
  });

  it('uses the first validation issue as the message', async () => {
    respond(400, { error: [{ path: ['dueDate'], message: 'dueDate must be on or after startDate' }] });
    const error = await failure();

    expect(error.message).toBe('dueDate must be on or after startDate');
    expect(isNotFound(error)).toBe(false);
  });

  it('reads { message } bodies', async () => {
    respond(500, { message: 'Failed to fetch project' });
    expect((await failure()).message).toBe('Failed to fetch project');
  });

  it('falls back to the status text when the body is not JSON', async () => {
    respond(502, '<html>Bad Gateway</html>', 'Bad Gateway');
    expect((await failure()).message).toBe('Bad Gateway');
  });
});
