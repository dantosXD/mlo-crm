import { Page } from '@playwright/test';
import { MissionPass, ScreenPerfRecord } from './missionTypes';

interface PerfSnapshot {
  ttfbMs: number | null;
  domInteractiveMs: number | null;
  domContentLoadedMs: number | null;
  loadEventMs: number | null;
  firstPaintMs: number | null;
  firstContentfulPaintMs: number | null;
}

export async function captureScreenPerformance(
  page: Page,
  options: {
    runId: string;
    pass: MissionPass;
    flowId: string;
    screen: string;
  }
): Promise<ScreenPerfRecord> {
  const snapshot = await page.evaluate<PerfSnapshot>(() => {
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    const paints = performance.getEntriesByType('paint') as PerformanceEntry[];
    const fp = paints.find((entry) => entry.name === 'first-paint');
    const fcp = paints.find((entry) => entry.name === 'first-contentful-paint');

    return {
      ttfbMs: nav ? Math.round(nav.responseStart) : null,
      domInteractiveMs: nav ? Math.round(nav.domInteractive) : null,
      domContentLoadedMs: nav ? Math.round(nav.domContentLoadedEventEnd) : null,
      loadEventMs: nav ? Math.round(nav.loadEventEnd) : null,
      firstPaintMs: fp ? Math.round(fp.startTime) : null,
      firstContentfulPaintMs: fcp ? Math.round(fcp.startTime) : null,
    };
  });

  return {
    runId: options.runId,
    pass: options.pass,
    flowId: options.flowId,
    screen: options.screen,
    url: page.url(),
    capturedAt: new Date().toISOString(),
    ...snapshot,
  };
}

