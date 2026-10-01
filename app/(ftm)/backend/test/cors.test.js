const assert = require('node:assert/strict');
const test = require('node:test');
const { createCorsMiddleware } = require('../middleware/cors');

function runMiddleware(middleware, origin, method = 'OPTIONS') {
  const headers = {};
  const response = {
    status: null,
    header(name, value) {
      headers[name] = value;
      return this;
    },
    sendStatus(status) {
      this.status = status;
      return this;
    },
  };
  let nextCalled = false;
  middleware({ headers: origin ? { origin } : {}, method }, response, () => { nextCalled = true; });
  return { headers, response, nextCalled };
}

test('allows preflight only for explicitly configured origins', () => {
  const middleware = createCorsMiddleware('https://backup-ftm.vercel.app, https://app.example.com');
  const allowed = runMiddleware(middleware, 'https://backup-ftm.vercel.app');
  assert.equal(allowed.response.status, 204);
  assert.equal(allowed.headers['Access-Control-Allow-Origin'], 'https://backup-ftm.vercel.app');
  assert.equal(allowed.headers.Vary, 'Origin');

  const denied = runMiddleware(middleware, 'https://untrusted.example.com');
  assert.equal(denied.response.status, 403);
  assert.equal(denied.headers['Access-Control-Allow-Origin'], undefined);
});

test('does not treat wildcard as an allow-all origin', () => {
  const middleware = createCorsMiddleware('*');
  const result = runMiddleware(middleware, 'https://untrusted.example.com');
  assert.equal(result.response.status, 403);
  assert.equal(result.headers['Access-Control-Allow-Origin'], undefined);
});