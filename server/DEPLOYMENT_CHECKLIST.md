# Deployment Checklist - cPanel

Use this checklist during deployment to ensure nothing is missed.

## Pre-Deployment (Local)

- [ ] Code is tested and working locally
- [ ] All dependencies are in `package.json`
- [ ] TypeScript code compiles without errors (`npm run build`)
- [ ] `dist/` folder is generated successfully
- [ ] Environment variables documented (see `ENV_SETUP.md`)

## Build Process

- [ ] Run `./build-and-deploy.sh` or manually:
  - [ ] `npm install` (to get dev dependencies)
  - [ ] `npm run build` (creates `dist/` folder)
  - [ ] Verify `dist/index.js` exists
  - [ ] Verify `dist/` contains all compiled files

## Database Setup (cPanel)

- [ ] Created MySQL database in cPanel
- [ ] Created database user with strong password
- [ ] Granted ALL PRIVILEGES to user
- [ ] Noted database credentials:
  - [ ] Database name: `_________________`
  - [ ] Database user: `_________________`
  - [ ] Database password: `_________________`
  - [ ] Database host: `_________________`
- [ ] Imported schema/SQL (if needed) via phpMyAdmin
- [ ] Tested database connection

## File Upload (cPanel)

- [ ] Created application directory (e.g., `/public_html/api`)
- [ ] Uploaded `dist/` folder
- [ ] Uploaded `package.json`
- [ ] Uploaded `package-lock.json`
- [ ] Uploaded `uploads/` folder (if exists)
- [ ] Uploaded `migrations/` folder (if needed)
- [ ] Created `.env` file with production values
- [ ] Set `.env` permissions to 600

## Node.js App Setup (cPanel)

- [ ] Located "Node.js" or "Setup Node.js App" in cPanel
- [ ] Created new Node.js application
- [ ] Configured:
  - [ ] Node.js version: `_____` (18.x or 20.x recommended)
  - [ ] Application mode: Production
  - [ ] Application root: `_____`
  - [ ] Application URL: `_____`
  - [ ] Startup file: `dist/index.js`
  - [ ] Port: `_____` (auto-assigned or manual)
- [ ] Set environment variables (or created `.env` file)
- [ ] Saved configuration

## Environment Variables

- [ ] `NODE_ENV=production`
- [ ] `PORT=` (matches cPanel assigned port)
- [ ] `DB_HOST=` (usually `localhost`)
- [ ] `DB_USER=` (database username)
- [ ] `DB_PASS=` (database password)
- [ ] `DB_NAME=` (database name)
- [ ] `DB_PORT=3306`
- [ ] `JWT_SECRET=` (strong random string)
- [ ] `CLIENT_URL=` (frontend domain)
- [ ] `TZ=UTC`

## Dependencies & Startup

- [ ] Installed dependencies: `npm install --production`
- [ ] Verified `node_modules/` exists
- [ ] Started/restarted Node.js app in cPanel
- [ ] Checked application logs for errors
- [ ] Application shows "running" status

## Verification

- [ ] Health endpoint responds: `https://your-domain.com/health`
- [ ] Returns: `{"status":"ok","timestamp":"..."}`
- [ ] Tested API endpoints (login, etc.)
- [ ] Database connections working
- [ ] CORS configured correctly for frontend
- [ ] File uploads working (if applicable)

## SSL & Security

- [ ] SSL certificate installed for API domain
- [ ] HTTPS working correctly
- [ ] `.env` file permissions: 600
- [ ] Uploads directory permissions: 775 (if needed)
- [ ] Sensitive files not accessible via web

## Domain Configuration

- [ ] Subdomain created (if using): `api.yourdomain.com`
- [ ] Subdomain points to application directory
- [ ] DNS propagated (if new subdomain)
- [ ] SSL installed for subdomain

## Monitoring & Maintenance

- [ ] Application logs accessible
- [ ] Know where to check logs in cPanel
- [ ] Set up process monitoring (PM2 optional)
- [ ] Documented update procedure
- [ ] Backup strategy in place

## Post-Deployment

- [ ] Updated frontend with new API URL
- [ ] Tested full application flow
- [ ] Verified all features working
- [ ] Performance tested
- [ ] Error handling verified
- [ ] Documented any custom configurations

## Troubleshooting Notes

_Use this space to note any issues encountered and their solutions:_

- Issue: _________________________________________
  Solution: _______________________________________

- Issue: _________________________________________
  Solution: _______________________________________

---

## Emergency Rollback Plan

If deployment fails:

1. [ ] Stop Node.js app in cPanel
2. [ ] Revert to previous working version
3. [ ] Restart application
4. [ ] Verify it works
5. [ ] Document what went wrong

---

**Deployment Date:** _______________
**Deployed By:** _______________
**Deployment Status:** ☐ Success  ☐ Failed  ☐ Partial

