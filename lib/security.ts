export function sanitizeHtml(input: string): string {
  if (!input) return '';
  return input
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<iframe[\s\S]*?>[\s\S]*?<\/iframe>/gi, '')
    .replace(/on[a-z]+\s*=\s*(['"]).*?\1/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/data:text\/html/gi, '');
}

export function sanitizeText(input: string, max = 5000): string {
  return (input || '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').slice(0, max).trim();
}
