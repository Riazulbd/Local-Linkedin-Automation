import type { Page, Locator } from 'playwright';

// ─────────────────────────────────────────────────────────────────
// CORE UTILITIES
// ─────────────────────────────────────────────────────────────────

function rand(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function randInt(min: number, max: number): number {
  return Math.floor(rand(min, max + 1));
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

function gaussian(mean: number, stdDev: number): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return mean + stdDev * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// ─────────────────────────────────────────────────────────────────
// BEZIER MOUSE MOVEMENT
// ─────────────────────────────────────────────────────────────────

interface Point { x: number; y: number }

function bezierPoint(t: number, points: Point[]): Point {
  if (points.length === 1) return points[0];
  const newPoints: Point[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    newPoints.push({
      x: (1 - t) * points[i].x + t * points[i + 1].x,
      y: (1 - t) * points[i].y + t * points[i + 1].y,
    });
  }
  return bezierPoint(t, newPoints);
}

function generateControlPoints(from: Point, to: Point): Point[] {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  const perp = { x: -dy / (dist || 1), y: dx / (dist || 1) };
  const curve1 = rand(-dist * 0.3, dist * 0.3);
  const curve2 = rand(-dist * 0.2, dist * 0.2);

  return [
    from,
    {
      x: from.x + dx * 0.3 + perp.x * curve1 + rand(-8, 8),
      y: from.y + dy * 0.3 + perp.y * curve1 + rand(-8, 8),
    },
    {
      x: from.x + dx * 0.7 + perp.x * curve2 + rand(-6, 6),
      y: from.y + dy * 0.7 + perp.y * curve2 + rand(-6, 6),
    },
    to,
  ];
}

export async function moveMouse(page: Page, to: Point, currentPos?: Point): Promise<void> {
  const from = currentPos ?? { x: randInt(400, 900), y: randInt(300, 600) };
  const controlPoints = generateControlPoints(from, to);

  const dist = Math.sqrt((to.x - from.x) ** 2 + (to.y - from.y) ** 2);
  const steps = Math.max(20, Math.floor(dist / 8));
  const baseDuration = Math.max(300, dist * 1.8);

  for (let i = 1; i <= steps; i++) {
    const t = i / steps;

    const tEased = t < 0.5
      ? 2 * t * t + rand(-0.01, 0.01)
      : -1 + (4 - 2 * t) * t + rand(-0.01, 0.01);

    const point = bezierPoint(Math.min(1, Math.max(0, tEased)), controlPoints);
    await page.mouse.move(point.x + rand(-0.5, 0.5), point.y + rand(-0.5, 0.5));

    const speedMultiplier = Math.sin(t * Math.PI);
    const stepDelay = (baseDuration / steps) * (1.5 - speedMultiplier);
    await sleep(Math.max(5, stepDelay));

    if (Math.random() < 0.03) await sleep(rand(50, 180));
  }
}

// ─────────────────────────────────────────────────────────────────
// HUMAN CLICK
// ─────────────────────────────────────────────────────────────────

export async function humanClick(page: Page, locator: Locator): Promise<void> {
  const box = await locator.boundingBox();
  if (!box) throw new Error('Element has no bounding box');

  const target: Point = {
    x: box.x + box.width  * rand(0.35, 0.65) + rand(-2, 2),
    y: box.y + box.height * rand(0.35, 0.65) + rand(-2, 2),
  };

  await moveMouse(page, target);
  await sleep(rand(80, 220));

  if (Math.random() < 0.25) {
    await page.mouse.move(target.x + rand(-3, 3), target.y + rand(-3, 3));
    await sleep(rand(30, 80));
  }

  await page.mouse.down();
  await sleep(rand(60, 160));
  await page.mouse.up();
  await sleep(rand(100, 300));
}

// ─────────────────────────────────────────────────────────────────
// HUMAN TYPING
// ─────────────────────────────────────────────────────────────────

export async function humanType(page: Page, locator: Locator, text: string): Promise<void> {
  await humanClick(page, locator);
  await sleep(rand(200, 500));

  await page.keyboard.press('Control+a');
  await sleep(rand(80, 150));

  let lastChar = '';
  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    let delay = gaussian(55, 18);

    if ('.!?,;:'.includes(lastChar)) delay += rand(150, 400);
    else if (' ' === lastChar && Math.random() < 0.15) delay += rand(100, 250);

    if (Math.random() < 0.08) delay *= 0.4;
    if (Math.random() < 0.015) delay += rand(800, 2500);

    await sleep(Math.max(20, delay));
    await page.keyboard.type(char);
    lastChar = char;
  }

  await sleep(rand(200, 600));
}

// ─────────────────────────────────────────────────────────────────
// HUMAN SCROLL
// ─────────────────────────────────────────────────────────────────

export async function humanScroll(
  page: Page,
  config: {
    distance?: number;
    direction?: 'down' | 'up';
    readingMode?: boolean;
  } = {}
): Promise<void> {
  const { direction = 'down', readingMode = false } = config;
  const totalDistance = config.distance ?? randInt(300, 900);

  let scrolled = 0;
  while (scrolled < totalDistance) {
    const chunk = randInt(60, 180);
    const actualChunk = Math.min(chunk, totalDistance - scrolled);
    const delta = direction === 'down' ? actualChunk : -actualChunk;

    const mx = randInt(300, 900);
    const my = randInt(200, 600);
    await page.mouse.move(mx + rand(-10, 10), my + rand(-10, 10));
    await page.mouse.wheel(0, delta);
    scrolled += actualChunk;

    if (readingMode) {
      const readPause = gaussian(1800, 600);
      await sleep(Math.max(400, readPause));
    } else {
      await sleep(rand(80, 250));
    }

    if (readingMode && Math.random() < 0.2) {
      await page.mouse.wheel(0, -randInt(40, 120));
      await sleep(rand(300, 700));
    }

    if (Math.random() < 0.3) await sleep(rand(500, 2000));
  }
}

// ─────────────────────────────────────────────────────────────────
// PROFILE PAGE READING SIMULATION
// ─────────────────────────────────────────────────────────────────

export async function simulateProfileReading(
  page: Page,
  dwellSeconds: { min: number; max: number } = { min: 8, max: 22 }
): Promise<void> {
  const totalMs = randInt(dwellSeconds.min * 1000, dwellSeconds.max * 1000);
  const startTime = Date.now();

  await sleep(rand(500, 1200));
  await humanScroll(page, { distance: randInt(200, 400), readingMode: false });
  await sleep(rand(800, 1500));

  await humanScroll(page, { distance: randInt(300, 600), readingMode: true });

  if (Math.random() < 0.4) {
    await humanScroll(page, { distance: randInt(150, 350), direction: 'up' });
    await sleep(rand(600, 1500));
  }

  await humanScroll(page, { distance: randInt(200, 500), readingMode: true });

  while (Date.now() - startTime < totalMs) {
    await idleMouseMovement(page);
    await sleep(rand(1000, 3000));
  }
}

async function idleMouseMovement(page: Page): Promise<void> {
  const cx = randInt(300, 900);
  const cy = randInt(200, 600);
  await page.mouse.move(cx + rand(-15, 15), cy + rand(-15, 15));
  await sleep(rand(200, 600));
}

// ─────────────────────────────────────────────────────────────────
// DELAYS
// ─────────────────────────────────────────────────────────────────

export async function microDelay(): Promise<void> {
  await sleep(gaussian(400, 150));
}

export async function actionDelay(): Promise<void> {
  await sleep(gaussian(4500, 1800));
}

export async function navigationDelay(): Promise<void> {
  await sleep(gaussian(2500, 800));
}

export async function betweenLeadsDelay(min = 15, max = 45): Promise<void> {
  await sleep(randInt(min * 1000, max * 1000));
}

export async function thinkingPause(): Promise<void> {
  await sleep(rand(1200, 4000));
}
