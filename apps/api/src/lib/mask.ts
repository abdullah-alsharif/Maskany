export function maskPhone(phone: string): string {
  const prefixLength = 4;
  const suffixLength = 4;
  if (phone.length <= prefixLength + suffixLength) {
    return '***';
  }
  return `${phone.slice(0, prefixLength)}***${phone.slice(-suffixLength)}`;
}

export function maskEmail(email: string): string {
  const atIndex = email.indexOf('@');
  if (atIndex <= 0) {
    return '***';
  }
  const firstLocalChar = email.charAt(0);
  const domain = email.slice(atIndex);
  return `${firstLocalChar}***${domain}`;
}
