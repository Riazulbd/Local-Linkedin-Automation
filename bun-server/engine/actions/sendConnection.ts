import type { Page } from 'playwright';
import { interpolate } from '../helpers/templateEngine';
import { sendConnectionAction } from '../playwright-actions/sendConnection.spec';
import type { ActionResult, Lead } from '../../../types';

type SendConnectionConfig = {
  note?: string;
  connectionNote?: string;
};

function resolveConnectionNote(input: SendConnectionConfig | string | undefined, lead?: Lead): string | undefined {
  if (!input) return undefined;
  const raw = typeof input === 'string' ? input : input.note || input.connectionNote || '';
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  return lead ? interpolate(trimmed, lead) : trimmed;
}

export async function sendConnection(page: Page, note?: string): Promise<ActionResult>;
export async function sendConnection(page: Page, input?: SendConnectionConfig, lead?: Lead): Promise<ActionResult>;
export async function sendConnection(
  page: Page,
  input?: SendConnectionConfig | string,
  lead?: Lead
): Promise<ActionResult> {
  const note = resolveConnectionNote(input, lead);
  return sendConnectionAction(page, { note });
}
