import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, X } from "lucide-react";
import { authFetch } from "../../utils/auth";

// Mirrors the website's Topbar notification bell (features/notification API:
// GET /notifications/me, PATCH /notifications/:id/read, PATCH /notifications/read-all),
// re-styled as a mobile-friendly top-anchored panel. Patient-only, so appointment
// notifications always route to the patient appointments page.

function getRows(payload) {
  if (!payload) return [];
  if (Array.isArray(payload.notifications)) return payload.notifications;
  if (Array.isArray(payload.data)) return payload.data;
  return [];
}

async function safeJson(response) {
  try {
    return response ? await response.json() : null;
  } catch {
    return null;
  }
}

function formatStamp(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-PH", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function resolveLink(item) {
  const link = item?.link || "";
  const isAppointment = Boolean(item?.appointment_id) || /\/appointments(\/|\?|$)/.test(link);
  if (isAppointment) return "/patient/appointments";
  if (/^\/(patient|dashboard)/.test(link)) return link;
  return "/dashboard";
}

export default function NotificationBell() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError("");
    try {
      const response = await authFetch("/notifications/me?limit=30");
      const payload = await safeJson(response);
      if (!response?.ok) throw new Error(payload?.message || "Notifications unavailable.");
      setItems(getRows(payload));
      setUnread(Number(payload?.unread_count || 0));
    } catch (err) {
      if (!silent) setError(err.message || "Notifications unavailable.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  // Poll quietly while the app tab is visible, matching the website's 60s cadence.
  // Also refresh immediately when a push arrives in the foreground (utils/push.js
  // dispatches this event, since the OS won't show a tray notification then).
  useEffect(() => {
    load();
    const timer = setInterval(() => {
      if (typeof document === "undefined" || document.visibilityState === "visible") load(true);
    }, 60000);
    const onPush = () => load(true);
    window.addEventListener("qelcare:refresh-notifications", onPush);
    return () => {
      clearInterval(timer);
      window.removeEventListener("qelcare:refresh-notifications", onPush);
    };
  }, [load]);

  async function openItem(item) {
    if (!item?.id) return;
    if (!item.is_read) {
      try {
        const response = await authFetch(`/notifications/${item.id}/read`, { method: "PATCH" });
        const payload = await safeJson(response);
        if (response?.ok) {
          setUnread(Number(payload?.unread_count ?? Math.max(unread - 1, 0)));
          setItems((current) => current.map((n) => (n.id === item.id ? { ...n, is_read: true } : n)));
        }
      } catch {
        setItems((current) => current.map((n) => (n.id === item.id ? { ...n, is_read: true } : n)));
        setUnread((count) => Math.max(count - 1, 0));
      }
    }
    setOpen(false);
    const target = resolveLink(item);
    if (target) navigate(target);
  }

  async function markAllRead() {
    try {
      const response = await authFetch("/notifications/read-all", { method: "PATCH" });
      if (response?.ok) {
        setUnread(0);
        setItems((current) => current.map((n) => ({ ...n, is_read: true })));
      }
    } catch {
      setError("Unable to mark all notifications read.");
    }
  }

  const visible = items.filter((n) => !n.is_read);

  return (
    <>
      <button
        type="button"
        className="notif-bell"
        onClick={() => { setOpen(true); load(true); }}
        aria-label={`Notifications${unread ? ` (${unread} unread)` : ""}`}
      >
        <Bell size={20} strokeWidth={2} aria-hidden="true" />
        {unread > 0 && <span className="notif-badge">{unread > 9 ? "9+" : unread}</span>}
      </button>

      {open && (
        <div className="notif-overlay" onClick={() => setOpen(false)}>
          <div className="notif-panel" onClick={(event) => event.stopPropagation()}>
            <div className="notif-head">
              <div>
                <div className="notif-title">Notifications</div>
                <div className="notif-sub">{unread} unread</div>
              </div>
              <div className="notif-head-actions">
                <button type="button" onClick={markAllRead} disabled={unread === 0}>Read all</button>
                <button type="button" className="notif-close" onClick={() => setOpen(false)} aria-label="Close">
                  <X size={15} strokeWidth={2.4} aria-hidden="true" />
                </button>
              </div>
            </div>

            {error && <div className="notif-error">{error}</div>}

            <div className="notif-list">
              {loading && items.length === 0 ? (
                <div className="notif-empty">Loading notifications…</div>
              ) : visible.length === 0 ? (
                <div className="notif-empty">You’re all caught up.</div>
              ) : (
                visible.map((item) => (
                  <button key={item.id} type="button" className="notif-item" onClick={() => openItem(item)}>
                    <span className="notif-dot" />
                    <span className="notif-body">
                      <span className="notif-item-title">{item.title}</span>
                      <span className="notif-item-msg">{item.message}</span>
                      <span className="notif-item-time">{formatStamp(item.created_at)}</span>
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`
.notif-bell {
  position: relative;
  width: 42px; height: 42px;
  border: 0; border-radius: 14px;
  background: #eef4fb; color: #163a6b;
  display: grid; place-items: center;
  cursor: pointer; flex: 0 0 auto;
}
.notif-badge {
  position: absolute; top: 3px; right: 3px;
  min-width: 17px; height: 17px; padding: 0 4px;
  border-radius: 999px; background: #d0433f; color: #fff;
  font-size: 10px; font-weight: 800;
  display: grid; place-items: center;
  border: 2px solid #eef4fb;
}
.notif-overlay {
  position: fixed; inset: 0; z-index: 60;
  background: rgba(8,18,33,.42);
  display: flex; justify-content: flex-end; align-items: flex-start;
}
.notif-panel {
  width: min(420px, calc(100% - 16px));
  max-height: 78vh;
  margin: calc(env(safe-area-inset-top) + 60px) 8px 8px;
  background: #fff; border-radius: 16px;
  border: 1px solid #e3ebf5;
  box-shadow: 0 18px 44px rgba(15,35,64,.24);
  display: flex; flex-direction: column; overflow: hidden;
}
.notif-head {
  flex-shrink: 0;
  display: flex; align-items: center; justify-content: space-between; gap: 10px;
  padding: 14px 16px; border-bottom: 1px solid #eef3f9;
}
.notif-title { font-size: 15px; font-weight: 900; color: #0f2744; }
.notif-sub { font-size: 12px; color: #8a97a8; margin-top: 2px; }
.notif-head-actions { display: flex; align-items: center; gap: 8px; }
.notif-head-actions button {
  min-height: 34px; border-radius: 9px;
  border: 1px solid #e3ebf5; background: #fff; color: #163a6b;
  padding: 0 10px; font-weight: 800; font-size: 12px; cursor: pointer;
  font-family: inherit;
}
.notif-head-actions button:disabled { opacity: .5; }
.notif-close { width: 34px; padding: 0 !important; display: grid; place-items: center; }
.notif-error {
  margin: 10px 14px; padding: 8px 10px; border-radius: 8px;
  background: #fff6e5; color: #8a5a12; font-size: 12px; font-weight: 700;
}
.notif-list { overflow-y: auto; padding: 6px; }
.notif-empty { padding: 22px 16px; color: #66778a; font-size: 13px; text-align: center; }
.notif-item {
  width: 100%; border: 0; background: transparent;
  display: grid; grid-template-columns: 12px 1fr; gap: 10px;
  text-align: left; padding: 12px; border-radius: 10px; cursor: pointer;
  font-family: inherit;
}
.notif-item:active { background: #f6f9ff; }
.notif-dot { width: 9px; height: 9px; border-radius: 50%; background: #163a6b; margin-top: 5px; }
.notif-body { min-width: 0; }
.notif-item-title { display: block; font-size: 13.5px; font-weight: 900; color: #0f2744; }
.notif-item-msg { display: block; font-size: 12.5px; color: #5c6c81; line-height: 1.45; margin-top: 3px; overflow-wrap: anywhere; }
.notif-item-time { display: block; font-size: 11px; color: #9aa8ba; font-weight: 800; margin-top: 6px; }
      `}</style>
    </>
  );
}
