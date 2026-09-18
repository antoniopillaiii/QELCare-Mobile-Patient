import React from "react";
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";

import LoginScreen from "./components/Login/LoginScreen";
import RegisterScreen from "./components/Register/RegisterScreen";
import ForgotPassScreen from "./components/ForgotPassword/ForgotPassScreen";
import EmailVerification from "./components/Verifications/EmailVerification";

import UserScreen from "./components/UserSide/UserScreen";
import PatientAppointments from "./components/UserSide/PatientAppointments";
import MedicalRecords from "./components/UserSide/MedicalRecords";
import HealthRecords from "./components/UserSide/HealthRecords";
import ProfileScreen from "./components/UserSide/ProfileScreen";
import MainLayout from "./components/Layout/MainLayout";
import PatientIdleTimeout from "./components/Auth/PatientIdleTimeout";

import { getUserRole, isAuthenticated } from "./utils/auth";

function ProtectedPatientRoute({ children }) {
  if (!isAuthenticated()) return <Navigate to="/login" replace />;
  if (getUserRole() !== "Patient") return <Navigate to="/unauthorized" replace />;
  return children;
}

function RoleRedirect() {
  if (!isAuthenticated()) return <Navigate to="/login" replace />;
  return getUserRole() === "Patient"
    ? <Navigate to="/dashboard" replace />
    : <Navigate to="/unauthorized" replace />;
}

function Unauthorized() {
  return (
    <div className="patient-auth-message">
      <div className="patient-auth-card">
        <h1>Patient app only</h1>
        <p>This APK is limited to patient accounts. Staff accounts should use the main QELCare web portal.</p>
        <a href="#/login">Back to patient sign in</a>
      </div>
    </div>
  );
}

const protect = (element) => <ProtectedPatientRoute>{element}</ProtectedPatientRoute>;

export default function App() {
  return (
    <HashRouter>
      {/* Patient inactivity auto-logout (whole app is patient-only). */}
      <PatientIdleTimeout />
      <Routes>
        <Route path="/" element={<RoleRedirect />} />
        <Route path="/login" element={<LoginScreen />} />
        <Route path="/register" element={<RegisterScreen />} />
        <Route path="/forgot-password" element={<ForgotPassScreen />} />
        <Route path="/verify-email" element={<EmailVerification />} />
        <Route path="/redirect" element={<RoleRedirect />} />
        <Route path="/unauthorized" element={<Unauthorized />} />

        <Route path="/dashboard" element={protect(<UserScreen />)} />
        <Route
          path="/patient/appointments"
          element={protect(
            <MainLayout pageTitle="My Appointments" pageSubtitle="Upcoming, history, and booking">
              <PatientAppointments />
            </MainLayout>
          )}
        />
        <Route path="/patient/appointments/book" element={<Navigate to="/patient/appointments?tab=book" replace />} />
        <Route
          path="/patient/records"
          element={protect(
            <MainLayout pageTitle="Consultation Records" pageSubtitle="Read-only doctor-created consultation records">
              <MedicalRecords />
            </MainLayout>
          )}
        />
        <Route
          path="/patient/health"
          element={protect(
            <MainLayout pageTitle="Health Records" pageSubtitle="Your clinical history and vitals">
              <HealthRecords />
            </MainLayout>
          )}
        />
        {/* Medications and lab-paper uploads were consolidated into Health Records
            (its Medications + Documents tabs), mirroring the web app. Keep these
            paths as redirects so any old link lands on the consolidated page. */}
        <Route path="/patient/medications" element={<Navigate to="/patient/health" replace />} />
        <Route path="/patient/results" element={<Navigate to="/patient/health" replace />} />
        <Route path="/patient/profile" element={protect(<ProfileScreen />)} />

        <Route path="*" element={<Navigate to="/redirect" replace />} />
      </Routes>
    </HashRouter>
  );
}
