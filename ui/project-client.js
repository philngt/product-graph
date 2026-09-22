/** A client is permanently bound to one URL/project. Switching reloads the JS context. */
export function createProjectClient(pathname, fetcher = (...args) => fetch(...args)) {
  const projectId = pathname.match(/^\/project\/([a-f0-9-]{36})\/?$/)?.[1] || null;
  let revision = null;
  async function request(url, options = {}) {
    if (typeof url !== 'string' || !url.startsWith('/api/')) throw new Error('Expected a project API path');
    const target = projectId ? `/api/projects/${projectId}/${url.slice(5)}` : url;
    const method = (options.method || 'GET').toUpperCase();
    const headers = new Headers(options.headers);
    if (method !== 'GET') {
      headers.set('Content-Type', 'application/json');
      if (revision) headers.set('X-Product-Graph-Revision', revision);
    }
    const response = await fetcher(target, { ...options, method, headers });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Project request failed');
    // Read-only context/preview requests must not bless stale local edits for a later save.
    const pathname = url.split('?')[0];
    const authoritative = pathname === '/api/workspace' || pathname === '/api/graph' || method !== 'GET' && (pathname === '/api/commands' || /\/proposals\/[^/]+\/apply$/.test(pathname));
    if (authoritative && typeof data.workspaceRevision === 'string') revision = data.workspaceRevision;
    return data;
  }
  return { projectId, request };
}
