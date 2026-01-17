# Deployment Guide: Backend Server to Namecheap cPanel

This guide will walk you through deploying the Node.js backend server to Namecheap cPanel hosting.

## Prerequisites

1. **Namecheap cPanel Access**: Access to your cPanel account
2. **Node.js Version**: cPanel typically supports Node.js 14.x, 16.x, 18.x, or 20.x
3. **MySQL Database**: Access to create/manage MySQL databases in cPanel
4. **File Upload Method**: Use cPanel File Manager or FTP/SFTP client

## Step 1: Prepare Your Build Locally

### 1.1 Build the TypeScript Project

On your local machine, navigate to the server directory and build:

```bash
cd spwms/server
npm install --production=false  # Install all dependencies including devDependencies
npm run build                   # Compile TypeScript to JavaScript
```

This will create a `dist/` folder with compiled JavaScript files.

### 1.2 Create Production Package

Create a deployment package with only necessary files:

```bash
# From the server directory, create a clean deployment package
mkdir -p ../deployment
cp -r dist ../deployment/
cp package.json ../deployment/
cp package-lock.json ../deployment/
cp -r uploads ../deployment/  # If you have existing uploads
cp -r migrations ../deployment/  # If you need to run migrations
```

**Files to exclude:**

- `src/` (source TypeScript files - not needed)
- `node_modules/` (will be installed on server)
- Development files and scripts
- `.env` files (will create on server)
- Test files

## Step 2: Set Up Database in cPanel

### 2.1 Create MySQL Database

1. Log into **cPanel**
2. Navigate to **MySQL Databases**
3. Create a new database (e.g., `yourdomain_api_db`)
4. Create a database user with a strong password
5. Add the user to the database with **ALL PRIVILEGES**
6. Note down:
   - Database name: `yourdomain_api_db`
   - Database user: `yourdomain_dbuser`
   - Database password: `your_secure_password`
   - Database host: Usually `localhost` (or check your cPanel for the correct host)

### 2.2 Import Database Schema (if needed)

1. In cPanel, go to **phpMyAdmin**
2. Select your database
3. Import your SQL schema file if you have one (`taskmentor_dev.sql` or similar)
4. Or the migrations will create tables automatically

## Step 3: Upload Files to cPanel

### 3.1 Access File Manager or Use FTP

**Option A: cPanel File Manager**

1. Log into cPanel
2. Open **File Manager**
3. Navigate to your domain's root or create a subdirectory (e.g., `api` or `server`)

**Option B: FTP/SFTP**

- Use FileZilla, WinSCP, or similar
- Connect using your cPanel FTP credentials
- Upload to your chosen directory

### 3.2 Upload Your Files

Upload the following structure:

```
/public_html/
  └── api/  (or your chosen directory)
      ├── dist/
      ├── uploads/
      ├── migrations/
      ├── package.json
      ├── package-lock.json
      └── .env  (create this in next step)
```

## Step 4: Set Up Node.js App in cPanel

### 4.1 Create Node.js App

1. In cPanel, find **Node.js** or **Setup Node.js App**
2. Click **Create Application**
3. Configure:
   - **Node.js Version**: Select latest LTS (18.x or 20.x recommended)
   - **Application Mode**: Production
   - **Application Root**: `/api` (or your chosen directory)
   - **Application URL**: Choose a subdomain or path (e.g., `api.yourdomain.com` or `yourdomain.com/api`)
   - **Application Startup File**: `dist/index.js`
   - **Application Port**: Leave default (cPanel will assign)
   - **Environment Variables**: Add these (see Step 5)

### 4.2 Configure Environment Variables

In the Node.js App setup, add these environment variables:

```
NODE_ENV=production
PORT=5000
DB_HOST=localhost
DB_USER=yourdomain_dbuser
DB_PASS=your_secure_password
DB_NAME=yourdomain_api_db
DB_PORT=3306
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
CLIENT_URL=https://yourdomain.com
TZ=UTC
```

**Important Notes:**

- Generate a strong `JWT_SECRET` (use a random string generator)
- Update `DB_*` values with your actual database credentials
- Update `CLIENT_URL` with your frontend domain

### 4.3 Alternative: Create .env File

If cPanel doesn't support environment variables directly, create a `.env` file in your application root:

```bash
# In cPanel File Manager, create .env file in /api directory
NODE_ENV=production
PORT=5000
DB_HOST=localhost
DB_USER=yourdomain_dbuser
DB_PASS=your_secure_password
DB_NAME=yourdomain_api_db
DB_PORT=3306
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
CLIENT_URL=https://yourdomain.com
TZ=UTC
```

**Set proper permissions:**

- `.env` file: 600 (readable only by owner)

## Step 5: Install Dependencies

### Option A: Using cPanel Terminal/SSH

1. In cPanel, open **Terminal** or **SSH Access**
2. Navigate to your application directory:
   ```bash
   cd ~/public_html/api
   ```
3. Install production dependencies:
   ```bash
   npm install --production
   ```

### Option B: Using Node.js App Manager

1. In **Node.js App** section of cPanel
2. Click on your app
3. Use **NPM Install** button if available
4. Or use **Run JS script** to run: `npm install --production`

## Step 6: Run Database Migrations (if needed)

If you have database migrations:

```bash
cd ~/public_html/api
npm run migrate
```

Or manually run SQL scripts via phpMyAdmin if migrations don't work.

## Step 7: Set Up File Permissions

Set proper permissions:

```bash
cd ~/public_html/api
chmod 755 dist/
chmod 755 uploads/
chmod 644 dist/index.js
chmod 600 .env  # If using .env file
```

For uploads directory (if users will upload files):

```bash
chmod 775 uploads/
chown -R youruser:youruser uploads/
```

## Step 8: Start/Restart the Application

### Using cPanel Node.js App Manager

1. Go to **Node.js** section in cPanel
2. Find your application
3. Click **Restart App** or **Start App**

### Verify It's Running

1. Check application logs in cPanel Node.js section
2. Visit your health endpoint: `https://api.yourdomain.com/health`
3. Should return: `{"status":"ok","timestamp":"..."}`

## Step 9: Configure Domain/Subdomain

### If Using Subdomain (Recommended)

1. In cPanel, go to **Subdomains**
2. Create subdomain: `api.yourdomain.com`
3. Point it to `/public_html/api` or your app directory
4. Update Node.js App URL in Node.js App Manager

### Update CORS Settings

Update `src/index.ts` CORS configuration to include your production domains, then rebuild:

```typescript
origin: [
  'https://yourdomain.com',
  'https://www.yourdomain.com',
  'https://api.yourdomain.com',
]
```

Rebuild and re-upload the `dist/` folder.

## Step 10: Set Up Process Manager (Optional but Recommended)

If cPanel doesn't provide automatic process management, consider setting up PM2:

1. Install PM2 globally in Node.js app:

   ```bash
   npm install -g pm2
   ```

2. Create PM2 ecosystem file (`ecosystem.config.js`):

   ```javascript
   module.exports = {
     apps: [
       {
         name: 'spwms-api',
         script: './dist/index.js',
         instances: 1,
         exec_mode: 'fork',
         env: {
           NODE_ENV: 'production',
           PORT: 5000,
         },
         error_file: './logs/err.log',
         out_file: './logs/out.log',
         log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
       },
     ],
   }
   ```

3. Start with PM2:
   ```bash
   pm2 start ecosystem.config.js
   pm2 save
   pm2 startup
   ```

## Step 11: Configure SSL Certificate

1. In cPanel, go to **SSL/TLS Status**
2. Install Let's Encrypt SSL for your API subdomain
3. Force HTTPS redirect if needed

## Step 12: Set Up Cron Jobs (if needed)

If you need scheduled tasks, use cPanel **Cron Jobs**:

1. Go to **Cron Jobs** in cPanel
2. Add cron job to restart app or run maintenance tasks
3. Example (restart daily at 3 AM):
   ```
   0 3 * * * cd ~/public_html/api && /usr/bin/node dist/index.js
   ```

## Troubleshooting

### Application Won't Start

1. **Check Logs**: View application logs in cPanel Node.js section
2. **Check Port**: Ensure PORT environment variable matches cPanel assigned port
3. **Check Database Connection**: Verify DB credentials in `.env`
4. **Check File Permissions**: Ensure `dist/index.js` is executable

### Database Connection Errors

1. Verify database credentials
2. Check database host (might not be `localhost` - check cPanel MySQL section)
3. Ensure database user has proper permissions
4. Check if remote MySQL connections are allowed

### 404 Errors

1. Verify application startup file path: `dist/index.js`
2. Check that `dist/` folder was uploaded correctly
3. Verify Node.js App root directory is correct

### Permission Errors

1. Check uploads directory permissions
2. Ensure Node.js user has write access to uploads
3. Verify file ownership

### Environment Variables Not Loading

1. Check `.env` file exists and is in correct location
2. Verify `.env` file permissions (600)
3. Check environment variables are set in Node.js App Manager
4. Restart application after changing environment variables

## Post-Deployment Checklist

- [ ] Application starts without errors
- [ ] Health endpoint responds: `/health`
- [ ] Database connection works
- [ ] API endpoints are accessible
- [ ] CORS is configured for frontend domain
- [ ] SSL certificate is installed
- [ ] Uploads directory has write permissions
- [ ] Environment variables are set correctly
- [ ] Application restarts automatically after server reboot
- [ ] Logs are accessible and monitored

## Maintenance

### Updating the Application

1. Build locally: `npm run build`
2. Upload new `dist/` folder to server
3. Restart application in cPanel
4. Check logs for errors

### Monitoring

- Check application logs regularly in cPanel
- Monitor database usage
- Check disk space (especially uploads folder)
- Monitor Node.js app memory usage

## Support Resources

- **Namecheap Support**: https://www.namecheap.com/support/
- **cPanel Documentation**: https://docs.cpanel.net/
- **Node.js cPanel Guide**: Check Namecheap knowledge base for Node.js hosting

---

**Note**: If your Namecheap hosting doesn't support Node.js applications directly, you may need to:

1. Upgrade to a VPS or dedicated server
2. Use a different hosting provider (DigitalOcean, AWS, Heroku, etc.)
3. Contact Namecheap support to enable Node.js support on your plan
