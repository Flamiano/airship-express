// Server-only. Never import this from anything that ships to the browser.
// AI_API_KEY / ANTHROPIC_API_KEY is read from process.env and is never sent
// to the client in any response.

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const MODEL = process.env.FLEET_AI_MODEL || 'claude-sonnet-4-6';

function getApiKey() {
  return process.env.ANTHROPIC_API_KEY || process.env.AI_API_KEY || null;
}

function isConfigured() {
  return Boolean(getApiKey());
}

/**
 * Calls the Anthropic Messages API once.
 * @param {object} params
 * @param {string} params.system - system prompt
 * @param {Array} params.messages - Anthropic-format message array
 * @param {Array} [params.tools] - Anthropic tool definitions
 * @returns {Promise<object>} raw Anthropic response body
 */
async function callAnthropic({ system, messages, tools }) {
  const apiKey = getApiKey();
  if (!apiKey) {
    const err = new Error('AI provider is not configured (missing ANTHROPIC_API_KEY).');
    err.code = 'AI_NOT_CONFIGURED';
    throw err;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  try {
    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        system,
        messages,
        ...(tools && tools.length ? { tools } : {}),
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      const err = new Error(`Anthropic API error ${response.status}: ${text.slice(0, 500)}`);
      err.code = response.status === 429
        ? 'AI_RATE_LIMITED'
        : text.toLowerCase().includes('credit balance is too low')
          ? 'AI_NO_CREDITS'
          : 'AI_PROVIDER_ERROR';
      throw err;
    }

    return await response.json();
  } catch (err) {
    if (err.name === 'AbortError') {
      const timeoutErr = new Error('AI provider timed out.');
      timeoutErr.code = 'AI_TIMEOUT';
      throw timeoutErr;
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = { callAnthropic, isConfigured, MODEL };
