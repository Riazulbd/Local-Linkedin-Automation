import type { Locator, Page } from 'playwright';

interface Point {
  x: number;
  y: number;
}

// ---------------------------------------------------------------------
// Timing utilities
// ---------------------------------------------------------------------
export function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function microPause(): Promise<void> {
  await sleep(randomBetween(180, 600));
}

export async function actionPause(): Promise<void> {
  await sleep(randomBetween(1200, 4500));
}

export async function thinkingPause(): Promise<void> {
  await sleep(randomBetween(800, 2800));
}

export async function betweenLeadsPause(minSec: number, maxSec: number): Promise<void> {
  await sleep(randomBetween(minSec * 1000, maxSec * 1000));
}

// ---------------------------------------------------------------------
// Bezier mouse movement
// ---------------------------------------------------------------------
function bezierPoint(t: number, p0: Point, p1: Point, p2: Point, p3: Point): Point {
  const mt = 1 - t;
  return {
    x: Math.round(mt ** 3 * p0.x + 3 * mt ** 2 * t * p1.x + 3 * mt * t ** 2 * p2.x + t ** 3 * p3.x),
    y: Math.round(mt ** 3 * p0.y + 3 * mt ** 2 * t * p1.y + 3 * mt * t ** 2 * p2.y + t ** 3 * p3.y),
  };
}

function generateControlPoints(start: Point, end: Point): [Point, Point] {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const cx1 = start.x + (dx * randomBetween(20, 40)) / 100 + randomBetween(-50, 50);
  const cy1 = start.y + (dy * randomBetween(20, 40)) / 100 + randomBetween(-50, 50);
  const cx2 = end.x - (dx * randomBetween(20, 40)) / 100 + randomBetween(-50, 50);
  const cy2 = end.y - (dy * randomBetween(20, 40)) / 100 + randomBetween(-50, 50);
  return [
    { x: cx1, y: cy1 },
    { x: cx2, y: cy2 },
  ];
}

export async function humanMouseMove(page: Page, target: Point): Promise<void> {
  const current = await page
    .evaluate(() => ({
      x: (window as any)._lastMouseX ?? Math.round(window.innerWidth / 2),
      y: (window as any)._lastMouseY ?? Math.round(window.innerHeight / 2),
    }))
    .catch(() => ({ x: 400, y: 400 }));

  const [cp1, cp2] = generateControlPoints(current, target);
  const steps = randomBetween(20, 40);

  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const easedT = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    const point = bezierPoint(easedT, current, cp1, cp2, target);
    await page.mouse.move(point.x, point.y);
    const speedFactor = Math.sin(Math.PI * t);
    await sleep(Math.round(randomBetween(4, 18) / (speedFactor + 0.1)));
  }

  await page
    .evaluate((p) => {
      (window as any)._lastMouseX = p.x;
      (window as any)._lastMouseY = p.y;
    }, target)
    .catch(() => undefined);
}

// ---------------------------------------------------------------------
// Human click
// ---------------------------------------------------------------------
export async function humanClick(page: Page, locator: Locator): Promise<void> {
  await locator.scrollIntoViewIfNeeded().catch(() => undefined);
  await microPause();

  const box = await locator.boundingBox();
  if (!box) {
    await locator.click({ delay: randomBetween(60, 140) });
    return;
  }

  const targetX = Math.round(box.x + (box.width * randomBetween(25, 75)) / 100);
  const targetY = Math.round(box.y + (box.height * randomBetween(25, 75)) / 100);

  await humanMouseMove(page, { x: targetX, y: targetY });
  await microPause();

  if (Math.random() < 0.4) {
    await sleep(randomBetween(200, 800));
  }

  await page.mouse.click(targetX, targetY, {
    delay: randomBetween(60, 160),
  });

  await microPause();
}

// ---------------------------------------------------------------------
// Human typing
// ---------------------------------------------------------------------
export async function humanType(page: Page, locator: Locator, text: string): Promise<void> {
  await humanClick(page, locator);
  await thinkingPause();

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const isLetter = /[a-zA-Z]/.test(char);

    if (isLetter && Math.random() < 0.03 && i < text.length - 1) {
      const wrongChar = String.fromCharCode(char.charCodeAt(0) + (Math.random() < 0.5 ? 1 : -1));
      await page.keyboard.type(wrongChar);
      await sleep(randomBetween(80, 300));
      await page.keyboard.press('Backspace');
      await sleep(randomBetween(150, 400));
    }

    await page.keyboard.type(char);

    let delay = randomBetween(40, 130);
    if (['.', '!', '?', ','].includes(char)) delay += randomBetween(100, 400);
    if (['.', '!', '?'].includes(char)) delay += randomBetween(200, 600);
    if (Math.random() < 0.15) delay = randomBetween(20, 50);

    await sleep(delay);
  }
}

// ---------------------------------------------------------------------
// Human scrolling
// ---------------------------------------------------------------------
export async function humanScrollDown(page: Page, totalPx?: number): Promise<void> {
  const amount = totalPx ?? randomBetween(300, 900);
  const steps = randomBetween(4, 9);
  const perStep = Math.floor(amount / steps);

  for (let i = 0; i < steps; i += 1) {
    const stepAmount = perStep + randomBetween(-40, 40);
    await page.mouse.wheel(0, stepAmount);
    await sleep(randomBetween(80, 280));

    if (Math.random() < 0.15 && i > 0) {
      await page.mouse.wheel(0, -randomBetween(30, 100));
      await sleep(randomBetween(200, 500));
    }
  }

  await microPause();
}

export async function humanScrollToTop(page: Page): Promise<void> {
  await page.keyboard.press('Home');
  await sleep(randomBetween(300, 700));
}

export async function humanScrollIntoView(page: Page, locator: Locator): Promise<boolean> {
  try {
    await locator.scrollIntoViewIfNeeded({ timeout: 3000 });
    await sleep(randomBetween(200, 600));
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------
// Idle behavior / engagement
// ---------------------------------------------------------------------
export async function idleMovement(page: Page, durationMs: number): Promise<void> {
  const endAt = Date.now() + durationMs;
  while (Date.now() < endAt) {
    const viewport = (await page.viewportSize()) ?? { width: 1280, height: 800 };
    const x = randomBetween(100, Math.max(101, viewport.width - 100));
    const y = randomBetween(100, Math.max(101, viewport.height - 100));
    await humanMouseMove(page, { x, y }).catch(() => undefined);

    if (Math.random() < 0.3) {
      await humanScrollDown(page, randomBetween(50, 200)).catch(() => undefined);
    }

    await sleep(randomBetween(800, 3000));
  }
}

export async function glanceAtPage(page: Page): Promise<void> {
  const viewport = (await page.viewportSize()) ?? { width: 1280, height: 800 };
  const numGlances = randomBetween(1, 3);

  for (let i = 0; i < numGlances; i += 1) {
    const x = randomBetween(200, Math.max(201, viewport.width - 200));
    const y = randomBetween(100, Math.max(101, viewport.height - 200));
    await humanMouseMove(page, { x, y });
    await sleep(randomBetween(400, 1200));
  }

  if (Math.random() < 0.5) {
    await humanScrollDown(page, randomBetween(100, 400));
    await sleep(randomBetween(500, 1500));
  }
}

// ---------------------------------------------------------------------
// Compatibility exports for existing workflow code paths
// ---------------------------------------------------------------------
export async function moveMouse(page: Page, to: Point): Promise<void> {
  await humanMouseMove(page, to);
}

export async function microDelay(): Promise<void> {
  await microPause();
}

export async function actionDelay(): Promise<void> {
  await actionPause();
}

export async function navigationDelay(): Promise<void> {
  await sleep(randomBetween(1400, 3200));
}

export async function betweenLeadsDelay(min = 15, max = 45): Promise<void> {
  await betweenLeadsPause(min, max);
}

export async function humanScroll(
  page: Page,
  config: {
    distance?: number;
    direction?: 'down' | 'up';
    readingMode?: boolean;
  } = {}
): Promise<void> {
  const distance = config.distance ?? randomBetween(200, 700);
  if (config.direction === 'up') {
    await page.mouse.wheel(0, -Math.abs(distance));
    await microPause();
    return;
  }

  await humanScrollDown(page, distance);
  if (config.readingMode) {
    await sleep(randomBetween(500, 1400));
  }
}

export async function simulateProfileReading(
  page: Page,
  dwellSeconds: { min: number; max: number } = { min: 8, max: 22 }
): Promise<void> {
  const totalMs = randomBetween(dwellSeconds.min * 1000, dwellSeconds.max * 1000);
  const start = Date.now();

  await glanceAtPage(page);

  while (Date.now() - start < totalMs) {
    await idleMovement(page, randomBetween(900, 1800));
  }
}
