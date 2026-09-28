import React, { useCallback, useEffect, useMemo, useState } from "react";
import { authFetch, logout } from "../../utils/auth";
import MainLayout from "../Layout/MainLayout";
import { EmptyState, LoadingState } from "../Workflow/ClinicUi";
import { ageFromBirthDate } from "../../utils/manilaDate";

const blankForm = {
  username: "",
  first_name: "",
  last_name: "",
  middle_name: "",
  suffix: "",
  email: "",
  phone: "",
  alternate_phone: "",
  gender: "",
  date_of_birth: "",
  address_line: "",
};

const FIELD_LIMITS = {
  username: 50,
  email: 100,
  first_name: 50,
  last_name: 50,
  middle_name: 50,
  suffix: 10,
  phone: 20,
  alternate_phone: 20,
};

function lengthError(label, value, max) {
  return String(value || "").length > max ? `${label} must be ${max} characters or less.` : "";
}

function validateProfileForm(form) {
  const checks = [
    ["Username", form.username, FIELD_LIMITS.username],
    ["Email", form.email, FIELD_LIMITS.email],
    ["First name", form.first_name, FIELD_LIMITS.first_name],
    ["Last name", form.last_name, FIELD_LIMITS.last_name],
    ["Middle name", form.middle_name, FIELD_LIMITS.middle_name],
    ["Suffix", form.suffix, FIELD_LIMITS.suffix],
    ["Phone", form.phone, FIELD_LIMITS.phone],
    ["Alternate phone", form.alternate_phone, FIELD_LIMITS.alternate_phone],
  ];
  for (const [label, value, max] of checks) {
    const error = lengthError(label, value, max);
    if (error) return error;
  }
  if (form.username && !/^[a-zA-Z0-9._-]{3,50}$/.test(form.username.trim())) {
    return "Username must be 3-50 characters and may contain letters, numbers, dot, underscore, or hyphen.";
  }
  if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
    return "Enter a valid email address.";
  }
  // Phone FORMAT (matches the backend + registration): PH mobile 09XXXXXXXXX,
  // +639XXXXXXXXX, or international +<10-14 digits>. Optional -> empty passes.
  const phoneOk = (value) => {
    const cleaned = String(value || "").trim().replace(/[\s\-()]/g, "");
    return !cleaned || /^(09\d{9}|\+639\d{9}|\+\d{10,14})$/.test(cleaned);
  };
  if (!phoneOk(form.phone)) return "Enter a valid phone, e.g. 09XXXXXXXXX or +639XXXXXXXXX.";
  if (!phoneOk(form.alternate_phone)) return "Enter a valid alternate phone, e.g. 09XXXXXXXXX or +639XXXXXXXXX.";
  return "";
}

function nameFrom(profile, patient) {
  return [
    profile?.first_name || patient?.first_name,
    profile?.middle_name || patient?.middle_name,
    profile?.last_name || patient?.last_name,
    profile?.suffix || patient?.suffix,
  ].filter(Boolean).join(" ").trim() || patient?.display_name || patient?.name || "Patient";
}

function initials(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "PT";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

// Age as of the clinic's day (Asia/Manila), whatever the phone's time zone.
function ageFrom(dateOfBirth) {
  const age = ageFromBirthDate(dateOfBirth);
  return age !== null && age >= 0 ? `${age} years old` : "";
}

function makeForm(profile, patient) {
  return {
    username: profile?.username || "",
    first_name: profile?.first_name || patient?.first_name || "",
    last_name: profile?.last_name || patient?.last_name || "",
    middle_name: profile?.middle_name || patient?.middle_name || "",
    suffix: profile?.suffix || patient?.suffix || "",
    email: profile?.email || patient?.email || patient?.user_email || "",
    phone: profile?.phone || patient?.phone || patient?.contact || "",
    alternate_phone: profile?.alternate_phone || "",
    gender: profile?.gender || patient?.gender || "",
    date_of_birth: String(profile?.date_of_birth || patient?.date_of_birth || "").slice(0, 10),
    address_line: profile?.address_line || patient?.address || "",
  };
}

function changedContactFields(form, profile) {
  const fields = ["username", "email", "phone", "alternate_phone", "address_line"];
  return fields.filter((field) => String(form[field] || "").trim() !== String(profile?.[field] || "").trim());
}

// New styled field wrapper (label + control) matching the redesigned web profile.
function Field({ label, required = false, wide = false, children }) {
  return (
    <label className={`ps-field${wide ? " ps-col-2" : ""}`}>
      <span className="lbl">
        {label}
        {required && <span className="req">*</span>}
      </span>
      <div className="ps-control">{children}</div>
    </label>
  );
}

const SECTION_ICONS = {
  identity: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="12" cy="10" r="2.5" />
      <path d="M8.5 16a3.5 3.5 0 0 1 7 0" />
    </svg>
  ),
  contact: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m4 7 8 6 8-6" />
    </svg>
  ),
  address: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  ),
};

function SectionHead({ icon, title }) {
  return (
    <div className="ps-section-head">
      <span className="ps-sdot">{SECTION_ICONS[icon]}</span>
      <h4>{title}</h4>
    </div>
  );
}

// Same 5 password rules the website enforces (features/auth changePassword).
const PW_RULES = [
  { key: "length", label: "8+ characters" },
  { key: "uppercase", label: "Uppercase" },
  { key: "lowercase", label: "Lowercase" },
  { key: "number", label: "Number" },
  { key: "special", label: "Special (@$!%*?&#)" },
];
function passwordChecks(password) {
  return {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /\d/.test(password),
    special: /[@$!%*?&#]/.test(password),
  };
}

export default function ProfileScreen() {
  const [profile, setProfile] = useState(null);
  const [patient, setPatient] = useState(null);
  const [form, setForm] = useState(blankForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [uploading, setUploading] = useState(false);
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [showPw, setShowPw] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState("");
  const [pwMsg, setPwMsg] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const [profileRes, patientRes] = await Promise.all([
        authFetch("/users/me"),
        authFetch("/patients/me"),
      ]);

      const profilePayload = await profileRes.json();
      const patientPayload = await patientRes.json();

      if (!profileRes.ok) throw new Error(profilePayload.message || "Failed to load account profile.");
      if (!patientRes.ok) throw new Error(patientPayload.message || "Failed to load patient profile.");

      const profileData = profilePayload.data || profilePayload.user || profilePayload.profile;
      const patientData = patientPayload.patient || patientPayload.data;

      setProfile(profileData);
      setPatient(patientData);
      setForm(makeForm(profileData, patientData));
      setOtpSent(false);
      setOtpVerified(false);
      setOtpCode("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const displayName = useMemo(() => nameFrom(profile, patient), [profile, patient]);
  const ageLabel = useMemo(() => ageFrom(form.date_of_birth || patient?.date_of_birth), [form.date_of_birth, patient]);
  const needsOtp = useMemo(() => changedContactFields(form, profile).length > 0, [form, profile]);
  const canSave = !saving && (!needsOtp || otpVerified);
  const statusValue = profile?.status || "unknown";
  const statusOk = String(statusValue).toLowerCase() === "verified";
  const hasPhoto = Boolean(profile?.profile_picture);

  function updateField(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
    if (["username", "email", "phone", "alternate_phone", "address_line"].includes(name)) {
      setOtpVerified(false);
    }
  }

  async function sendOtp() {
    const email = profile?.email || form.email;
    if (!email) {
      setError("Your current email is required before OTP can be sent.");
      return;
    }

    setOtpSending(true);
    setError("");
    setMessage("");
    try {
      const response = await authFetch("/auth/patient/profile/otp", {
        method: "POST",
      });
      const payload = await response.json();
      if (!response.ok || payload.success === false) throw new Error(payload.message || "Failed to send OTP.");
      setOtpSent(true);
      setMessage(`Verification code sent to ${email}. Enter it before saving contact changes.`);
    } catch (err) {
      setError(err.message || "Failed to send OTP.");
    } finally {
      setOtpSending(false);
    }
  }

  async function verifyOtp() {
    const email = profile?.email || form.email;
    if (!/^\d{6}$/.test(otpCode)) {
      setError("Enter the 6-digit OTP code.");
      return;
    }

    setOtpVerifying(true);
    setError("");
    setMessage("");
    try {
      const response = await authFetch("/auth/patient/profile/otp/check", {
        method: "POST",
        body: JSON.stringify({ code: otpCode }),
      });
      const payload = await response.json();
      if (!response.ok || payload.success === false) throw new Error(payload.message || "OTP verification failed.");
      setOtpVerified(true);
      setMessage("OTP verified. You can now save your profile changes.");
    } catch (err) {
      setOtpVerified(false);
      setError(err.message || "OTP verification failed.");
    } finally {
      setOtpVerifying(false);
    }
  }

  async function save(event) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!form.first_name.trim() || !form.last_name.trim()) {
      setError("First name and last name are required.");
      return;
    }
    const validationError = validateProfileForm(form);
    if (validationError) {
      setError(validationError);
      return;
    }
    if (needsOtp && !otpVerified) {
      setError("Please verify the OTP before saving username, email, phone, or address changes.");
      return;
    }

    setSaving(true);
    try {
      const response = await authFetch("/auth/patient/profile", {
        method: "PUT",
        body: JSON.stringify({
          username: form.username.trim(),
          first_name: form.first_name.trim(),
          last_name: form.last_name.trim(),
          middle_name: form.middle_name.trim(),
          suffix: form.suffix.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          alternate_phone: form.alternate_phone.trim(),
          gender: form.gender,
          date_of_birth: form.date_of_birth || null,
          address_line: form.address_line.trim(),
          otp_code: needsOtp ? otpCode : undefined,
        }),
      });

      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || "Failed to update profile.");
      if (payload.changed === false) {
        setMessage(payload.message || "No changes to save.");
        return;
      }

      const updatedProfile = payload.data || payload.profile || payload.user;
      setProfile(updatedProfile);
      setForm((current) => makeForm(updatedProfile, { ...patient, ...current }));

      const storedUser = localStorage.getItem("user");
      if (storedUser) {
        try {
          const user = JSON.parse(storedUser);
          localStorage.setItem("user", JSON.stringify({ ...user, ...updatedProfile }));
          if (updatedProfile?.username) localStorage.setItem("username", updatedProfile.username);
        } catch {
          // Ignore invalid localStorage data.
        }
      }

      setOtpSent(false);
      setOtpVerified(false);
      setOtpCode("");
      setMessage("Profile updated. Your account and linked patient profile are synced.");
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  // --- Profile photo upload (matches the website's /users/profile-picture) ---
  async function uploadPicture(event) {
    const file = event.target.files?.[0];
    event.target.value = ""; // let the same file be re-picked after an error
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setError("Only JPG, PNG, and WEBP images are allowed.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Profile image must be 5MB or smaller.");
      return;
    }
    setUploading(true);
    setError("");
    setMessage("");
    try {
      const body = new FormData();
      body.append("profilePicture", file);
      const response = await authFetch("/users/profile-picture", { method: "POST", body });
      const payload = await response.json();
      if (!response.ok || payload.success === false) throw new Error(payload.message || "Upload failed.");
      const url = payload.url || payload.data?.profile_picture;
      setProfile((current) => ({ ...current, profile_picture: url }));
      const storedUser = localStorage.getItem("user");
      if (storedUser) {
        try {
          localStorage.setItem("user", JSON.stringify({ ...JSON.parse(storedUser), profile_picture: url }));
        } catch { /* ignore */ }
      }
      setMessage("Profile photo updated.");
      await load();
    } catch (err) {
      setError(err.message || "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  // --- In-app password change (matches the website's Security tab) -----------
  async function changePassword() {
    if (pwSaving) return;
    if (!pw.current) { setPwError("Current password is required."); return; }
    if (!Object.values(passwordChecks(pw.next)).every(Boolean)) {
      setPwError("New password does not meet all requirements.");
      return;
    }
    if (pw.next !== pw.confirm) { setPwError("New password and confirmation do not match."); return; }
    setPwSaving(true);
    setPwError("");
    setPwMsg("");
    try {
      const response = await authFetch("/auth/password/change", {
        method: "POST",
        // Don't let a business 401 (e.g. wrong current password) trigger the global
        // auth-expiry redirect — show the error and keep the patient on this screen.
        noAuthRedirect: true,
        body: JSON.stringify({ currentPassword: pw.current, newPassword: pw.next }),
      });
      const payload = await response.json();
      if (!response.ok || payload.success === false) throw new Error(payload.message || "Password change failed.");
      // Only reached when the current password verified AND the new hash was saved.
      setPwMsg("Password changed. Signing you out...");
      setTimeout(() => logout(), 1400);
    } catch (err) {
      setPwError(err.message || "Password change failed.");
    } finally {
      setPwSaving(false);
    }
  }

  return (
    <MainLayout pageTitle="Profile Settings" pageSubtitle="Edit account and contact details with OTP verification">
      <div className="ps-page">
        {error && (
          <div className="ps-toast error">
            <span className="ps-toast-dot" />
            {error}
          </div>
        )}
        {message && (
          <div className="ps-toast success">
            <span className="ps-toast-dot" />
            {message}
          </div>
        )}

        {loading ? (
          <LoadingState label="Loading profile..." />
        ) : !profile || !patient ? (
          <EmptyState title="Profile not available" detail="Please refresh or contact the clinic if this continues." />
        ) : (
          <>
            {/* Hero */}
            <section className="ps-card ps-hero">
              <div className="ps-hero-cover" />
              <div className="ps-hero-body">
                <div className="ps-id">
                  <label className={`ps-avatar ps-avatar-edit${hasPhoto ? " has-img" : ""}`} title="Change photo">
                    {hasPhoto ? (
                      <img src={profile.profile_picture} alt={displayName} />
                    ) : (
                      <span>{initials(displayName)}</span>
                    )}
                    <span className="ps-avatar-cam">{uploading ? "…" : "✎"}</span>
                    <input type="file" accept="image/png,image/jpeg,image/webp" onChange={uploadPicture} disabled={uploading} hidden />
                  </label>
                  <div className="ps-idtext">
                    <h2>{displayName}</h2>
                    <div className="ps-email">{form.email || "No email recorded"}</div>
                    <div className="ps-chips">
                      <span className="role">Patient #{patient.id}</span>
                      <span className={`status ${statusOk ? "ok" : "warn"}`}>{statusValue}</span>
                      {ageLabel && <span className="extra">{ageLabel}</span>}
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="ps-card ps-panel">
              <div className="ps-panel-head">
                <div className="ps-htitle">
                  <span className="ps-hicon">
                    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                  </span>
                  <div>
                    <h3>Personal Information</h3>
                    <p>OTP is required before saving username, email, phone, or address changes.</p>
                  </div>
                </div>
              </div>

              <form onSubmit={save} className="ps-body">
                <div className="ps-section">
                  <SectionHead icon="identity" title="Identity" />
                  <div className="ps-grid">
                    <Field label="First Name" required>
                      <input value={form.first_name} maxLength={FIELD_LIMITS.first_name} autoComplete="given-name" onChange={(event) => updateField("first_name", event.target.value)} />
                    </Field>
                    <Field label="Last Name" required>
                      <input value={form.last_name} maxLength={FIELD_LIMITS.last_name} autoComplete="family-name" onChange={(event) => updateField("last_name", event.target.value)} />
                    </Field>
                    <Field label="Middle Name">
                      <input value={form.middle_name} maxLength={FIELD_LIMITS.middle_name} autoComplete="additional-name" onChange={(event) => updateField("middle_name", event.target.value)} />
                    </Field>
                    <Field label="Suffix">
                      <input value={form.suffix} maxLength={FIELD_LIMITS.suffix} placeholder="Jr., III" onChange={(event) => updateField("suffix", event.target.value)} />
                    </Field>
                    <Field label="Gender">
                      <select value={form.gender || ""} onChange={(event) => updateField("gender", event.target.value)}>
                        <option value="">Not specified</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>
                    </Field>
                    <Field label="Date of Birth">
                      <input type="date" value={form.date_of_birth || ""} onChange={(event) => updateField("date_of_birth", event.target.value)} />
                    </Field>
                  </div>
                </div>

                <div className="ps-section">
                  <SectionHead icon="contact" title="Account & Contact" />
                  <div className="ps-grid">
                    <Field label="Username">
                      <input value={form.username} maxLength={FIELD_LIMITS.username} autoComplete="username" onChange={(event) => updateField("username", event.target.value)} />
                    </Field>
                    <Field label="Email">
                      <input type="email" value={form.email} maxLength={FIELD_LIMITS.email} autoComplete="email" onChange={(event) => updateField("email", event.target.value)} />
                    </Field>
                    <Field label="Phone">
                      <input value={form.phone} maxLength={FIELD_LIMITS.phone} inputMode="tel" autoComplete="tel" placeholder="09XXXXXXXXX" onChange={(event) => updateField("phone", event.target.value)} />
                    </Field>
                    <Field label="Alternate Phone">
                      <input value={form.alternate_phone} maxLength={FIELD_LIMITS.alternate_phone} inputMode="tel" placeholder="Optional" onChange={(event) => updateField("alternate_phone", event.target.value)} />
                    </Field>
                  </div>
                </div>

                <div className="ps-section">
                  <SectionHead icon="address" title="Address" />
                  <div className="ps-grid">
                    <Field label="Address Line" wide>
                      <input value={form.address_line} onChange={(event) => updateField("address_line", event.target.value)} />
                    </Field>
                  </div>
                </div>

                {needsOtp && (
                  <div className={`ps-otp${otpVerified ? " verified" : ""}`}>
                    <div className="ps-otp-head">
                      <span className="ps-otp-ic">
                        {otpVerified ? (
                          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20 6 9 17l-5-5" />
                          </svg>
                        ) : (
                          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="11" width="18" height="11" rx="2" />
                            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                          </svg>
                        )}
                      </span>
                      <div>
                        <strong>{otpVerified ? "OTP verified" : "Verification required"}</strong>
                        <p>Changes to your username, email, phone, or address need a one-time code sent to your email.</p>
                      </div>
                    </div>
                    <div className="ps-otp-row">
                      <button type="button" className="ps-btn ghost" disabled={otpSending} onClick={sendOtp}>
                        {otpSending ? "Sending..." : otpSent ? "Resend code" : "Send code"}
                      </button>
                      <input
                        className="ps-otp-input"
                        inputMode="numeric"
                        maxLength={6}
                        value={otpCode}
                        onChange={(event) => setOtpCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                        placeholder="------"
                        disabled={otpVerified}
                      />
                      <button type="button" className="ps-btn primary" disabled={!otpSent || otpVerifying || otpVerified} onClick={verifyOtp}>
                        {otpVerified ? "Verified" : otpVerifying ? "Checking..." : "Verify"}
                      </button>
                    </div>
                  </div>
                )}

                <div className="ps-form-actions">
                  <button type="submit" className="ps-btn primary" disabled={!canSave}>
                    {saving ? "Saving..." : "Save Profile"}
                  </button>
                  <button type="button" className="ps-btn ghost" onClick={load} disabled={saving}>
                    Reset
                  </button>
                </div>
              </form>
            </section>

            <section className="ps-card ps-panel">
              <div className="ps-panel-head">
                <div className="ps-htitle">
                  <span className="ps-hicon">
                    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                  </span>
                  <div>
                    <h3>Change Password</h3>
                    <p>You will be signed out after a successful password change.</p>
                  </div>
                </div>
              </div>

              <div className="ps-body">
                {pwError && <div className="ps-toast error" style={{ marginBottom: 12 }}><span className="ps-toast-dot" />{pwError}</div>}
                {pwMsg && <div className="ps-toast success" style={{ marginBottom: 12 }}><span className="ps-toast-dot" />{pwMsg}</div>}

                <div className="ps-grid">
                  <Field label="Current Password">
                    <input type={showPw ? "text" : "password"} value={pw.current} autoComplete="current-password" onChange={(event) => setPw((p) => ({ ...p, current: event.target.value }))} />
                  </Field>
                  <Field label="New Password">
                    <input type={showPw ? "text" : "password"} value={pw.next} autoComplete="new-password" onChange={(event) => setPw((p) => ({ ...p, next: event.target.value }))} />
                  </Field>
                  <Field label="Confirm New Password">
                    <input type={showPw ? "text" : "password"} value={pw.confirm} autoComplete="new-password" onChange={(event) => setPw((p) => ({ ...p, confirm: event.target.value }))} />
                  </Field>
                </div>

                {pw.next.length > 0 && (
                  <div className="ps-pwrules">
                    {PW_RULES.map((rule) => {
                      const ok = passwordChecks(pw.next)[rule.key];
                      return <span key={rule.key} className={`ps-pwrule${ok ? " ok" : ""}`}>{ok ? "✓" : "○"} {rule.label}</span>;
                    })}
                  </div>
                )}

                <label className="ps-pwshow">
                  <input type="checkbox" checked={showPw} onChange={(event) => setShowPw(event.target.checked)} /> Show passwords
                </label>

                <div className="ps-form-actions">
                  <button type="button" className="ps-btn primary" onClick={changePassword} disabled={pwSaving}>
                    {pwSaving ? "Updating..." : "Update Password"}
                  </button>
                </div>
              </div>
            </section>
          </>
        )}
      </div>

      <style>{`
.ps-page {
  --nv: #153a6b;
  --nv-deep: #0f2744;
  --teal: #1f7a6f;
  --ink: #14243b;
  --muted: #5c6c81;
  --line: #e5edf6;
  --field-line: #dbe4ef;
  --bg-soft: #f5f8fc;
  display: flex;
  flex-direction: column;
  gap: 16px;
  color: var(--ink);
}

.ps-toast {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 15px;
  border-radius: 12px;
  font-size: 13px;
  font-weight: 700;
  border: 1px solid;
  line-height: 1.35;
}
.ps-toast.success { background: #effaf3; border-color: #bfe6cd; color: #137a4b; }
.ps-toast.error { background: #fef1f1; border-color: #f6ced0; color: #b4323f; }
.ps-toast-dot { width: 8px; height: 8px; border-radius: 50%; background: currentColor; flex: 0 0 auto; }

.ps-card {
  background: #fff;
  border: 1px solid var(--line);
  border-radius: 18px;
  box-shadow: 0 1px 2px rgba(16, 40, 68, 0.04), 0 14px 34px -22px rgba(16, 40, 68, 0.28);
}

.ps-hero { overflow: hidden; position: relative; }
.ps-hero-cover {
  height: 96px;
  background:
    radial-gradient(120% 180% at 12% -30%, rgba(31, 122, 111, 0.85), transparent 55%),
    linear-gradient(115deg, #0f2744 0%, #163a6b 52%, #1f6f76 100%);
}
.ps-hero-body { padding: 0 18px 18px; margin-top: -44px; }
.ps-id { display: flex; flex-direction: column; align-items: flex-start; gap: 13px; min-width: 0; }
.ps-avatar {
  width: 88px;
  height: 88px;
  border-radius: 22px;
  overflow: hidden;
  display: grid;
  place-items: center;
  background: linear-gradient(140deg, #153a6b, #1f7a6f);
  color: #fff;
  font-weight: 800;
  font-size: 27px;
  letter-spacing: 0.5px;
  border: 4px solid #fff;
  box-shadow: 0 10px 24px -10px rgba(15, 39, 68, 0.55);
  flex: 0 0 auto;
}
.ps-avatar img { width: 100%; height: 100%; object-fit: cover; display: block; }
.ps-idtext { padding-bottom: 2px; min-width: 0; }
.ps-idtext h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 800;
  letter-spacing: -0.2px;
  color: var(--nv-deep);
  line-height: 1.15;
  overflow-wrap: anywhere;
}
.ps-email { margin: 3px 0 9px; font-size: 13px; color: var(--muted); overflow-wrap: anywhere; }
.ps-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.ps-chips span {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  border-radius: 999px;
  padding: 4px 10px;
  font-size: 11.5px;
  font-weight: 700;
  text-transform: capitalize;
}
.ps-chips .role { background: #e9eefb; color: #26417a; }
.ps-chips .status { background: #eef3f8; color: #566579; }
.ps-chips .status::before { content: ""; width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
.ps-chips .status.ok { background: #e7f7ee; color: #137a4b; }
.ps-chips .status.ok::before { background: #25a463; }
.ps-chips .status.warn { background: #fdf0e6; color: #a2621f; }
.ps-chips .status.warn::before { background: #d9832b; }
.ps-chips .extra { background: #eef3f8; color: #3d5168; }

.ps-panel { overflow: hidden; }
.ps-panel-head {
  padding: 18px;
  border-bottom: 1px solid var(--line);
  display: flex;
  align-items: center;
  gap: 12px;
}
.ps-htitle { display: flex; align-items: center; gap: 12px; min-width: 0; }
.ps-hicon {
  width: 38px;
  height: 38px;
  border-radius: 11px;
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  background: #eaf0fb;
  color: #26417a;
}
.ps-panel-head h3 { margin: 0; font-size: 16px; font-weight: 800; color: var(--nv-deep); }
.ps-panel-head p { margin: 3px 0 0; font-size: 12px; color: var(--muted); line-height: 1.35; }

.ps-btn {
  min-height: 44px;
  border-radius: 12px;
  padding: 0 18px;
  font-family: inherit;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}
.ps-btn.primary {
  border: 1px solid var(--nv);
  background: linear-gradient(180deg, #1c4a86, #153a6b);
  color: #fff;
  box-shadow: 0 8px 18px -10px rgba(21, 58, 107, 0.9);
}
.ps-btn.ghost { border: 1px solid var(--field-line); background: #fff; color: var(--nv); }
.ps-btn:disabled { opacity: 0.55; cursor: not-allowed; }

.ps-body { padding: 4px 18px 20px; display: flex; flex-direction: column; }
.ps-section { padding: 18px 0; border-bottom: 1px dashed var(--line); }
.ps-section-head { display: flex; align-items: center; gap: 9px; margin-bottom: 15px; }
.ps-sdot {
  width: 26px;
  height: 26px;
  border-radius: 8px;
  display: grid;
  place-items: center;
  background: #e7f4f1;
  color: #1f7a6f;
  flex: 0 0 auto;
}
.ps-section-head h4 {
  margin: 0;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.09em;
  text-transform: uppercase;
  color: #42566d;
}

.ps-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; }
.ps-col-2 { grid-column: span 2; }

.ps-field { display: flex; flex-direction: column; gap: 7px; min-width: 0; }
.ps-field > .lbl { font-size: 12.5px; font-weight: 700; color: #48596e; display: flex; align-items: center; gap: 5px; }
.ps-field > .lbl .req { color: #d0433f; font-weight: 800; }
.ps-control { position: relative; }
.ps-field input,
.ps-field select {
  width: 100%;
  height: 46px;
  border: 1.5px solid var(--field-line);
  border-radius: 12px;
  background: #fff;
  color: #16283f;
  font-family: inherit;
  font-size: 15px;
  padding: 0 14px;
  outline: none;
  box-sizing: border-box;
  transition: border-color 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;
}
.ps-field select {
  appearance: none;
  -webkit-appearance: none;
  padding-right: 38px;
  cursor: pointer;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%235c6c81' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'/></svg>");
  background-repeat: no-repeat;
  background-position: right 13px center;
}
.ps-field input::placeholder { color: #9aa8ba; }
.ps-field input:focus,
.ps-field select:focus { border-color: var(--nv); box-shadow: 0 0 0 4px rgba(21, 58, 107, 0.12); }

.ps-otp {
  margin-top: 18px;
  border: 1px solid #f0d9a8;
  background: linear-gradient(180deg, #fffaf0, #fff6e5);
  border-radius: 14px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 13px;
}
.ps-otp.verified { border-color: #bfe6cd; background: linear-gradient(180deg, #f2fbf5, #eaf7ef); }
.ps-otp-head { display: flex; gap: 11px; align-items: flex-start; }
.ps-otp-ic {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  background: #fbead0;
  color: #b4771a;
}
.ps-otp.verified .ps-otp-ic { background: #d9f0e1; color: #137a4b; }
.ps-otp-head strong { display: block; font-size: 13.5px; font-weight: 800; color: #7a5310; }
.ps-otp.verified .ps-otp-head strong { color: #137a4b; }
.ps-otp-head p { margin: 3px 0 0; font-size: 12.5px; color: #6b6152; line-height: 1.4; }
.ps-otp.verified .ps-otp-head p { color: #4f6a58; }
.ps-otp-row { display: flex; flex-wrap: wrap; gap: 9px; align-items: center; }
.ps-otp-row .ps-btn { flex: 0 0 auto; }
.ps-otp-input {
  flex: 1 1 130px;
  min-width: 0;
  height: 44px;
  border: 1.5px solid #e6d3a8;
  border-radius: 11px;
  background: #fff;
  font-family: inherit;
  font-size: 17px;
  font-weight: 700;
  letter-spacing: 0.3em;
  text-align: center;
  color: #16283f;
  padding: 0 10px;
  outline: none;
  box-sizing: border-box;
}
.ps-otp-input:focus { border-color: var(--nv); box-shadow: 0 0 0 4px rgba(21, 58, 107, 0.12); }
.ps-otp.verified .ps-otp-input { border-color: #bfe6cd; }

.ps-form-actions { display: flex; gap: 10px; flex-wrap: wrap; padding-top: 18px; }
.ps-form-actions .ps-btn { flex: 1 1 auto; min-width: 150px; }

.ps-avatar-edit { position: relative; cursor: pointer; }
.ps-avatar-cam {
  position: absolute; right: -2px; bottom: -2px;
  width: 26px; height: 26px; border-radius: 50%;
  background: #163a6b; color: #fff; border: 3px solid #fff;
  display: grid; place-items: center; font-size: 13px; font-weight: 900;
}
.ps-pwrules { display: flex; flex-wrap: wrap; gap: 6px; margin: 12px 0 2px; }
.ps-pwrule {
  font-size: 11px; font-weight: 800; padding: 4px 9px; border-radius: 999px;
  background: #f1f4f8; color: #8a97a8;
}
.ps-pwrule.ok { background: #e7f7ee; color: #137a4b; }
.ps-pwshow { display: flex; align-items: center; gap: 7px; font-size: 12.5px; color: #48596e; font-weight: 700; margin-top: 12px; }
.ps-pwshow input { width: 15px; height: 15px; accent-color: #163a6b; }
      `}</style>
    </MainLayout>
  );
}
