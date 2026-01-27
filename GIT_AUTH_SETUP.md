# Git Authentication Setup for Automated Pushing

This guide helps you set up automated git authentication so you don't need to manually enter credentials for every push.

## Option 1: Personal Access Token with Credential Helper (Recommended for Windows)

### Step 1: Create a Personal Access Token

1. Go to: https://github.com/settings/tokens
2. Click "Generate new token" → "Generate new token (classic)"
3. Name it: "ForemanOS Development"
4. Select scopes:
   - ✅ `repo` (Full control of private repositories)
5. Click "Generate token"
6. **Copy the token immediately** (you won't see it again!)

### Step 2: Configure Git Credential Helper

Run these commands in PowerShell:

```powershell
# Configure Windows Credential Manager
git config --global credential.helper wincred

# Switch back to HTTPS (if using SSH)
git remote set-url origin https://github.com/mgoodman60/foremanos.git
```

### Step 3: Test the Setup

```powershell
git push origin main
```

When prompted:
- **Username**: `mgoodman60`
- **Password**: Paste your Personal Access Token (not your GitHub password)

Windows Credential Manager will save these credentials for future use.

---

## Option 2: SSH Keys (Alternative)

### Step 1: Generate SSH Key

Open **Git Bash** (not PowerShell) and run:

```bash
ssh-keygen -t ed25519 -C "ForemanOS@outlook.com"
```

- Press Enter to accept default location
- Press Enter twice for no passphrase (or set one if preferred)

### Step 2: Add SSH Key to GitHub

1. Copy your public key:
   ```bash
   cat ~/.ssh/id_ed25519.pub
   ```

2. Go to: https://github.com/settings/keys
3. Click "New SSH key"
4. Title: "ForemanOS Development"
5. Paste the public key
6. Click "Add SSH key"

### Step 3: Test SSH Connection

```bash
ssh -T git@github.com
```

You should see: "Hi mgoodman60! You've successfully authenticated..."

### Step 4: Ensure Remote Uses SSH

```bash
git remote set-url origin git@github.com:mgoodman60/foremanos.git
```

---

## Option 3: GitHub CLI (gh)

### Install GitHub CLI

```powershell
# Using winget
winget install --id GitHub.cli

# Or download from: https://cli.github.com/
```

### Authenticate

```powershell
gh auth login
```

Follow the prompts to authenticate with GitHub.

### Configure Git to Use GitHub CLI

```powershell
git config --global credential.helper ""
gh auth setup-git
```

---

## Verify Setup

After setup, test with:

```powershell
git push origin main
```

It should push without asking for credentials.

---

## Troubleshooting

### Proxy Issues (Connection via 127.0.0.1)

**Symptoms:** `Failed to connect to github.com port 443 via 127.0.0.1`

**Solution:** Your system has proxy environment variables set. Use the provided script:

```powershell
# Use the git-push.ps1 script which bypasses proxy
.\git-push.ps1 main "your-token-here"
```

**Permanent Fix:** Remove proxy from Windows environment variables:
1. Open "Environment Variables" in Windows
2. Find `HTTP_PROXY`, `HTTPS_PROXY`, `http_proxy`, `https_proxy`
3. Remove or fix them
4. Restart terminal

### SSL/Credential Errors (schannel errors)

**Symptoms:** `SEC_E_NO_CREDENTIALS` or `schannel: AcquireCredentialsHandle failed`

**Solutions:**

1. **Use GitHub Desktop** (Easiest):
   - Download: https://desktop.github.com/
   - Authenticate once
   - All pushes work automatically

2. **Fix Windows Credential Store**:
   ```powershell
   # Clear git credentials
   git credential reject https://github.com
   # Then try push again - it will prompt for credentials
   ```

3. **Use SSH instead** (if proxy is blocking HTTPS):
   - Follow Option 2 (SSH Keys) above
   - SSH often bypasses proxy issues

### If HTTPS still asks for credentials:

1. Check credential helper:
   ```powershell
   git config --global credential.helper
   ```

2. Clear old credentials:
   - Open "Credential Manager" in Windows
   - Go to "Windows Credentials"
   - Find `git:https://github.com`
   - Remove it
   - Try pushing again

### If SSH doesn't work:

1. Test connection:
   ```bash
   ssh -T git@github.com
   ```

2. Check SSH agent:
   ```bash
   eval "$(ssh-agent -s)"
   ssh-add ~/.ssh/id_ed25519
   ```

---

## For Multi-Agent Workflow

Once set up, all agents (Claude, Codex, you) can push automatically:
- No manual credential entry needed
- Works for all git operations
- Secure and automated

---

## Recommended: Option 1 (Personal Access Token)

For Windows and automation, **Option 1** is recommended because:
- ✅ Works immediately
- ✅ No SSH key management
- ✅ Windows Credential Manager handles it
- ✅ Easy to revoke if needed
