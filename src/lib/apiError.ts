export function getApiErrorMessage(error: unknown, fallback: string) {
  const candidate = error as any;
  const message =
    candidate?.response?.data?.error?.message ??
    candidate?.response?.data?.message ??
    candidate?.error?.message ??
    candidate?.message;

  if (Array.isArray(message)) {
    return message.map(String).filter(Boolean).join(', ') || fallback;
  }

  return typeof message === 'string' && message.trim() ? message : fallback;
}
