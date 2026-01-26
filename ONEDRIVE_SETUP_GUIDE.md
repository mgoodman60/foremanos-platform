# OneDrive Integration Setup Guide

## Overview

This guide walks you through the **one-time setup** required to enable OneDrive sync functionality in ForemanOS. This setup is performed once by the application administrator, after which all users can connect their company OneDrive accounts.

---

## Prerequisites

- A Microsoft account (personal or work/school)
- Access to Azure Portal (automatically available with Microsoft 365 Business)
- Administrator permissions to create app registrations
- Your ForemanOS deployment URL (e.g., `https://foremanos.site` or `http://localhost:3000` for testing)

---

## Part 1: Azure App Registration (One-Time Setup)

### Step 1: Access Azure Portal

1. Navigate to **[Azure Portal](https://portal.azure.com)**
2. Sign in with your Microsoft account
   - If you have Microsoft 365 Business, use your work account
   - Personal Microsoft accounts work too
3. Once logged in, you should see the Azure dashboard

> **Note**: If this is your first time using Azure, you may need to accept terms and complete a quick setup wizard.

---

### Step 2: Navigate to App Registrations

1. In the Azure Portal search bar at the top, type **"App registrations"**
2. Click on **"App registrations"** from the results
   - Alternative: Navigate via the left sidebar → **"Azure Active Directory"** → **"App registrations"**
3. You'll see a list of existing app registrations (may be empty if new)

---

### Step 3: Create New App Registration

1. Click the **"+ New registration"** button at the top
2. Fill in the registration form:

   **Name:**
   ```
   ForemanOS OneDrive Integration
   ```
   (or any descriptive name you prefer)

   **Supported account types:**
   - Select **"Accounts in any organizational directory (Any Azure AD directory - Multitenant) and personal Microsoft accounts (e.g. Skype, Xbox)"**
   - This allows users from any company to connect their OneDrive

   **Redirect URI:**
   - Platform: Select **"Web"**
   - URI: Enter your callback URL in this format:
     ```
     https://foremanos.site/api/projects/onedrive/callback
     ```
   - For local testing, use:
     ```
     http://localhost:3000/api/projects/onedrive/callback
     ```
   - ⚠️ **Important**: You can add multiple redirect URIs later, so you can have both production and development URLs

3. Click **"Register"** button at the bottom

---

### Step 4: Get Your Application (Client) ID

1. After registration, you'll be taken to the app's **Overview** page
2. Look for **"Application (client) ID"** in the **Essentials** section
3. It looks like: `12345678-1234-1234-1234-123456789abc`
4. **Copy this value** - you'll need it for your `.env` file
5. Keep this page open, you'll need more information from it

---

### Step 5: Create a Client Secret

1. In the left sidebar of your app, click **"Certificates & secrets"**
2. Click the **"+ New client secret"** button
3. Fill in the form:
   - **Description**: `ForemanOS Production Secret` (or any name)
   - **Expires**: Select **"24 months"** (recommended) or **"Custom"** for longer
4. Click **"Add"**
5. ⚠️ **CRITICAL**: The secret **Value** will be displayed **ONLY ONCE**
   - Copy the **Value** column (not the Secret ID)
   - It looks like: `abc123~XyZ789_AbCdEfGhIjKlMnOpQrStUvWx`
   - **Store it securely immediately** - you cannot retrieve it later
   - If you lose it, you'll need to create a new secret

---

### Step 6: Configure API Permissions

1. In the left sidebar, click **"API permissions"**
2. You should see **"Microsoft Graph"** with **"User.Read"** already added
3. Click **"+ Add a permission"** button
4. Select **"Microsoft Graph"**
5. Choose **"Delegated permissions"** (not Application permissions)
6. Add the following permissions by searching and checking the boxes:

   **Required Permissions:**
   - ✅ `Files.Read` - Read user files
   - ✅ `Files.Read.All` - Read all files user can access
   - ✅ `Files.ReadWrite` - Read and write user files
   - ✅ `Files.ReadWrite.All` - Read and write all files user can access
   - ✅ `offline_access` - Maintain access to data (for refresh tokens)
   - ✅ `User.Read` - Sign in and read user profile (already added)

7. Click **"Add permissions"** at the bottom
8. The permissions will be added to your list

> **Note**: You do NOT need to click "Grant admin consent" unless you want to pre-approve for all users in your organization. Users will be prompted to consent when they first connect.

---

### Step 7: Add Additional Redirect URIs (Optional)

If you need both production and development URLs:

1. In the left sidebar, click **"Authentication"**
2. Under **"Platform configurations"** → **"Web"**, you'll see your existing redirect URI
3. Click **"Add URI"** to add additional callback URLs:
   - Production: `https://foremanos.site/api/projects/onedrive/callback`
   - Development: `http://localhost:3000/api/projects/onedrive/callback`
   - Staging: `https://staging.foremanos.site/api/projects/onedrive/callback`
4. Click **"Save"** at the bottom

---

### Step 8: Note Your Tenant ID (Optional)

1. Go back to the **"Overview"** page of your app registration
2. Find **"Directory (tenant) ID"** in the Essentials section
3. Copy this value if you want to restrict authentication to a specific organization
4. For most cases, you can use **`common`** which allows any Microsoft account

---

## Part 2: Configure ForemanOS Environment Variables

### Step 1: Update `.env` File

1. Navigate to your ForemanOS project directory:
   ```bash
   cd /home/ubuntu/construction_project_assistant/nextjs_space
   ```

2. Open the `.env` file (or create it if it doesn't exist):
   ```bash
   nano .env
   ```

3. Add the following environment variables:

   ```env
   # OneDrive Integration
   ONEDRIVE_CLIENT_ID=<your_application_client_id>
   ONEDRIVE_CLIENT_SECRET=<your_client_secret_value>
   ONEDRIVE_TENANT_ID=common

   # Make sure NEXTAUTH_URL is also set correctly
   NEXTAUTH_URL=https://foremanos.site
   # Or for local development:
   # NEXTAUTH_URL=http://localhost:3000
   ```

4. **Replace the values**:
   - `<your_application_client_id>`: Paste the Application (client) ID from Step 4
   - `<your_client_secret_value>`: Paste the Client Secret Value from Step 5
   - `ONEDRIVE_TENANT_ID`: Use `common` (allows any Microsoft account) or your specific Tenant ID

5. Save and close the file:
   - Press `Ctrl + X`
   - Press `Y` to confirm
   - Press `Enter`

---

### Step 2: Restart Your Application

For the environment variables to take effect:

**Development:**
```bash
cd /home/ubuntu/construction_project_assistant/nextjs_space
pkill node
yarn dev
```

**Production:**
```bash
# Restart your production server or redeploy
```

---

## Part 3: Verify the Setup

### Test the OAuth Flow

1. Log into ForemanOS as a project owner
2. Navigate to a project
3. Look for the **"Connect OneDrive"** button (once UI is implemented)
4. Click it - you should be redirected to Microsoft's login page
5. Sign in with your Microsoft account
6. Grant permissions when prompted
7. You should be redirected back to ForemanOS with a success message

### Troubleshooting OAuth Issues

If the OAuth flow fails:

1. **Check redirect URI mismatch**:
   - Error: `AADSTS50011: The redirect URI specified in the request does not match...`
   - Solution: Ensure the redirect URI in Azure matches your `NEXTAUTH_URL` + `/api/projects/onedrive/callback`

2. **Check client secret**:
   - Error: `AADSTS7000215: Invalid client secret`
   - Solution: Verify you copied the secret **Value** (not Secret ID) and it hasn't expired

3. **Check application ID**:
   - Error: `AADSTS700016: Application not found`
   - Solution: Verify the `ONEDRIVE_CLIENT_ID` matches the Application (client) ID in Azure

4. **Check permissions**:
   - Error: User sees "Needs admin approval" message
   - Solution: Either grant admin consent in Azure, or have users request admin approval

---

## Security Best Practices

### Protecting Your Secrets

1. **Never commit `.env` to version control**
   - Ensure `.env` is in your `.gitignore` file
   - Use environment variables in production (not `.env` files)

2. **Rotate secrets periodically**
   - Azure allows multiple active secrets
   - Create a new secret before the old one expires
   - Update your `.env` with the new secret
   - Delete the old secret after confirming the new one works

3. **Use different secrets for different environments**
   - Create separate app registrations for:
     - Development: `ForemanOS OneDrive (Dev)`
     - Staging: `ForemanOS OneDrive (Staging)`
     - Production: `ForemanOS OneDrive (Production)`

4. **Monitor access**
   - In Azure Portal, go to your app → **"Sign-in logs"**
   - Review who is authenticating and when
   - Look for suspicious activity

---

## Understanding Token Management

### How OAuth Tokens Work

1. **Access Token**:
   - Short-lived (typically 1 hour)
   - Used to make API calls to Microsoft Graph
   - Automatically refreshed by ForemanOS

2. **Refresh Token**:
   - Long-lived (months)
   - Used to get new access tokens
   - Stored encrypted in your database
   - Requires `offline_access` permission

3. **Token Storage**:
   - Tokens are stored **per-project** in your database
   - Encrypted at rest
   - Never exposed to client-side code

### Token Refresh Process

ForemanOS automatically handles token refresh:

1. Before each OneDrive API call, checks if access token is expired
2. If expired, uses refresh token to get a new access token
3. Updates the database with the new tokens
4. Proceeds with the API call

**Users don't need to re-authenticate** unless:
- Refresh token expires (typically after 90 days of inactivity)
- User revokes access in their Microsoft account settings
- Admin revokes access in Azure Portal

---

## Multi-Tenant Considerations

### Allowing Any Organization

By selecting **"Accounts in any organizational directory"** during setup:

✅ **Benefits**:
- Any company can use ForemanOS with their OneDrive
- Users from different organizations can collaborate
- No additional configuration needed per customer

⚠️ **Considerations**:
- Each user authenticates with their own company credentials
- Each project stores its own OAuth tokens
- Data isolation is maintained per-project

### Restricting to Your Organization Only

If you want to limit OneDrive access to your organization:

1. During app registration, select:
   - **"Accounts in this organizational directory only (Single tenant)"**
2. Set `ONEDRIVE_TENANT_ID` to your specific Tenant ID (not `common`)
3. Only users from your organization can authenticate

---

## FAQ

### Q: Do I need an Azure subscription?
**A:** No, app registrations are free and included with any Microsoft account.

### Q: Can I use a personal Microsoft account?
**A:** Yes, but you'll need to create an Azure AD tenant first (free). Microsoft 365 Business accounts already have Azure AD.

### Q: What if my client secret expires?
**A:** Create a new secret in Azure, update your `.env` file, and restart the app. You can have multiple active secrets during rotation.

### Q: Can I test locally without deploying?
**A:** Yes, add `http://localhost:3000/api/projects/onedrive/callback` as a redirect URI in Azure.

### Q: How do I revoke access for a user?
**A:** In Azure Portal, go to your app → **"Users and groups"** (if enabled) or have the user revoke access from their Microsoft account settings.

### Q: What happens if a user leaves the company?
**A:** Their OneDrive access token will stop working when their Microsoft account is deactivated. Projects using their token will fail to sync until a new owner connects their OneDrive.

### Q: Can multiple users connect OneDrive to the same project?
**A:** Currently, each project uses a single OneDrive connection (typically the project owner's). Only one set of tokens is stored per project.

### Q: How do I migrate to a different OneDrive account?
**A:** The project owner can disconnect and reconnect OneDrive, which replaces the stored tokens with new ones from a different account.

---

## Next Steps

Once Azure setup is complete:

1. ✅ Environment variables configured
2. ⏳ Build UI components for OneDrive management
3. ⏳ Test end-to-end OAuth flow
4. ⏳ Set up scheduled daily sync (3 AM ET)
5. ⏳ Train users on OneDrive connection process

---

## Support Resources

- **Microsoft Graph API Docs**: https://docs.microsoft.com/en-us/graph/
- **Azure App Registration Guide**: https://docs.microsoft.com/en-us/azure/active-directory/develop/quickstart-register-app
- **OneDrive API Reference**: https://docs.microsoft.com/en-us/graph/api/resources/onedrive
- **OAuth 2.0 Flow**: https://docs.microsoft.com/en-us/azure/active-directory/develop/v2-oauth2-auth-code-flow

---

## Appendix: Example `.env` File

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/foremanos"

# NextAuth
NEXTAUTH_URL="https://foremanos.site"
NEXTAUTH_SECRET="your-nextauth-secret-here"

# AWS S3 (for document storage)
AWS_BUCKET_NAME="foremanos-documents"
AWS_FOLDER_PREFIX="prod/"

# OneDrive Integration
ONEDRIVE_CLIENT_ID="12345678-1234-1234-1234-123456789abc"
ONEDRIVE_CLIENT_SECRET="abc123~XyZ789_AbCdEfGhIjKlMnOpQrStUvWx"
ONEDRIVE_TENANT_ID="common"

# LLM API (for RAG processing)
ABACUSAI_API_KEY="your-abacus-api-key"

# Email Service (optional)
EMAIL_FROM="noreply@foremanos.site"
```

---

**Document Version**: 1.0  
**Last Updated**: December 15, 2024  
**Maintained By**: ForemanOS Development Team
