import type { Locator, Page } from 'playwright';

interface HumanClickOptions {
  timeoutMs?: number;
  retries?: number;
  allowForce?: boolean;
  allowDomClickFallback?: boolean;
}

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

async function getStableBoundingBox(element: Locator): Promise<Box | null> {
  const first = await element.boundingBox();
  if (!first) return null;

  await randomDelay(80, 170);
  const second = await element.boundingBox();
  if (!second) return null;

  const moved =
    Math.abs(first.x - second.x) > 0.75 ||
    Math.abs(first.y - second.y) > 0.75 ||
    Math.abs(first.width - second.width) > 0.75 ||
    Math.abs(first.height - second.height) > 0.75;

  return moved ? null : second;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export async function humanClick(element: Locator, options: HumanClickOptions = {}) {
  const timeoutMs = options.timeoutMs ?? 7000;
  const retries = options.retries ?? 4;
  const allowForce = options.allowForce ?? true;
  const allowDomClickFallback = options.allowDomClickFallback ?? true;
  let lastError: unknown = null;

  await element.waitFor({ state: 'visible', timeout: timeoutMs });

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      await element.scrollIntoViewIfNeeded().catch(() => undefined);
      const box = await getStableBoundingBox(element);

      if (!box) {
        await element.click({ timeout: Math.min(timeoutMs, 4000) });
        return;
      }

      const offsetX = clamp(
        box.width / 2 + (Math.random() - 0.5) * Math.min(8, Math.max(2, box.width * 0.2)),
        1,
        Math.max(1, box.width - 1)
      );
      const offsetY = clamp(
        box.height / 2 + (Math.random() - 0.5) * Math.min(8, Math.max(2, box.height * 0.2)),
        1,
        Math.max(1, box.height - 1)
      );

      await element.hover({ timeout: Math.min(timeoutMs, 3000) });
      await randomDelay(90, 220);
      await element.click({
        position: { x: offsetX, y: offsetY },
        timeout: Math.min(timeoutMs, 4000),
      });
      return;
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        await randomDelay(130, 320);
      }
    }
  }

  if (allowForce) {
    try {
      await element.click({
        force: true,
        timeout: Math.min(timeoutMs, 3000),
      });
      return;
    } catch (error) {
      lastError = error;
    }
  }

  if (allowDomClickFallback) {
    try {
      await element.evaluate((el) => (el as HTMLElement).click());
      return;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Failed to click element');
}

export async function humanType(page: Page, element: Locator, text: string) {
  await element.click();
  for (const char of text) {
    await page.keyboard.type(char, { delay: 40 + Math.random() * 90 });
  }
}

export async function findButtonByText(page: Page, text: string): Promise<Locator | null> {
  const strategies = [
    page.locator(`button:has-text("${text}")`).first(),
    page.locator(`[role="button"]:has-text("${text}")`).first(),
    page.locator(`a:has-text("${text}")`).first(),
  ];

  for (const locator of strategies) {
    if (await locator.isVisible().catch(() => false)) {
      return locator;
    }
  }

  return null;
}

export async function humanScroll(page: Page) {
  const scrollSteps = 3 + Math.floor(Math.random() * 4);

  for (let i = 0; i < scrollSteps; i++) {
    await page.mouse.wheel(0, 200 + Math.random() * 300);
    await randomDelay(400, 1200);
  }

  await page.mouse.wheel(0, -(100 + Math.random() * 200));
  await randomDelay(500, 1000);
}

export function randomDelay(min: number, max: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, min + Math.random() * (max - min)));
}
