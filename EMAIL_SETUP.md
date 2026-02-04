# Email Configuration Guide

## Error: "Username and Password not accepted"

This means the SMTP credentials are **invalid or expired**. Follow these steps to fix it:

---

## Option 1: Use Gmail (Recommended)

### Step 1: Enable 2-Factor Authentication on Gmail
1. Go to: https://myaccount.google.com/security
2. Click **"2-Step Verification"**
3. Follow the setup wizard

### Step 2: Generate Gmail App Password
1. Go to: https://myaccount.google.com/apppasswords
2. Select **Mail** and **Windows Computer**
3. Google will generate a **16-character password** (without spaces)
4. Copy this password

### Step 3: Configure in your application

**Option A: Using Environment Variables (Recommended)**
```powershell
$env:SMTP_HOST="smtp.gmail.com"
$env:SMTP_PORT="587"
$env:SMTP_USER="your-email@gmail.com"
$env:SMTP_PASS="your-16-char-app-password"

# Then start the server
node server.js
```

**Option B: Directly in server.js**
Edit `server.js` and change:
```javascript
const emailConfig = {
    host: "smtp.gmail.com",
    port: 587,
    auth: {
        user: "splog07@gmail.com",
        pass: "your-16-char-app-password"  // Not your Gmail password!
    }
};
```

---

## Option 2: Use Custom Email Server

If you have a corporate email server (Titan, Office 365, etc.):

```javascript
const emailConfig = {
    host: "smtp.your-server.com",
    port: 587,              // or 465 for SSL
    secure: false,          // true if using port 465
    auth: {
        user: "your-email@company.com",
        pass: "your-password"
    }
};
```

---

## Troubleshooting

### ✅ Connection successful?
You'll see in the terminal/console:
```
✅ SMTP connection verified successfully!
```

### ❌ Still getting errors?

**Check:**
- [ ] Email address is correct
- [ ] App password is correct (Gmail requires App Password, not regular password)
- [ ] 2FA is enabled (required for Gmail App Passwords)
- [ ] No spaces in the password
- [ ] Correct SMTP host for your email provider

**Clear any cached errors:**
1. Restart the server: `node server.js`
2. Try sending email again
3. Check the **browser console** (F12) for detailed error messages

---

## Email Providers SMTP Settings

| Provider | Host | Port | Secure |
|----------|------|------|--------|
| **Gmail** | `smtp.gmail.com` | 587 | false |
| **Outlook** | `smtp-mail.outlook.com` | 587 | false |
| **Office 365** | `smtp.office365.com` | 587 | false |
| **Yahoo** | `smtp.mail.yahoo.com` | 587 | false |
| **Custom Server** | Ask your IT admin | 587/465 | Check with admin |

---

## Testing the Connection

Once configured, restart the server:
```powershell
# Kill old process
Stop-Process -Name node -Force

# Start fresh with new config
node server.js
```

Look for this in the terminal:
```
✅ SMTP connection verified successfully!
```

If you see this, your email configuration is correct! 🎉
