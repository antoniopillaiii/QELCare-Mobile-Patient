   # QELCare — Push & SMS notifications setup

                Both features are **fully wired end-to-end**. They run in a free/dev "console
fallback" mode out of the box (nothing is actually delivered, but the flows work
and are testable). To deliver real notifications you add the credentials below.

The website and the patient mobile APK share one backend, so the SMS changes
cover **both** platforms. Push (FCM) is for the **Android APK**.

---

## 1. Push notifications (Firebase Cloud Messaging) — Android APK

### What's already done
- `@capacitor/push-notifications` is installed and wired (`src/utils/push.js`):
  the device registers after login, the token is sent to the backend, taps
  deep-link to the appointments screen, and the token is dropped on logout.
- The Android project already applies `google-services` **only if**
  `android/app/google-services.json` exists, so the APK builds fine without it
  (push is simply inactive until you add the file).
- Backend can send FCM HTTP v1 pushes (`shared/utils/pushNotifier.js`) and stores
  device tokens in a `device_tokens` table (auto-created at boot).

### What YOU do (one-time, free)
1. Go to <https://console.firebase.google.com> → **Add project** (free Spark plan).
2. Add an **Android app** with package name **`com.qelcare.patient`**
   (must match `applicationId` in `android/app/build.gradle`).
3. Download **`google-services.json`** and drop it into **`android/app/`**.
4. Rebuild the APK:
   ```bash
   npm run build && npx cap sync android && cd android && ./gradlew assembleDebug
   ```
5. Create a **service account key** for the backend:
   Firebase Console → **Project settings → Service accounts → Generate new
   private key** → downloads a JSON file.
6. In the backend `.env` (Railway → Variables), set from that JSON:
   ```
   FCM_PROJECT_ID=<project_id>
   FCM_CLIENT_EMAIL=<client_email>
   FCM_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
   ```
   Keep the `\n` escapes inside the quotes exactly as they appear in the JSON.

That's it — appointment events will now push to the phone even when the app is
closed. Until FCM is configured, the backend logs pushes to the server console.

> iOS push is **not** included here (the task was the Android APK). iOS needs an
> Apple Push (APNs) key + the Push Notifications capability; the APK path above
> does not affect the existing iOS build.

---

## 2. SMS notifications + SMS OTP codes — website & mobile

SMS is sent server-side by a gateway. Real SMS to Philippine numbers always
costs money at the carrier level, so the provider is pluggable and defaults to a
**free** path.

### What's already done
- `shared/utils/smsNotifier.js` — provider-agnostic sender with PH phone
  normalization and a **console dev fallback** (prints the SMS instead of sending).
- Appointment events also text the patient (`emailPatient` in
  `appointmentController.js`) — web patients included.
- **SMS OTP:** verification screens (web + mobile) have a **"Send code via SMS"**
  button — ideal when email is slow on weak mobile data. The backend looks up the
  account's phone; the user never types a number.

### Choosing a provider (backend `.env`)
Default (free, no account — codes print to the **server console**):
```
SMS_PROVIDER=console
```

**TextBelt** — a *real* SMS with **no account** on the free public quota
(1 SMS/day), or free if you self-host:
```
SMS_PROVIDER=textbelt
TEXTBELT_API_KEY=textbelt          # public free key = 1 SMS/day
# TEXTBELT_URL=https://your-self-hosted-textbelt/text   # optional, unlimited & free if self-hosted
```

**Semaphore** (Philippine gateway — free signup credits, no credit card):
```
SMS_PROVIDER=semaphore
SEMAPHORE_API_KEY=<your key>
SMS_SENDER=QELCare
```

**Twilio** (global; trial credits):
```
SMS_PROVIDER=twilio
TWILIO_ACCOUNT_SID=<sid>
TWILIO_AUTH_TOKEN=<token>
TWILIO_FROM=<your Twilio number>
```

`SMS_DEV_FALLBACK=true` (default in non-production) means that if the gateway is
unconfigured or a send fails, the code is logged to the server console so testing
is never blocked.

> **Honest note:** there is no unlimited free SMS gateway for PH numbers.
> `console` and TextBelt's 1/day are perfect for demos/testing; sustained live
> SMS (many OTPs, every appointment) needs a paid gateway (Semaphore recommended
> locally).
