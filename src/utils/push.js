// ============================================================
// QELCare Patient Mobile — Push notifications (FCM via Capacitor)
// ------------------------------------------------------------
// Registers the device with FCM, forwards the token to the backend
// (POST /notifications/device-token) so the server can push OS-level
// notifications, and routes a tapped notification to the right screen.
//
// No-ops on the web preview (only runs on a native device). Logout-time
// de-registration lives in utils/auth.js (avoids a circular import) and
// reads the token this module stores under FCM_TOKEN_KEY.
// ============================================================

import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { authFetch, isAuthenticated, FCM_TOKEN_KEY } from "./auth";

let listenersAdded = false;
let registering = false;

function isNative() {
  try {
    return Capacitor?.isNativePlatform?.() === true;
  } catch {
    return false;
  }
}

async function sendTokenToBackend(token) {
  if (!token) return;
  try {
    localStorage.setItem(FCM_TOKEN_KEY, token);
  } catch {
    /* storage may be unavailable */
  }
  try {
    await authFetch("/notifications/device-token", {
      method: "POST",
      body: JSON.stringify({ token, platform: Capacitor.getPlatform() }),
      // A 401 here should NOT bounce the user to login — registration is a
      // background nicety, not a user action.
      noAuthRedirect: true,
    });
  } catch (err) {
    console.warn("Push token registration failed:", err?.message || err);
  }
}

function addListeners() {
  if (listenersAdded) return;
  listenersAdded = true;

  // FCM handed us a token (fires on first register + on token refresh).
  PushNotifications.addListener("registration", (token) => {
    sendTokenToBackend(token?.value);
  });

  PushNotifications.addListener("registrationError", (err) => {
    console.warn("Push registration error:", err?.error || err);
  });

  // Foreground receipt: the OS won't auto-show a tray notification, so nudge the
  // in-app bell to refresh its unread list/count.
  PushNotifications.addListener("pushNotificationReceived", () => {
    try {
      window.dispatchEvent(new CustomEvent("qelcare:refresh-notifications"));
    } catch {
      /* ignore */
    }
  });

  // Tap on a delivered notification -> deep-link to the relevant screen.
  PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
    const link = action?.notification?.data?.link || "/patient/appointments";
    const target = String(link).startsWith("/") ? link : `/${link}`;
    try {
      window.location.hash = `#${target}`;
    } catch {
      /* ignore */
    }
  });
}

// Request permission (Android 13+ shows the POST_NOTIFICATIONS prompt) and
// register with FCM. Safe to call repeatedly and on every app start.
export async function initPush() {
  if (!isNative() || !isAuthenticated() || registering) return;
  registering = true;
  try {
    addListeners();

    let perm = await PushNotifications.checkPermissions();
    if (perm.receive === "prompt" || perm.receive === "prompt-with-rationale") {
      perm = await PushNotifications.requestPermissions();
    }
    if (perm.receive !== "granted") return;

    await PushNotifications.register();
  } catch (err) {
    // e.g. Firebase not configured yet (no google-services.json) -> stay silent
    // so the app keeps working; push simply activates once Firebase is wired.
    console.warn("initPush skipped:", err?.message || err);
  } finally {
    registering = false;
  }
}
