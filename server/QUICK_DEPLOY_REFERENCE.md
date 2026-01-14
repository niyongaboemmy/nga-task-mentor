# Quick Deployment Reference - cPanel

## Quick Steps

### 1. Build Locally
```bash
cd spwms/server
./build-and-deploy.sh
# Or manually:
npm install
npm run build
```

### 2. Prepare for Upload
Files to upload to cPanel:
- `dist/` folder (compiled JavaScript)
- `package.json`
- `package-lock.json`
- `uploads/` (if exists)
- `migrations/` (if needed)
- `.env` (create on server with production values)

### 3. cPanel Setup

**Create MySQL Database:**
- Database name: `yourdomain_api_db`
- User: `yourdomain_dbuser`
- Password: (strong password)
- Host: Usually `localhost`

**Create Node.js App:**
- Application Root: `/api` (or your chosen path)
- Startup File: `dist/index.js`
- Node.js Version: 18.x or 20.x (LTS)
- Port: Auto-assigned by cPanel

**Environment Variables (.env or in Node.js App settings):**
```env
NODE_ENV=production
PORT=5000
DB_HOST=localhost
DB_USER=yourdomain_dbuser
DB_PASS=your_secure_password
DB_NAME=yourdomain_api_db
DB_PORT=3306
JWT_SECRET=generate-strong-random-secret
CLIENT_URL=https://yourdomain.com
TZ=UTC
```

### 4. Install & Start
```bash
cd ~/public_html/api
npm install --production
npm start
# Or restart via cPanel Node.js App Manager
```

### 5. Verify
- Check health: `https://api.yourdomain.com/health`
- Check logs in cPanel Node.js section

## Common Issues

**Won't start:** Check logs, verify PORT matches cPanel assigned port
**DB error:** Verify credentials, check host (may not be localhost)
**404 errors:** Verify startup file is `dist/index.js`
**Permissions:** Ensure uploads/ is writable (chmod 775)

## File Structure on Server
```
~/public_html/api/
├── dist/
│   └── index.js
├── uploads/
├── migrations/
├── package.json
├── package-lock.json
├── .env
└── node_modules/
```

---

See `DEPLOYMENT_GUIDE_CPANEL.md` for detailed instructions.

