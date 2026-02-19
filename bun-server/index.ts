import { createServer } from 'node:http';
import { URL } from 'node:url';
import { WorkflowExecutor } from './engine/WorkflowExecutor';
import { CampaignExecutor, requestAbort } from './engine/CampaignExecutor';
import { UniboxSyncer } from './engine/UniboxSyncer';
import { LoginManager } from './engine/LoginManager';
import { AdsPowerManager } from './engine/AdsPowerManager';
import { browserSessionManager } from './engine/BrowserSessionManager';
import { encryptCredential } from './engine/helpers/crypto';
import { loadLocalEnv } from './loadEnv';
import { logger } from './logger';
import { runProxyTest } from './proxyTest';
import { LiveLogger } from './lib/LiveLogger';
import type { Lead } from '../types';

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
    'Access-Control-Allow-Headers': 'Content-Type, x-server-secret, Accept',
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
  res.writeHead(status, {
    'Content-Type': 'application/json',
    ...buildCorsHeaders(requestOrigin),
  });
  res.end(JSON.stringify(payload));
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
  loginManager: LoginManager,
  serverSecret: string
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

    if (method === 'GET' && url.pathname.startsWith('/logs/stream/')) {
      const runId = decodeURIComponent(url.pathname.replace('/logs/stream/', '').trim());
      if (!runId) {
        writeJson(res, 400, { error: 'runId is required' }, requestOrigin);
        return;
      }

      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        ...buildCorsHeaders(requestOrigin),
      });

      res.write(': connected\n\n');

      const unsubscribe = LiveLogger.subscribe(runId, (entry) => {
        res.write(`data: ${JSON.stringify(entry)}\n\n`);
      });

      const heartbeat = setInterval(() => {
        res.write(': ping\n\n');
      }, 20000);

      req.on('close', () => {
        clearInterval(heartbeat);
        unsubscribe();
        res.end();
      });
      return;
    }

    if (!serverSecret) {
      writeJson(
        res,
        500,
        { error: 'Missing BUN_SERVER_SECRET or BUN_SECRET in bun-server environment' },
        requestOrigin
      );
      return;
    }

    const headerSecret = req.headers['x-server-secret'];
    const secret = Array.isArray(headerSecret) ? headerSecret[0] : headerSecret;
    if (secret !== serverSecret) {
      logger.warn('Rejected request with invalid server secret', {
        path: url.pathname,
        method,
      });
      writeText(res, 401, 'Unauthorized', requestOrigin);
      return;
    }

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

      if (method === 'POST' && url.pathname === '/unibox/reply') {
        const body = (await readJsonBody(req as any)) as {
          threadId?: string;
          profileId?: string;
          message?: string;
        };

        if (!body.threadId || !body.message) {
          writeJson(res, 400, { error: 'threadId and message are required' }, requestOrigin);
          return;
        }

        const result = await uniboxSyncer.replyToThread(
          body.threadId,
          body.message,
          body.profileId
        );
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

        if (!body.profileId) {
          writeJson(res, 400, { error: 'profileId is required' }, requestOrigin);
          return;
        }

        const result = await loginManager.login({
          profileId: body.profileId,
          email: typeof body.email === 'string' ? body.email : undefined,
          password: typeof body.password === 'string' ? body.password : undefined,
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

      if (method === 'POST' && url.pathname === '/sessions/close') {
        const body = (await readJsonBody(req as any)) as { profileId?: string };
        if (!body.profileId) {
          writeJson(res, 400, { error: 'profileId is required' }, requestOrigin);
          return;
        }

        await browserSessionManager.closeSession(body.profileId);
        writeJson(res, 200, { closed: true, profileId: body.profileId }, requestOrigin);
        return;
      }

      if (method === 'POST' && url.pathname === '/sessions/close-all') {
        await browserSessionManager.closeAll();
        writeJson(res, 200, { closed: true, all: true }, requestOrigin);
        return;
      }

      if (method === 'GET' && url.pathname === '/auth/status') {
        const profileId = url.searchParams.get('profileId') ?? undefined;
        writeJson(res, 200, loginManager.getStatus(profileId), requestOrigin);
        return;
      }

      if (method === 'POST' && url.pathname === '/encrypt') {
        const body = (await readJsonBody(req as any)) as {
          email?: string;
          password?: string;
        };

        if (!body.email || !body.password) {
          writeJson(res, 400, { error: 'email and password are required' }, requestOrigin);
          return;
        }

        const encEmail = encryptCredential(body.email);
        const encPassword = encryptCredential(body.password);
        writeJson(res, 200, { encEmail, encPassword }, requestOrigin);
        return;
      }

      if (method === 'POST' && url.pathname === '/adspower/create') {
        const body = (await readJsonBody(req as any)) as {
          name?: string;
          proxyHost?: string;
          proxyPort?: number;
          proxyUser?: string;
          proxyPass?: string;
        };

        if (!body.name || !body.name.trim()) {
          writeJson(res, 400, { error: 'name is required' }, requestOrigin);
          return;
        }

        const profileId = await AdsPowerManager.adsPowerCreateProfile(
          body.name,
          body.proxyHost,
          body.proxyPort,
          body.proxyUser,
          body.proxyPass
        );

        writeJson(res, 200, { profileId }, requestOrigin);
        return;
      }

      if (method === 'POST' && url.pathname === '/start') {
        const body = await readJsonBody(req as any);
        const runId = await executor.start(body as any);
        writeJson(res, 200, { started: true, runId }, requestOrigin);
        return;
      }

      if (method === 'POST' && url.pathname === '/stop') {
        const body = (await readJsonBody(req as any)) as {
          runId?: string;
          profileId?: string;
          linkedinProfileId?: string;
          campaignId?: string;
        };
        const profileId = body.profileId || body.linkedinProfileId;

        if (profileId) {
          requestAbort(profileId);
        }

        await executor.stop();

        if (body.campaignId) {
          await campaignExecutor.stop({ campaignId: body.campaignId });
        }

        writeJson(
          res,
          200,
          {
            stopped: true,
            runId: body.runId ?? null,
            profileId: profileId ?? null,
            campaignId: body.campaignId ?? null,
            campaignStopRequested: Boolean(body.campaignId),
          },
          requestOrigin
        );
        return;
      }

      if (method === 'POST' && url.pathname === '/test') {
        const body = (await readJsonBody(req as any)) as {
          runId?: string;
          action?: string;
          nodeType?: string;
          nodeData?: Record<string, unknown>;
          linkedinUrl?: string;
          linkedinProfileId?: string;
          profileId?: string;
          testUrl?: string;
          lead?: Lead;
          leadId?: string;
          messageTemplate?: string;
          isTest?: boolean;
        };

        const result = await executor.testNode({
          runId: body.runId,
          action: body.action,
          nodeType: body.nodeType,
          nodeData: body.nodeData ?? {},
          linkedinUrl: body.linkedinUrl,
          linkedinProfileId: body.linkedinProfileId,
          profileId: body.profileId,
          testUrl: body.testUrl,
          lead: body.lead,
          leadId: body.leadId,
          messageTemplate: body.messageTemplate,
          isTest: body.isTest ?? true,
        });

        writeJson(
          res,
          200,
          {
            runId: body.runId ?? null,
            ...result,
          },
          requestOrigin
        );
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
          writeJson(res, 400, { success: false, error: 'host, port, username, password are required' }, requestOrigin);
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
      writeJson(res, 500, { error: message }, requestOrigin);
    }
  });
}

async function main() {
  await loadLocalEnv();
  const serverSecret =
    process.env.BUN_SERVER_SECRET?.trim() ||
    process.env.BUN_SECRET?.trim() ||
    '';

  const executor = new WorkflowExecutor();
  const campaignExecutor = new CampaignExecutor();
  const uniboxSyncer = new UniboxSyncer();
  const loginManager = new LoginManager();

  if (!serverSecret) {
    logger.warn('No bun server secret configured. Set BUN_SERVER_SECRET or BUN_SECRET.');
  }

  const server = buildServer(executor, campaignExecutor, uniboxSyncer, loginManager, serverSecret);
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
