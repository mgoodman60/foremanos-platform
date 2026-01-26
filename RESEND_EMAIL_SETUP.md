# Resend Email Configuration Guide

## Overview

ForemanOS uses [Resend](https://resend.com/) for transactional email delivery. The email service includes:

- ✅ **Rate Limiting**: Automatic queue system to respect Resend's 2 req/sec limit
- ✅ **Domain Verification Handling**: Graceful fallback when domain is not verified
- ✅ **Console Fallback**: All emails logged to console when Resend unavailable
- ✅ **Queue Processing**: Background email sending without blocking API responses
- ✅ **Error Recovery**: Automatic retry for rate limit errors

---

## Current Status

### ⚠️ Domain Not Verified

The domain `foremanos.site` is **not yet verified** with Resend. Until verification is complete:

- All emails will be **logged to console** instead of being sent
- No actual emails will be delivered to users
- The application will continue to function normally

### Email Types Currently Implemented

1. **Authentication Emails**:
   - Welcome email (new signups)
   - Email verification (free tier)
   - Sign-in notifications (admins)
   - Password reset

2. **Admin Notifications**:
   - New user signups
   - Document uploads
   - Activity alerts

3. **User Management**:
   - Account approval notifications
   - Account rejection notifications
   - Project invitations

---

## Setting Up Resend (Step-by-Step)

### Step 1: Get Resend API Key

1. Go to [resend.com](https://resend.com/) and create an account
2. Navigate to **API Keys** in the dashboard
3. Click **Create API Key**
4. Copy the API key (starts with `re_`)

**Note**: The API key is already configured in the project at:
```
/home/ubuntu/.config/abacusai_auth_secrets.json
```

### Step 2: Verify Your Domain

#### Option A: Verify foremanos.site (Recommended)

1. Go to [resend.com/domains](https://resend.com/domains)
2. Click **Add Domain**
3. Enter: `foremanos.site`
4. Add the DNS records provided by Resend to your domain registrar:

   **Required DNS Records**:
   ```
   Type: TXT
   Name: @
   Value: [provided by Resend]

   Type: CNAME
   Name: resend._domainkey
   Value: [provided by Resend]
   ```

5. Wait 24-48 hours for DNS propagation
6. Click **Verify** in Resend dashboard

#### Option B: Use Resend's Free Domain (Quick Testing)

Resend provides a free testing domain for development:

1. In the email service, change:
   ```typescript
   const FROM_EMAIL = 'onboarding@resend.dev'; // Testing only
   ```

2. **Limitations**:
   - Can only send to verified email addresses
   - Limited to 100 emails/day
   - Not suitable for production

---

## How the Email Queue Works

### Rate Limiting Strategy

```typescript
// Resend limit: 2 requests/second
// Our implementation: 1.67 requests/second (600ms interval)
const MIN_EMAIL_INTERVAL = 600; // milliseconds
```

### Queue Processing

1. **Email Submission**:
   ```typescript
   sendEmail({ to, subject, body })
   // Returns immediately - doesn't block
   ```

2. **Queue Addition**:
   - Email added to internal queue
   - Queue processor started (if not running)

3. **Rate-Limited Sending**:
   - Emails sent with 600ms delay between each
   - Prevents hitting Resend's rate limit

4. **Error Handling**:
   - **403 Domain Error**: Falls back to console logging
   - **429 Rate Limit**: Waits and retries
   - **Other Errors**: Logs to console, continues

### Example Flow

```
User Signs Up
  ↓
sendWelcomeEmail() → Queue (position 1)
  ↓
sendNewSignupNotification() → Queue (position 2)
  ↓
API returns success to user
  ↓
Background queue processes:
  - Email 1 sent at T+0ms
  - Wait 600ms
  - Email 2 sent at T+600ms
```

---

## Testing Email Functionality

### 1. Check Console Logs

When domain is not verified, emails appear in console:

```
================================================================================
📧 EMAIL (Console Log)
================================================================================
To: user@example.com
Subject: Welcome to ForemanOS!
Type: info
--------------------------------------------------------------------------------
Hi username,

Welcome to ForemanOS - Your intelligent construction project assistant!
...
================================================================================
```

### 2. Verify Queue Processing

Look for these log messages:

```
⚠️ Resend domain not verified. Emails will be logged to console.
📋 To fix: Add and verify foremanos.site at https://resend.com/domains
```

### 3. Test Rate Limiting

Send multiple emails rapidly:

```bash
# Trigger multiple signups in quick succession
curl -X POST http://localhost:3000/api/signup ...
curl -X POST http://localhost:3000/api/signup ...
curl -X POST http://localhost:3000/api/signup ...
```

Expected behavior:
- All API calls return immediately
- Emails sent in background with 600ms delays
- No rate limit errors (429)

---

## Production Deployment Checklist

### Before Going Live:

- [ ] Domain `foremanos.site` verified in Resend dashboard
- [ ] DNS records propagated (check with `dig foremanos.site TXT`)
- [ ] Send test email to verify delivery
- [ ] Update email templates with production links
- [ ] Configure email monitoring/alerts
- [ ] Set up SPF/DKIM/DMARC records for deliverability

### Monitoring:

```typescript
// Check email queue size
console.log('Email queue size:', emailQueue.length);

// Check last email time
console.log('Last email sent:', new Date(lastEmailTime));
```

---

## Common Issues

### Issue 1: "Domain not verified" (403)

**Cause**: Domain not added/verified in Resend

**Solution**:
1. Go to resend.com/domains
2. Add foremanos.site
3. Add DNS records to domain registrar
4. Wait for DNS propagation
5. Verify domain

**Temporary Workaround**:
- Emails logged to console instead
- Application continues to function

### Issue 2: Rate limit errors (429)

**Cause**: Too many emails sent too quickly

**Solution**:
- Queue system automatically handles this
- If still occurring, increase `MIN_EMAIL_INTERVAL`

**Current Setting**: 600ms between emails (1.67 req/sec)

### Issue 3: Emails not appearing in inbox

**Check**:
1. Domain verified? (Check Resend dashboard)
2. DNS records correct? (Use DNS checker)
3. Spam folder? (Check recipient spam)
4. Email quota exceeded? (Check Resend usage)

---

## Email Service Configuration

### File Location
```
nextjs_space/lib/email-service.ts
```

### Key Settings

```typescript
const FROM_EMAIL = 'support@foremanos.site';
const FROM_NAME = 'ForemanOS';
const CONTACT_EMAIL = 'ForemanOS@outlook.com';
const MIN_EMAIL_INTERVAL = 600; // ms between emails
```

### Customizing Email Templates

Each email function can be customized:

```typescript
export async function sendWelcomeEmail(email: string, username: string) {
  return sendEmail({
    to: email,
    subject: 'Welcome to ForemanOS!',
    body: `Hi ${username},\n\n...`, // Customize here
    type: 'info',
  });
}
```

---

## API Key Management

### Current Storage

API key stored in:
```
/home/ubuntu/.config/abacusai_auth_secrets.json
```

Format:
```json
{
  "resend": {
    "secrets": {
      "api_key": {
        "value": "re_xxxxxxxxxxxxx"
      }
    }
  }
}
```

### Security Notes

- ✅ API key stored outside project directory
- ✅ Not committed to version control
- ✅ Accessed only by server-side code
- ✅ Falls back gracefully if unavailable

---

## Support

### Resend Support
- Documentation: https://resend.com/docs
- Support: support@resend.com
- Status: https://status.resend.com/

### ForemanOS Contact
- Email: ForemanOS@outlook.com
- Issues: Check console logs for detailed error messages

---

## Next Steps

1. **Immediate**: Verify `foremanos.site` domain in Resend
2. **Testing**: Send test emails to verify delivery
3. **Monitoring**: Set up alerts for email failures
4. **Optimization**: Monitor queue performance and adjust intervals if needed

---

## Changelog

### 2024-12-28
- ✅ Implemented email queue with rate limiting
- ✅ Added domain verification error handling
- ✅ Improved console fallback logging
- ✅ Added retry logic for rate limits
- ✅ Background email processing

### Previous
- Basic Resend integration
- Console logging fallback
- Multiple email templates
