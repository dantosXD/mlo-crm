import { Page, Request, Response } from '@playwright/test';
import { NetworkRequestSample, NetworkSummary } from './missionTypes';

type RequestMeta = {
  startedAt: number;
  requestBytes: number;
  screen: string;
};

function safeContentLength(resp: Response): number {
  const raw = resp.headers()['content-length'];
  const parsed = raw ? Number.parseInt(raw, 10) : 0;
  return Number.isFinite(parsed) ? parsed : 0;
}

function endpointKey(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return url;
  }
}

function inferScreenFromPageUrl(pageUrl: string): string {
  try {
    const parsed = new URL(pageUrl);
    const parts = parsed.pathname.split('/').filter(Boolean);
    if (parts.length === 0) return 'dashboard';
    if (parts[0] === 'clients' && parts.length > 1) return 'client-details';
    return parts[0];
  } catch {
    return 'unknown';
  }
}

function isExpectedFailure(url: string, status: number | null, failureText: string | null = null): boolean {
  if (url.includes('/api/auth/refresh') && (status === 400 || status === 401)) {
    return true;
  }
  if (url.includes('/api/notifications/unread-count') && status === 401) {
    return true;
  }

  if (failureText) {
    const normalized = failureText.toLowerCase();
    if (normalized.includes('err_aborted') || normalized.includes('aborted')) return true;
    if (normalized.includes('internet_disconnected')) return true;
  }

  return false;
}

export function startNetworkObserver(page: Page) {
  const requestMeta = new Map<Request, RequestMeta>();
  const samples: NetworkRequestSample[] = [];
  let currentScreen = 'unknown';

  const onRequest = (request: Request) => {
    const body = request.postDataBuffer();
    const inferredScreen =
      currentScreen && currentScreen !== 'unknown'
        ? currentScreen
        : inferScreenFromPageUrl(page.url());
    requestMeta.set(request, {
      startedAt: Date.now(),
      requestBytes: body?.byteLength ?? 0,
      screen: inferredScreen,
    });
  };

  const onResponse = (response: Response) => {
    const request = response.request();
    const meta = requestMeta.get(request);
    const endedAt = Date.now();
    const startedAt = meta?.startedAt ?? endedAt;
    const durationMs = Math.max(0, endedAt - startedAt);
    const status = response.status();
    const url = response.url();
    const method = request.method();
    const responseBytes = safeContentLength(response);
    const ok = (status >= 200 && status < 400) || isExpectedFailure(url, status);
    const sample: NetworkRequestSample = {
      url,
      method,
      status,
      ok,
      requestBytes: meta?.requestBytes ?? 0,
      responseBytes,
      durationMs,
      startedAt: new Date(startedAt).toISOString(),
      endedAt: new Date(endedAt).toISOString(),
      screen: meta?.screen ?? currentScreen,
    };
    samples.push(sample);
    requestMeta.delete(request);
  };

  const onRequestFailed = (request: Request) => {
    const failureText = request.failure()?.errorText?.toLowerCase() ?? '';
    // Ignore expected navigation and route-transition failure noise.
    if (isExpectedFailure(request.url(), null, failureText)) {
      requestMeta.delete(request);
      return;
    }

    const meta = requestMeta.get(request);
    const endedAt = Date.now();
    const startedAt = meta?.startedAt ?? endedAt;
    const sample: NetworkRequestSample = {
      url: request.url(),
      method: request.method(),
      status: null,
      ok: false,
      requestBytes: meta?.requestBytes ?? 0,
      responseBytes: 0,
      durationMs: Math.max(0, endedAt - startedAt),
      startedAt: new Date(startedAt).toISOString(),
      endedAt: new Date(endedAt).toISOString(),
      screen: meta?.screen ?? currentScreen,
    };
    samples.push(sample);
    requestMeta.delete(request);
  };

  page.on('request', onRequest);
  page.on('response', onResponse);
  page.on('requestfailed', onRequestFailed);

  return {
    markScreen(screen: string) {
      currentScreen = screen;
    },
    getSamples(): NetworkRequestSample[] {
      return [...samples];
    },
    getSummary(): NetworkSummary {
      const totalRequests = samples.length;
      const failedRequests = samples.filter((sample) => !sample.ok).length;
      const apiSamples = samples.filter((sample) => sample.url.includes('/api/'));

      const callsByScreenMap = new Map<string, number>();
      apiSamples.forEach((sample) => {
        callsByScreenMap.set(sample.screen, (callsByScreenMap.get(sample.screen) || 0) + 1);
      });

      const failedEndpointMap = new Map<string, { status: number | null; count: number }>();
      samples
        .filter((sample) => !sample.ok)
        .forEach((sample) => {
          const key = `${endpointKey(sample.url)}|${sample.status ?? 'FAILED'}`;
          const current = failedEndpointMap.get(key);
          if (!current) {
            failedEndpointMap.set(key, { status: sample.status, count: 1 });
            return;
          }
          failedEndpointMap.set(key, { status: current.status, count: current.count + 1 });
        });

      return {
        totalRequests,
        failedRequests,
        apiCalls: apiSamples.length,
        callsByScreen: Array.from(callsByScreenMap.entries())
          .map(([screen, calls]) => ({ screen, calls }))
          .sort((a, b) => b.calls - a.calls),
        largestPayloads: [...samples]
          .sort((a, b) => b.responseBytes - a.responseBytes)
          .slice(0, 5)
          .map((sample) => ({
            url: sample.url,
            responseBytes: sample.responseBytes,
            screen: sample.screen,
          })),
        failedEndpoints: Array.from(failedEndpointMap.entries())
          .map(([key, value]) => {
            const splitIndex = key.lastIndexOf('|');
            const url = key.slice(0, splitIndex);
            return { url, status: value.status, count: value.count };
          })
          .sort((a, b) => b.count - a.count)
          .slice(0, 10),
      };
    },
    stop() {
      page.off('request', onRequest);
      page.off('response', onResponse);
      page.off('requestfailed', onRequestFailed);
    },
  };
}
