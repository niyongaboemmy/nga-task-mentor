/**
 * What to tell someone whose code run failed, from the server's answer.
 * Always the server's own message when it sent one; never axios's
 * "Request failed with status code 500".
 */
const BY_CODE: Record<string, string> = {
  RATE_LIMITED: "You've run code many times in a minute. Wait a moment, then run again.",
  QUOTA_EXCEEDED: "The code runner has reached its limit for now. Try again later, or tell your teacher.",
  JUDGE_UNAVAILABLE: "The code runner is busy or offline. Your work is saved; try again in a moment.",
  INPUT_TOO_LARGE: "The input is too large (64 KB at most).",
};

export function runErrorMessage(err: unknown, fallback = "The code couldn't be run. Try again."): string {
  const e = err as {
    code?: string;
    message?: string;
    response?: { status?: number; data?: { code?: string; error_code?: string; message?: string } };
  };
  const data = e?.response?.data;
  const code = data?.code || data?.error_code;
  if (code && BY_CODE[code]) return BY_CODE[code];
  if (data?.message) return data.message;
  if (e?.code === "ECONNABORTED") return "The code runner took too long to answer. Try again.";
  if (!e?.response) return "Can't reach Task Mentor. Check your connection and try again.";
  return fallback;
}
