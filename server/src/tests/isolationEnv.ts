/**
 * Imported FIRST by the cross-school specs: every outbound call (MIS, file
 * server, judge, AI providers) goes to a closed local port or has no key, so
 * a run can never reach a real MIS, a paid API or production, whatever
 * server/.env says.
 */
import "dotenv/config";

const CLOSED = "http://127.0.0.1:9";
for (const k of ["NGA_MIS_BASE_URL", "MIS_API_URL", "FILE_SERVER_URL", "TMJUDGE_URL", "DEEPSEEK_BASE_URL", "OPENROUTER_BASE_URL"]) {
  process.env[k] = CLOSED;
}
for (const k of Object.keys(process.env)) {
  if (/_API_KEY$/.test(k)) process.env[k] = "";
}

export const CLOSED_PORT_URL = CLOSED;
