import { describe, it, expect } from 'vitest';
import { applyPrivacyFilter } from './privacy-filter.js';

describe('applyPrivacyFilter', () => {
  it('redacts OpenAI-style sk- API keys', () => {
    const input = 'export OPENAI_API_KEY=sk-abc123XYZ4567890defGHIJKLMN';
    const out = applyPrivacyFilter(input);
    expect(out).not.toContain('sk-abc123');
    expect(out).toContain('[REDACTED]');
  });

  it('redacts Anthropic sk-ant- keys', () => {
    const input = 'ANTHROPIC_API_KEY=sk-ant-api03-AbCdEf-1234567890';
    const out = applyPrivacyFilter(input);
    expect(out).not.toContain('sk-ant-api03-AbCdEf');
  });

  it('redacts AWS access keys', () => {
    const input = 'AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE';
    const out = applyPrivacyFilter(input);
    expect(out).not.toContain('AKIAIOSFODNN7EXAMPLE');
  });

  it('redacts GitHub PATs', () => {
    const input = 'token: ghp_aBcDeFgHiJkLmNoPqRsTuVwXyZ1234567890';
    const out = applyPrivacyFilter(input);
    expect(out).not.toContain('ghp_aBcDeFgHiJ');
  });

  it('redacts Slack bot tokens', () => {
    const input = 'SLACK_BOT_TOKEN=xoxb-12345-67890-abcDEF';
    const out = applyPrivacyFilter(input);
    expect(out).not.toContain('xoxb-12345');
  });

  it('redacts email addresses', () => {
    const input = 'sending to alice@example.com and bob@x.io';
    const out = applyPrivacyFilter(input);
    expect(out).not.toContain('alice@example.com');
    expect(out).not.toContain('bob@x.io');
  });

  it('redacts IP addresses', () => {
    const input = 'connecting to 192.168.1.1 and 10.0.0.42';
    const out = applyPrivacyFilter(input);
    expect(out).not.toContain('192.168.1.1');
    expect(out).not.toContain('10.0.0.42');
  });

  it('redacts the $HOME path with [HOME]', () => {
    const originalHome = process.env['HOME'];
    process.env['HOME'] = '/Users/alice';
    // module-level constant means we can only check the current HOME
    // (the import already captured `process.env.HOME` at load time).
    // We assert behaviour against whatever HOME was at module init.
    const home = originalHome ?? '/Users/alice';
    const input = `cd ${home}/projects/han && ls`;
    const out = applyPrivacyFilter(input);
    if (home) {
      expect(out).not.toContain(home);
      expect(out).toContain('[HOME]');
    }
  });

  it('redacts /tmp/<uuid> paths', () => {
    const input = '/tmp/550e8400-e29b-41d4-a716-446655440000/cache';
    const out = applyPrivacyFilter(input);
    expect(out).not.toContain('550e8400-e29b-41d4-a716-446655440000');
    expect(out).toContain('/tmp/[UUID]');
  });

  it('handles multiple secrets in one line', () => {
    const input = 'sk-1234567890abcdefghij and AKIAIOSFODNN7EXAMPLE side by side';
    const out = applyPrivacyFilter(input);
    expect(out).not.toContain('sk-1234567890');
    expect(out).not.toContain('AKIAIOSFODNN7EXAMPLE');
    // both should be redacted; the `[REDACTED]` token should appear at least twice
    const redactedCount = (out.match(/\[REDACTED\]/g) ?? []).length;
    expect(redactedCount).toBeGreaterThanOrEqual(2);
  });

  it('handles multi-line input', () => {
    const input = `line 1: sk-aaaaaaaaaaaaaaaaaaaaaaaa
line 2: alice@example.com
line 3: normal text`;
    const out = applyPrivacyFilter(input);
    expect(out).not.toContain('sk-aaaaaaaaaaaa');
    expect(out).not.toContain('alice@example.com');
    expect(out).toContain('normal text');
  });

  it('preserves plain text without secrets', () => {
    const input = 'Compiling tokio v1.40.0\nCompiling serde v1.0.214\nFinished in 47.3s';
    expect(applyPrivacyFilter(input)).toBe(input);
  });

  it('does not falsely redact a cargo git hash (no sk- prefix)', () => {
    // 40-char hex hash that looks like a credential but is just a commit ref
    const input = 'rev = "a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4"';
    expect(applyPrivacyFilter(input)).toBe(input);
  });

  it('handles repeated calls without leaking regex lastIndex state', () => {
    const input = 'sk-1234567890abcdefghij';
    const first = applyPrivacyFilter(input);
    const second = applyPrivacyFilter(input);
    expect(first).toBe(second);
    expect(second).toContain('[REDACTED]');
  });
});
