// ============================================================
// QELCare Patient Mobile Auth Utilities
// ============================================================

// Resolve the backend base URL depending on WHERE the app is running, so the
// same build works in a desktop browser (npm run dev), the Android emulator,
// and a real device/deploy — without hand-editing .env each time.
function resolveApiUrl() {
  const configured = (import.meta.env?.VITE_API_URL || process.env.REACT_APP_API_URL || "").replace(/\/$/, "");
  const isNative = typeof window !== "undefined" && window.Capacitor?.isNativePlatform?.();

  // Native APK (emulator or device): use the configured URL. For the emulator
  // that is http://10.0.2.2:5001 (its alias for your PC's localhost); for a real
  // phone/deploy set VITE_API_URL to your LAN IP or HTTPS backend.
  if (isNative) return configured || "http://10.0.2.2:5001";

  // Desktop browser preview: talk to the backend on the SAME host that served
  // the page, on port 5001 (localhost:3000 -> localhost:5001). This is why the
  // browser preview no longer needs the emulator-only 10.0.2.2 address.
  if (typeof window !== "undefined" && window.location?.hostname) {
    const host = window.location.hostname;
    if (host && host !== "10.0.2.2") {
      return `${window.location.protocol}//${host}:5001`;
    }
  }

  return configured || "http://localhost:5001";
}

const API_URL = resolveApiUrl();

export const getToken = () => localStorage.getItem("token");
export const getUserRole = () => localStorage.getItem("role");
export const isAuthenticated = () => Boolean(getToken());

export const saveLoginData = (token, user = {}) => {
  localStorage.setItem("token", token);
  localStorage.setItem("role", user.role || "");
  localStorage.setItem("userId", user.user_id || user.id || "");
  localStorage.setItem("username", user.username || "");
  localStorage.setItem("user", JSON.stringify(user));
  localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now())); // start the idle clock at login
};

// ── Patient inactivity session timeout ────────────────────────
// This app is patient-only, so the timeout applies to the whole app. We still
// gate on isPatientSession() for safety + symmetry with the website.
export const PATIENT_IDLE_LIMIT_MS = 15 * 60 * 1000; // 15 minutes of inactivity
export const LAST_ACTIVITY_KEY = "qelcare_last_activity";
const SESSION_EXPIRED_KEY = "qelcare_session_expired";

// Where utils/push.js stores the current FCM device token so we can drop it
// server-side on logout (kept here to avoid a circular import with push.js).
export const FCM_TOKEN_KEY = "fcm_token";

export const isPatientSession = () => isAuthenticated() && getUserRole() === "Patient";

// Best-effort: tell the backend to stop pushing to this device. Must run BEFORE
// localStorage is cleared (needs both the auth token and the stored FCM token).
const deregisterPushToken = async () => {
  try {
    const fcmToken = localStorage.getItem(FCM_TOKEN_KEY);
    const token = getToken();
    if (fcmToken && token) {
      await fetch(`${API_URL}/notifications/device-token`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ token: fcmToken }),
      });
    }
  } catch {
    /* ignore network errors — we still clear locally */
  }
};

// Auto-logout on inactivity: best-effort server revoke, clear local state, flag the
// login screen, and return to #/login.
export const expireSession = async () => {
  const token = getToken();
  await deregisterPushToken();
  try {
    if (token) {
      await fetch(`${API_URL}/auth/logout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
    }
  } catch {
    /* ignore network errors — we still clear locally below */
  }
  localStorage.clear();
  sessionStorage.setItem(SESSION_EXPIRED_KEY, "1"); // survives localStorage.clear()
  goLogin();
};

// LoginScreen calls this once on mount: true if the previous logout was an
// inactivity timeout, then clears the one-shot flag.
export const consumeSessionExpired = () => {
  const flagged = sessionStorage.getItem(SESSION_EXPIRED_KEY) === "1";
  if (flagged) sessionStorage.removeItem(SESSION_EXPIRED_KEY);
  return flagged;
};

function goLogin() {
  window.location.hash = "#/login";
}

export const logout = async () => {
  try {
    const token = getToken();
    await deregisterPushToken();
    if (token) {
      await fetch(`${API_URL}/auth/logout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
    }
  } catch (err) {
    console.error("Logout error:", err);
  } finally {
    localStorage.clear();
    goLogin();
  }
};

export const getUserFromToken = () => {
  const token = getToken();
  if (!token) return null;
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => `%${("00" + c.charCodeAt(0).toString(16)).slice(-2)}`)
        .join("")
    );
    const decoded = JSON.parse(json);
    return decoded.user || decoded;
  } catch {
    return null;
  }
};

// A 401 normally means the token/session is invalid, so we force a re-login.
// Callers that pass { noAuthRedirect: true } opt out so an endpoint that legitimately
// answers 401 for a business reason surfaces the error instead of logging the user
// out. (The password-change form uses this so a wrong "current password" never kicks
// the patient back to the login screen.)
export const authFetch = async (url, options = {}) => {
  const { noAuthRedirect = false, ...fetchOptions } = options;
  const token = getToken();
  const headers = { ...(fetchOptions.headers || {}) };
  const isFormData = typeof FormData !== "undefined" && fetchOptions.body instanceof FormData;

  if (!isFormData && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${API_URL}${url}`, {
    ...fetchOptions,
    headers,
  });

  if (response.status === 401 && !noAuthRedirect) {
    localStorage.clear();
    goLogin();
    return response;
  }

  return response;
};

export { API_URL };
