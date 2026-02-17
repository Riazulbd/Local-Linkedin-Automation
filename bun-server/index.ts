import { createServer } from 'node:http';
import { URL } from 'node:url';
import { WorkflowExecutor } from './engine/WorkflowExecutor';
import { CampaignExecutor } from './engine/CampaignExecutor';
import { UniboxSyncer } from './engine/UniboxSyncer';
import { LoginManager } from './engine/LoginManager';
import { loadLocalEnv } from './loadEnv';
import { logger } from './logger';
import { runProxyTest } from './proxyTest';

const port = Number(process.env.BUN_SERVER_PORT || 3001);
const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || 'http://localhost:3000')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

type JsonValue = Record<string, unknown>;

function resolveResponseOrigin(requestOrigin: string | undefined) {
  if (!requestOrigin) return allowedOrigins[0] || '*';
  if (allowedOrigins.includes(requestOrigin)) return requestOrigin;
  return allowedOrigins[0] || '*';
}

function buildCorsHeaders(requestOrigin: string | undefined) {
  return {
    'Access-Control-Allow-Origin': resolveResponseOrigin(requestOrigin),
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-server-secret',
  };
}

async function readJsonBody(req: { on: (event: string, cb: (chunk: Buffer | string) => void) => void }) {
  const chunks: Buffer[] = [];
  await new Promise<void>((resolve, reject) => {
    (req as any).on('data', (chunk: Buffer | string) => {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    });
    (req as any).on('end', () => resolve());
    (req as any).on('error', (error: unknown) => reject(error));
  });

  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) return {};
  return JSON.parse(raw) as JsonValue;
}

function writeJson(
  res: {
    writeHead: (statusCode: number, headers: Record<string, string>) => void;
    end: (body?: string) => void;
  },
  status: number,
  payload: unknown,
  requestOrigin: string | undefined
) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    ...buildCorsHeaders(requestOrigin),
  });
  res.end(body);
}

function writeText(
  res: {
    writeHead: (statusCode: number, headers: Record<string, string>) => void;
    end: (body?: string) => void;
  },
  status: number,
  text: string,
  requestOrigin: string | undefined
) {
  res.writeHead(status, {
    'Content-Type': 'text/plain; charset=utf-8',
    ...buildCorsHeaders(requestOrigin),
  });
  res.end(text);
}

function buildServer(
  executor: WorkflowExecutor,
  campaignExecutor: CampaignExecutor,
  uniboxSyncer: UniboxSyncer,
  loginManager: LoginManager
) {
  return createServer(async (req, res) => {
  const method = req.method || 'GET';
  const requestOrigin = req.headers.origin;
  const url = new URL(req.url || '/', `http://localhost:${port}`);

  if (method === 'OPTIONS') {
    res.writeHead(204, buildCorsHeaders(requestOrigin));
    res.end();
    return;
  }

  if (method === 'GET' && url.pathname === '/health') {
    writeJson(res, 200, { ok: true, service: 'bun-server' }, requestOrigin);
    return;
  }

  const secret = req.headers['x-server-secret'];
  if (secret !== process.env.BUN_SERVER_SECRET) {
    logger.warn('Rejected request with invalid server secret', {
      path: url.pathname,
      method,
    });
    writeText(res, 401, 'Unauthorized', requestOrigin);
    return;
  }

  logger.info('Received Bun server request', { path: url.pathname, method });

  try {
    if (method === 'POST' && url.pathname === '/campaigns/start') {
      const body = (await readJsonBody(req as any)) as { campaignId?: string };
      const result = await campaignExecutor.start({
        campaignId: typeof body.campaignId === 'string' ? body.campaignId : undefined,
      });
      writeJson(res, 200, result, requestOrigin);
      return;
    }

    if (method === 'POST' && url.pathname === '/campaigns/stop') {
      const body = (await readJsonBody(req as any)) as { campaignId?: string };
      const result = await campaignExecutor.stop({
        campaignId: typeof body.campaignId === 'string' ? body.campaignId : undefined,
      });
      writeJson(res, 200, result, requestOrigin);
      return;
    }

    if (method === 'GET' && url.pathname === '/campaigns/status') {
      writeJson(res, 200, campaignExecutor.getStatus(), requestOrigin);
      return;
    }

    if (method === 'POST' && url.pathname === '/unibox/sync') {
      const body = (await readJsonBody(req as any)) as {
        profileId?: string;
        allProfiles?: boolean;
      };

      if (body.allProfiles) {
        const result = await uniboxSyncer.syncAllProfiles();
        writeJson(res, 200, result, requestOrigin);
        return;
      }

      if (!body.profileId) {
        writeJson(res, 400, { error: 'profileId or allProfiles=true is required' }, requestOrigin);
        return;
      }

      const result = await uniboxSyncer.syncProfile(body.profileId);
      writeJson(res, 200, result, requestOrigin);
      return;
    }

    if (method === 'GET' && url.pathname === '/unibox/status') {
      writeJson(res, 200, uniboxSyncer.getStatus(), requestOrigin);
      return;
    }

    if (method === 'POST' && url.pathname === '/auth/login') {
      const body = (await readJsonBody(req as any)) as {
        profileId?: string;
        email?: string;
        password?: string;
      };

      if (!body.profileId || !body.email || !body.password) {
        writeJson(res, 400, { error: 'profileId, email, and password are required' }, requestOrigin);
        return;
      }

      const result = await loginManager.login({
        profileId: body.profileId,
        email: body.email,
        password: body.password,
      });
      writeJson(res, 200, result, requestOrigin);
      return;
    }

    if (method === 'POST' && url.pathname === '/auth/2fa') {
      const body = (await readJsonBody(req as any)) as {
        profileId?: string;
        code?: string;
      };

      if (!body.profileId || !body.code) {
        writeJson(res, 400, { error: 'profileId and code are required' }, requestOrigin);
        return;
      }

      const result = await loginManager.submitTwoFactor({
        profileId: body.profileId,
        code: body.code,
      });
      writeJson(res, 200, result, requestOrigin);
      return;
    }

    if (method === 'GET' && url.pathname === '/auth/status') {
      const profileId = url.searchParams.get('profileId') ?? undefined;
      writeJson(res, 200, loginManager.getStatus(profileId), requestOrigin);
      return;
    }

    if (method === 'POST' && url.pathname === '/start') {
      const body = await readJsonBody(req as any);
      const runId = await executor.start(body as any);
      writeJson(res, 200, { started: true, runId }, requestOrigin);
      return;
    }

    if (method === 'POST' && url.pathname === '/stop') {
      await executor.stop();
      writeJson(res, 200, { stopped: true }, requestOrigin);
      return;
    }

    if (method === 'POST' && url.pathname === '/test') {
      const body = await readJsonBody(req as any);
      const result = await executor.testNode(body as any);
      writeJson(res, 200, result, requestOrigin);
      return;
    }

    if (method === 'POST' && url.pathname === '/proxy-test') {
      const body = (await readJsonBody(req as any)) as {
        host?: string;
        port?: number;
        username?: string;
        password?: string;
      };

      if (!body.host || !body.port || !body.username || !body.password) {
        writeJson(
          res,
          400,
          { success: false, error: 'host, port, username, password are required' },
          requestOrigin
        );
        return;
      }

      const parsedPort = Number(body.port);
      if (!Number.isFinite(parsedPort) || parsedPort <= 0) {
        writeJson(res, 400, { success: false, error: 'port must be a valid number' }, requestOrigin);
        return;
      }

      const result = await runProxyTest({
        host: body.host,
        port: parsedPort,
        username: body.username,
        password: body.password,
      });
      writeJson(res, 200, result, requestOrigin);
      return;
    }

    if (method === 'GET' && url.pathname === '/status') {
      writeJson(res, 200, executor.getStatus(), requestOrigin);
      return;
    }

    writeText(res, 404, 'Not Found', requestOrigin);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';

    if (method === 'POST' && url.pathname === '/start') {
      writeJson(res, 500, { started: false, error: message }, requestOrigin);
      return;
    }

    if (method === 'POST' && url.pathname === '/stop') {
      writeJson(res, 500, { stopped: false, error: message }, requestOrigin);
      return;
    }

    if (method === 'POST' && url.pathname === '/test') {
      writeJson(res, 500, { success: false, error: message }, requestOrigin);
      return;
    }

    if (method === 'POST' && url.pathname === '/proxy-test') {
      writeJson(res, 500, { success: false, error: message }, requestOrigin);
      return;
    }

    writeJson(res, 500, { error: message }, requestOrigin);
  }
  });
}

async function main() {
  await loadLocalEnv();
  const executor = new WorkflowExecutor();
  const campaignExecutor = new CampaignExecutor();
  const uniboxSyncer = new UniboxSyncer();
  const loginManager = new LoginManager();
  const server = buildServer(executor, campaignExecutor, uniboxSyncer, loginManager);

  server.listen(port, () => {
    logger.info('Automation server started', {
      runtime: 'node',
      port,
      allowedOrigins,
    });
  });
}

main().catch((error) => {
  logger.error('Failed to start automation server', {
    error: error instanceof Error ? error.message : String(error),
  });
  process.exit(1);
});
