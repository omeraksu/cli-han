export const BUILTIN_PATTERNS: RegExp[] = [
  /(sk-[A-Za-z0-9]{20,})/g,
  /(AKIA[0-9A-Z]{16})/g,
  /(ghp_[A-Za-z0-9]{36})/g,
  /(xoxb-[A-Za-z0-9-]+)/g,
  /(sk-ant-[A-Za-z0-9-]+)/g,
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
  /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g,
];

const HOME = process.env['HOME'] ?? '';

export function applyPrivacyFilter(text: string): string {
  let result = text;

  for (const pattern of BUILTIN_PATTERNS) {
    // Reset lastIndex since patterns have the /g flag
    pattern.lastIndex = 0;
    result = result.replace(pattern, '[REDACTED]');
  }

  if (HOME) {
    result = result.split(HOME).join('[HOME]');
  }

  // /tmp/ + UUID pattern (e.g. /tmp/abc123de-...)
  result = result.replace(
    /\/tmp\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
    '/tmp/[UUID]',
  );

  return result;
}
