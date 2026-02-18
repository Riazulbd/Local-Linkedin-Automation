import type { Page } from 'playwright';
import { followProfileAction } from '../playwright-actions/followProfile.spec';
import type { ActionResult } from '../../../types';

export async function followProfile(
  page: Page,
  _data?: unknown,
  _lead?: { id?: string }
): Promise<ActionResult> {
  return followProfileAction(page);
}
