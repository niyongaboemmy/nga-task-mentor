import api from "./axiosConfig";

/**
 * Credentials for the live proctoring server (VITE_SOCKET_URL).
 *
 * The live-server rejects unauthenticated sockets. We first ask the API for a
 * short-lived live ticket (GET /api/proctoring/live-ticket), which also tells
 * the live-server whether this user may act as a proctor. If that request
 * fails we fall back to the session JWT, which still authenticates the socket
 * but only with student-level rights.
 */
export const fetchLiveSocketToken = async (): Promise<string | null> => {
  try {
    const res = await api.get("/proctoring/live-ticket");
    if (res.data?.ticket) return res.data.ticket as string;
  } catch (error) {
    console.warn("Could not obtain live proctoring ticket:", error);
  }
  return localStorage.getItem("tm_auth_token");
};

/**
 * Pass as the socket.io-client `auth` option. Socket.IO calls it on every
 * (re)connection attempt, so each handshake gets a fresh ticket.
 */
export const liveSocketAuth = (cb: (data: object) => void): void => {
  fetchLiveSocketToken().then(
    (token) => cb(token ? { token } : {}),
    () => cb({}),
  );
};

/** Authorization header for plain HTTP calls to the live-server. */
export const liveServerAuthHeaders = (): Record<string, string> => {
  const token = localStorage.getItem("tm_auth_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};
