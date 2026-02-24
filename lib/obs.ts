export function getRequestId(req: Request) {
  return req.headers.get('x-request-id') || `req_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export function logObs(event: string, payload: Record<string, unknown>) {
  console.info(
    JSON.stringify({
      type: 'obs',
      event,
      ts: new Date().toISOString(),
      ...payload
    })
  );
}

export function alertLevel(event: string) {
  if (event.includes('auth') || event.includes('upload')) return 'high';
  if (event.includes('publish') || event.includes('deploy')) return 'medium';
  return 'low';
}
