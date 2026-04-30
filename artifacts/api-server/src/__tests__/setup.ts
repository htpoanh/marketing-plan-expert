/**
 * Vitest setup — runs before every test file.
 *
 * Provides safe defaults for env vars so importing modules that read
 * `process.env.*` at import time (e.g. integration clients) doesn't crash.
 *
 * Tests that need to interact with a real DB or AI provider should override
 * these explicitly per-test or use mocks.
 */
process.env.NODE_ENV ??= "test";
process.env.PORT ??= "0";
process.env.DATABASE_URL ??=
  "postgres://test:test@127.0.0.1:5432/test_unused_in_unit_tests";
process.env.SESSION_SECRET ??= "test-session-secret";
process.env.ADMIN_PASSWORD ??= "test-admin";
process.env.AI_INTEGRATIONS_GEMINI_API_KEY ??= "test-gemini-key";
process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY ??= "test-anthropic-key";
process.env.OPENAI_API_KEY ??= "test-openai-key";
process.env.GROK_API_KEY ??= "test-grok-key";
