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

## 2. SMS verification codes — Forgot Password + Register Account only

SMS is used for **one thing**: the 6-digit verification code for **Forgot
Password** and **Register Account**. The website and the mobile app share the
backend, so both get it. Nothing else sends SMS: appointment updates go by
in-app notification, email and push, and profile-change codes go by email.

### How it works
- The code is emailed first. On the verification screen, after the 60-second
  resend wait, **"Send code via SMS"** texts a new code to the mobile number on
  the account. The patient never types a number there.
- The text is sent **from the clinic's own Android phone and SIM** through
  **TextBee** (<https://textbee.dev>). The backend (Railway) calls TextBee's API;
  TextBee hands the message to the phone, which sends it from its SIM. No ADB,
  no PC. The carrier cost is your SIM plan (use an unlimited-text promo).
- TextBee's **free plan** allows **50 SMS a day and 300 a month** from **1 phone**.
  Past that, the backend says "SMS is unavailable right now. Please use Resend by
  email." and email keeps working.
- The backend never logs the SMS text or the number. TextBee's dashboard keeps a
  history of sent messages, so keep that account private.

### Phone + account setup (one time)
1. Create a free account at <https://textbee.dev> and verify its email.
2. On the clinic phone, install the app from <https://textbee.dev/download>
   (allow installs from your browser; Play Protect may ask you to confirm).
3. Open the app and allow **SMS** access (and notifications).
4. In the TextBee dashboard: **Register Device** → scan the QR code with the app.
   Then create an **API key** in the dashboard.
5. In the app, make sure the gateway is **enabled**. On a dual-SIM phone, set the
   **Default SIM** to the SIM with the unli-text promo.
6. Settings → Apps → TextBee → Battery → **Unrestricted**. On a Samsung, also add
   TextBee to Settings → Battery → Background usage limits → **Never sleeping
   apps**, so the phone doesn't put it to sleep.

### Keeping the phone ready
The phone does two jobs, and each needs something different:
1. **Receive the send job — needs internet.** The backend gives the text to
   TextBee's server, which passes it to the phone over the internet. With no
   internet the phone never gets the job and the patient gets no code.
2. **Send the SMS — needs the SIM.** The phone texts over the cell network using
   the unli-text promo.

So the phone needs **all** of these:
- **Internet:** Wi-Fi or mobile data.
- **Cell signal**, airplane mode off.
- **An active unli-text promo.**
- **Charged** — best kept plugged in.
- **TextBee allowed in the background:** battery **Unrestricted** (and
  **Never sleeping apps** on Samsung), and never force-closed.

**Prefer Wi-Fi.** Unli-text promos usually cover texts only, so without a data
promo, mobile data may be charged against the SIM's load. When the load runs out
the phone goes offline and SMS stops. Use the clinic Wi-Fi, and add a data promo
only if you want mobile data as a backup.

**If the phone is offline,** "Send code via SMS" still says the code was sent,
but no text arrives. The code expires after 10 minutes and the patient can use
**Resend by email**. To check the phone is connected, open the TextBee dashboard
and look at the device's last-seen time.

### Backend variables (Railway → Variables; locally `qelcare-backend/.env`)
```
SMS_PROVIDER=textbee
TEXTBEE_API_KEY=<API key from the TextBee dashboard>
# TEXTBEE_DEVICE_ID=<device id>              # optional, only with 2+ phones
# TEXTBEE_SIM_SUBSCRIPTION_ID=<sim id>       # optional, pick the SIM per message
```
Redeploy after changing them. If SMS isn't configured, production says "SMS
service is not configured. Use email instead." and email keeps working.
