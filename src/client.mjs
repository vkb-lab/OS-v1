import { randomUUID } from 'node:crypto';

export class KComputeHttpError extends Error {
  constructor(status, code) {
    super('K-Compute request failed (' + status + ': ' + code + ')');
    this.name = 'KComputeHttpError';
    this.status = status;
    this.code = code;
  }
}

// Server-to-server only; never include this module or token in a browser bundle.
export class KComputeSandboxClient {
  constructor({ baseUrl, tenant, token, fetchImpl = fetch, timeoutMs = 7000, readRetries = 1, allowLocalHttp = false } = {}) {
    const url = new URL(baseUrl);
    if ((url.protocol !== 'https:' && !(allowLocalHttp && url.protocol === 'http:' && ['localhost','127.0.0.1','::1'].includes(url.hostname))) || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
      throw new TypeError('K-Compute baseUrl must be an HTTPS origin');
    }
    if (typeof tenant !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{1,63}$/.test(tenant)) throw new TypeError('Invalid tenant');
    if (typeof token !== 'string' || token.length < 32) throw new TypeError('Invalid private token');
    if (typeof fetchImpl !== 'function') throw new TypeError('fetchImpl must be a function');
    if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 60000) throw new TypeError('Invalid timeout');
    if (!Number.isInteger(readRetries) || readRetries < 0 || readRetries > 2) throw new TypeError('Invalid retries');
    this.baseUrl = url.origin;
    this.tenant = tenant;
    this.#token = token;
    this.#fetchImpl = fetchImpl;
    this.timeoutMs = timeoutMs;
    this.readRetries = readRetries;
  }
  #token;
  #fetchImpl;
  async #request(method, path, payload = undefined, idempotencyKey = undefined) {
    const retries = method === 'GET' ? this.readRetries : 0;
    for (let i = 0; i <= retries; i++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const response = await this.#fetchImpl(this.baseUrl + path, {
          method,
          redirect: 'error',
          headers: {
            authorization: 'Bearer ' + this.#token,
            'x-kaizen-tenant': this.tenant,
            ...(payload === undefined ? {} : {'content-type':'application/json'}),
            ...(idempotencyKey ? {'idempotency-key': idempotencyKey} : {})
          },
          ...(payload === undefined ? {} : {body: JSON.stringify(payload)}),
          signal: controller.signal
        });
        if (!response.ok) {
          if (i < retries && [502,503,504].includes(response.status)) continue;
          throw new KComputeHttpError(response.status, 'upstream_rejected');
        }
        return await response.json();
      } catch (error) {
        if (error instanceof KComputeHttpError) throw error;
        if (i === retries) throw new KComputeHttpError(0, controller.signal.aborted ? 'timeout' : 'network_error');
      } finally { clearTimeout(timer); }
    }
  }
  capabilities() { return this.#request('GET','/v1/capabilities'); }
  usage() { return this.#request('GET','/v1/usage'); }
  getJob(id) {
    if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id)) throw new TypeError('Invalid job ID');
    return this.#request('GET','/v1/jobs/' + encodeURIComponent(id));
  }
  createJob(type, text, idempotencyKey = randomUUID()) {
    if (!['echo.test','estimate.tokens'].includes(type) || typeof text !== 'string' || !text.length || text.length > 2000) throw new TypeError('Invalid sandbox task');
    if (typeof idempotencyKey !== 'string' || !/^[a-zA-Z0-9_-]{8,128}$/.test(idempotencyKey)) throw new TypeError('Invalid idempotency key');
    return this.#request('POST','/v1/jobs',{type,input:{text}},idempotencyKey);
  }
}
