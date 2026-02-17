export async function waitDelay(data: any) {
  let ms: number;

  if (data.useRandomRange) {
    const min = (data.minSeconds || 3) * 1000;
    const max = (data.maxSeconds || 10) * 1000;
    ms = min + Math.random() * (max - min);
  } else {
    ms = (data.seconds || 5) * 1000;
  }

  await new Promise((resolve) => setTimeout(resolve, ms));
  return { success: true, action: `waited_${Math.round(ms / 1000)}s` };
}
