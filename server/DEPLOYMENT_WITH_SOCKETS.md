# Deployment Guide: Node.js + Socket.io on cPanel

This guide provides the specific steps required to get your backend server running on cPanel with working WebSockets (Socket.io).

## 1. Prepare Your Build
Locally, build your project to generate the `dist` folder:
```bash
cd server
npm install
npm run build
```

## 2. Upload Files to cPanel
Upload the following files to your application directory (e.g., `/repositories/server`):
- `dist/` (the entire folder)
- `package.json`
- `package-lock.json`
- `uploads/` (if empty, create it on the server)
- `migrations/` (if using Sequelize migrations)

## 3. Setup Node.js App in cPanel
1. Go to **"Setup Node.js App"** in cPanel.
2. Click **"Create Application"**.
3. **Node.js Version**: Select 18.x or 20.x.
4. **Application Mode**: Production.
5. **Application Root**: Path to your files (e.g., `repositories/server`).
6. **Application URL**: Your domain or subdomain (e.g., `api.yourdomain.com`).
7. **Application Startup File**: `dist/index.js`.
8. Click **Create** and then **Stop App** (temporarily).

## 4. Install Dependencies
1. Scroll down to the **"Detected configuration files"** section.
2. Click **"Run NPM Install"**.
3. Alternatively, copy the "enter the virtual environment" command from the top of the page, paste it into your cPanel Terminal, and run `npm install --production`.

## 5. Environment Variables (.env)
Create a `.env` file in your **Application Root** with the following production values:
```bash
NODE_ENV=production
PORT=5000
DB_HOST=localhost
DB_USER=cpaneluser_dbuser
DB_PASS=your_secure_password
DB_NAME=cpaneluser_dbname
JWT_SECRET=your_random_secret_here
CLIENT_URL=https://your-frontend-domain.com
```
> [!IMPORTANT]
> Make sure `CLIENT_URL` matches your actual frontend domain to avoid CORS issues.

## 6. The WebSockets Configuration (.htaccess)
For Sockets to work through Apache on cPanel, you must add proxy rules to your `.htaccess` file. This file is usually located in the directory mapped to your **Application URL** (e.g., `public_html/api` or the subdomain root).

Add these lines to the **TOP** of your `.htaccess`:

```apache
# Enable WebSocket Proxy
RewriteEngine On
RewriteCond %{HTTP:Upgrade} =websocket [NC]
RewriteRule /(.*) ws://localhost:5000/$1 [P,L]
RewriteCond %{HTTP:Connection} Upgrade [NC]
RewriteRule /(.*) ws://localhost:5000/$1 [P,L]

# Normal HTTP Proxy (managed by Passenger usually, but added for safety)
# If your app root is different, adjust localhost:5000 to the cPanel internal port if needed
```

> [!TIP]
> Most cPanel setups using Passenger will automatically handle the standard HTTP traffic, but the `Upgrade` header for WebSockets often needs this explicit rewrite rule.

## 7. Start the Application
1. Go back to **"Setup Node.js App"**.
2. Click **"Start App"**.
3. Check the logs at `stderr.log` in your application root if it doesn't start.

## 8. Frontend Connection
When connecting from your React/Vite frontend, use the production URL:
```javascript
const socket = io("https://api.yourdomain.com", {
  transports: ["websocket"], // Force websocket for better performance through cPanel proxy
  secure: true
});
```

## Troubleshooting
- **CORS Error**: Ensure `CLIENT_URL` in `.env` includes the protocol (https://).
- **Socket Disconnects**: Ensure you are using `wss://` (HTTPS) for the socket connection.
- **503 Service Unavailable**: Usually means the Node.js process crashed. Check `stderr.log`.
