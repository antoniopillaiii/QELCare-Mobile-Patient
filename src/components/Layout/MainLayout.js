import React, { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { logout } from "../../utils/auth";
import NotificationBell from "./NotificationBell";

// `label` is the full name shown in the drawer + page headings — it matches the
// website's menu wording so both platforms use one vocabulary. `short` is the
// compact version for the 5-item bottom tab bar, where long text would overflow.
const navItems = [
  { label: "Dashboard", short: "Home", path: "/dashboard", icon: "⌂" },
  { label: "Appointments", short: "Appointments", path: "/patient/appointments", icon: "▣" },
  { label: "Consultation Records", short: "Records", path: "/patient/records", icon: "▤" },
  { label: "Health Records", short: "Health", path: "/patient/health", icon: "✚" },
  { label: "Profile Settings", short: "Profile", path: "/patient/profile", icon: "●" },
];

function getStoredUser() {
  try {
    const raw = localStorage.getItem("user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function fullName(user) {
  return [user?.first_name, user?.last_name].filter(Boolean).join(" ").trim() || user?.username || "Patient";
}

function initials(name) {
  const parts = String(name || "PT").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0]?.[0] || "P"}${parts[parts.length - 1]?.[0] || "T"}`.toUpperCase();
}

function isActive(pathname, itemPath) {
  if (itemPath === "/dashboard") return pathname === "/dashboard";
  return pathname === itemPath || pathname.startsWith(`${itemPath}/`);
}

export default function MainLayout({ children, pageTitle = "QELCare Patient", pageSubtitle = "Patient portal" }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const user = useMemo(() => getStoredUser(), []);
  const name = fullName(user);

  const go = (path) => {
    setDrawerOpen(false);
    navigate(path);
  };

  return (
    <div className="mobile-shell">
      <style>{layoutCss}</style>

      <aside className={`patient-drawer ${drawerOpen ? "open" : ""}`} aria-label="Patient navigation">
        <div className="brand-card">
          <div className="brand-mark">Q+</div>
          <div>
            <div className="brand-title">QELCare</div>
            <div className="brand-subtitle">Patient APK</div>
          </div>
        </div>

        <nav className="drawer-nav">
          {navItems.map((item) => (
            <button
              key={item.path}
              type="button"
              className={`drawer-link ${isActive(location.pathname, item.path) ? "active" : ""}`}
              onClick={() => go(item.path)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <button type="button" className="logout-button" onClick={logout}>Sign Out</button>
      </aside>

      {drawerOpen && <button type="button" className="drawer-backdrop" aria-label="Close navigation" onClick={() => setDrawerOpen(false)} />}

      <div className="patient-main">
        <header className="patient-topbar">
          <button type="button" className="menu-button" onClick={() => setDrawerOpen(true)} aria-label="Open navigation">☰</button>
          <div className="topbar-title-wrap">
            <h1>{pageTitle}</h1>
            <p>{pageSubtitle}</p>
          </div>
          <div className="topbar-actions">
            <NotificationBell />
            <button type="button" className="avatar-button" onClick={() => go("/patient/profile")} aria-label="Open profile">
              {initials(name)}
            </button>
          </div>
        </header>

        <main className="patient-content">{children}</main>

        <nav className="bottom-nav" aria-label="Bottom patient navigation">
          {navItems.slice(0, 5).map((item) => (
            <button
              key={item.path}
              type="button"
              className={`bottom-link ${isActive(location.pathname, item.path) ? "active" : ""}`}
              onClick={() => go(item.path)}
            >
              <span>{item.icon}</span>
              <small>{item.short || item.label}</small>
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}

const layoutCss = `
.mobile-shell {
  min-height: 100vh;
  background: #eef4fb;
  color: #162235;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
.patient-drawer {
  position: fixed;
  inset: 0 auto 0 0;
  width: 282px;
  background: linear-gradient(180deg, #0e2340 0%, #163a6b 100%);
  color: #fff;
  z-index: 30;
  transform: translateX(-100%);
  transition: transform .2s ease;
  display: flex;
  flex-direction: column;
  /* Bottom padding clears the phone's on-screen navigation bar (gesture pill or
     3-button nav) so the Logout button never sits under it. Falls back to 16px
     on devices/desktop with no bottom inset. */
  padding: max(16px, env(safe-area-inset-top)) 14px calc(16px + env(safe-area-inset-bottom));
  box-shadow: 18px 0 45px rgba(15, 35, 64, .24);
}
.patient-drawer.open { transform: translateX(0); }
.drawer-backdrop {
  position: fixed;
  inset: 0;
  z-index: 20;
  border: 0;
  background: rgba(5, 12, 23, .46);
}
.brand-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 10px 18px;
  border-bottom: 1px solid rgba(255,255,255,.12);
}
.brand-mark {
  width: 42px;
  height: 42px;
  border-radius: 14px;
  background: rgba(255,255,255,.12);
  border: 1px solid rgba(255,255,255,.18);
  display: grid;
  place-items: center;
  font-weight: 950;
}
.brand-title { font-weight: 950; letter-spacing: .02em; }
.brand-subtitle { color: rgba(255,255,255,.64); font-size: 12px; margin-top: 2px; }
.drawer-nav {
  display: grid;
  gap: 8px;
  padding: 16px 0;
  flex: 1;
  overflow: auto;
}
.drawer-link,
.logout-button {
  width: 100%;
  min-height: 44px;
  border: 0;
  border-radius: 13px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 12px;
  font: inherit;
  font-weight: 850;
  text-align: left;
  cursor: pointer;
}
.drawer-link {
  color: rgba(255,255,255,.78);
  background: transparent;
}
.drawer-link.active,
.drawer-link:hover {
  color: #fff;
  background: rgba(255,255,255,.13);
}
.nav-icon {
  width: 26px;
  height: 26px;
  border-radius: 9px;
  display: grid;
  place-items: center;
  background: rgba(255,255,255,.1);
  font-weight: 950;
  font-size: 12px;
}
.logout-button {
  justify-content: center;
  background: rgba(255, 112, 112, .14);
  color: #ffb3b3;
}
.patient-main {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}
.patient-topbar {
  position: sticky;
  top: 0;
  z-index: 10;
  min-height: 72px;
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  padding: max(10px, env(safe-area-inset-top)) 14px 10px;
  background: rgba(255,255,255,.92);
  backdrop-filter: blur(14px);
  border-bottom: 1px solid #dfe8f4;
}
.topbar-actions { display: flex; align-items: center; gap: 8px; justify-self: end; }
.menu-button,
.avatar-button {
  width: 42px;
  height: 42px;
  border: 0;
  border-radius: 14px;
  background: #eef4fb;
  color: #163a6b;
  font: inherit;
  font-weight: 950;
  cursor: pointer;
}
.avatar-button {
  background: linear-gradient(135deg, #163a6b, #0e8a7a);
  color: #fff;
  font-size: 12px;
}
.topbar-title-wrap { min-width: 0; }
.topbar-title-wrap h1 {
  margin: 0;
  color: #102f57;
  font-size: clamp(17px, 4.2vw, 24px);
  line-height: 1.1;
  font-weight: 950;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.topbar-title-wrap p {
  margin: 4px 0 0;
  color: #66758a;
  font-size: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.patient-content {
  flex: 1;
  width: min(100%, 1180px);
  margin: 0 auto;
  padding: 16px 14px calc(96px + env(safe-area-inset-bottom));
}
.bottom-nav {
  position: fixed;
  z-index: 15;
  left: 10px;
  right: 10px;
  bottom: max(10px, env(safe-area-inset-bottom));
  min-height: 62px;
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 2px;
  padding: 7px 5px;
  border-radius: 22px;
  border: 1px solid rgba(210, 222, 236, .94);
  background: rgba(255,255,255,.96);
  box-shadow: 0 18px 38px rgba(15, 35, 64, .18);
  backdrop-filter: blur(18px);
}
.bottom-link {
  border: 0;
  border-radius: 16px;
  background: transparent;
  color: #6b778c;
  font: inherit;
  font-weight: 900;
  display: grid;
  gap: 1px;
  place-items: center;
  cursor: pointer;
  min-width: 0;
}
.bottom-link span { font-size: 15px; line-height: 1; }
.bottom-link small { font-size: 9px; line-height: 1.1; letter-spacing: -0.1px; white-space: nowrap; }
.bottom-link.active {
  color: #163a6b;
  background: #eaf1ff;
}
@media (min-width: 980px) {
  .mobile-shell { display: grid; grid-template-columns: 282px minmax(0, 1fr); }
  .patient-drawer { position: sticky; transform: none; height: 100vh; }
  .drawer-backdrop, .menu-button, .bottom-nav { display: none; }
  .patient-topbar { grid-template-columns: minmax(0,1fr) 44px; padding-left: 24px; padding-right: 24px; }
  .patient-content { padding: 22px 24px 38px; }
}
`;
