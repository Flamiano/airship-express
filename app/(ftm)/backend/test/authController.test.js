const assert = require('node:assert/strict');
const test = require('node:test');
const crypto = require('node:crypto');
const nodemailer = require('nodemailer');
const { requestMfaOtp, verifyMfaOtp } = require('../controllers/authController');

const envNames = [
  'OTP_HASH_SECRET',
  'OTP_TTL_SECONDS',
  'OTP_MAX_ATTEMPTS',
  'OTP_RESEND_COOLDOWN_SECONDS',
  'RESEND_API_KEY',
  'RESEND_FROM',
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_SECURE',
  'SMTP_USER',
  'SMTP_PASS',
  'SMTP_FROM',
  'FTM_SMTP_HOST',
  'FTM_SMTP_PORT',
  'FTM_SMTP_SECURE',
  'FTM_SMTP_USER',
  'FTM_SMTP_PASS',
  'FTM_SMTP_FROM',
  'FTM_SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
];

function createResponse() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

function createRequest(email, code) {
  return { body: { email, code } };
}

test.beforeEach(() => {
  for (const name of envNames) delete process.env[name];
  process.env.OTP_HASH_SECRET = 'unit-test-only-secret';
  process.env.RESEND_API_KEY = 'unit-test-resend-key';
  process.env.RESEND_FROM = 'Airship Tests <test@mail.example.com>';
});

test('sends through Resend HTTPS and verifies a hashed OTP once', async (t) => {
  const originalFetch = global.fetch;
  const originalRandomInt = crypto.randomInt;
  global.fetch = async (url, options) => {
    assert.equal(url, 'https://api.resend.com/emails');
    assert.equal(options.headers.Authorization, 'Bearer unit-test-resend-key');
    assert.equal(options.signal.aborted, false);
    return { ok: true, status: 200 };
  };
  crypto.randomInt = () => 123456;
  t.after(() => {
    global.fetch = originalFetch;
    crypto.randomInt = originalRandomInt;
  });

  const requestResponse = createResponse();
  await requestMfaOtp(createRequest('Tester@Example.com'), requestResponse);

  assert.equal(requestResponse.statusCode, 200);
  assert.equal(requestResponse.body.sent, true);
  assert.equal(JSON.stringify(requestResponse.body).includes('123456'), false);

  const wrongResponse = createResponse();
  verifyMfaOtp(createRequest('tester@example.com', '123457'), wrongResponse);
  assert.equal(wrongResponse.statusCode, 401);

  const validResponse = createResponse();
  verifyMfaOtp(createRequest('tester@example.com', '123456'), validResponse);
  assert.equal(validResponse.statusCode, 200);

  const replayResponse = createResponse();
  verifyMfaOtp(createRequest('tester@example.com', '123456'), replayResponse);
  assert.equal(replayResponse.statusCode, 401);
});

test('falls back to Resend HTTPS when SMTP connection fails', async (t) => {
  const originalFetch = global.fetch;
  const originalCreateTransport = nodemailer.createTransport;
  global.fetch = async () => ({ ok: true, status: 200 });
  nodemailer.createTransport = (options) => {
    assert.equal(options.connectionTimeout, 5000);
    assert.equal(options.greetingTimeout, 5000);
    return { sendMail: async () => { throw Object.assign(new Error('connection timeout'), { code: 'ETIMEDOUT' }); } };
  };
  process.env.SMTP_HOST = 'smtp.example.test';
  process.env.SMTP_PORT = '465';
  process.env.SMTP_SECURE = 'true';
  process.env.SMTP_USER = 'test@example.test';
  process.env.SMTP_PASS = 'unit-test-smtp-password';
  process.env.SMTP_FROM = 'test@example.test';
  t.after(() => {
    global.fetch = originalFetch;
    nodemailer.createTransport = originalCreateTransport;
  });

  const response = createResponse();
  await requestMfaOtp(createRequest('fallback@example.com'), response);
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.sent, true);
});

test('does not accept OTP verification when delivery providers fail', async (t) => {
  const originalFetch = global.fetch;
  global.fetch = async () => ({ ok: false, status: 401 });
  t.after(() => { global.fetch = originalFetch; });

  const response = createResponse();
  await requestMfaOtp(createRequest('failed@example.com'), response);
  assert.equal(response.statusCode, 500);
  assert.equal(response.body.sent, undefined);

  const verifyResponse = createResponse();
  verifyMfaOtp(createRequest('failed@example.com', '123456'), verifyResponse);
  assert.equal(verifyResponse.statusCode, 401);
});

test('rejects malformed OTP values and enforces the attempt limit', async (t) => {
  const originalFetch = global.fetch;
  const originalRandomInt = crypto.randomInt;
  global.fetch = async () => ({ ok: true, status: 200 });
  crypto.randomInt = () => 123456;
  t.after(() => {
    global.fetch = originalFetch;
    crypto.randomInt = originalRandomInt;
  });

  const requestResponse = createResponse();
  await requestMfaOtp(createRequest('limits@example.com'), requestResponse);
  assert.equal(requestResponse.statusCode, 200);

  const malformedResponse = createResponse();
  verifyMfaOtp(createRequest('limits@example.com', '12ab56'), malformedResponse);
  assert.equal(malformedResponse.statusCode, 400);

  for (let attempt = 1; attempt < 5; attempt += 1) {
    const wrongResponse = createResponse();
    verifyMfaOtp(createRequest('limits@example.com', '000000'), wrongResponse);
    assert.equal(wrongResponse.statusCode, 401);
  }

  const finalWrongResponse = createResponse();
  verifyMfaOtp(createRequest('limits@example.com', '000000'), finalWrongResponse);
  assert.equal(finalWrongResponse.statusCode, 429);
});