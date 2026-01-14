# Environment Variables Setup

Create a `.env` file in your server root directory with the following variables:

## Required Environment Variables

```env
# Application Environment
NODE_ENV=production

# Server Port (cPanel may assign automatically, but keep this as fallback)
PORT=5000

# Database Configuration
# Get these from cPanel MySQL Databases section
DB_HOST=localhost
DB_USER=your_database_user
DB_PASS=your_database_password
DB_NAME=your_database_name
DB_PORT=3306

# JWT Secret Key
# IMPORTANT: Generate a strong random string for production
# You can generate one using: openssl rand -base64 32
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# Frontend URL
# Update with your actual frontend domain (for CORS)
CLIENT_URL=https://yourdomain.com

# Timezone
TZ=UTC
```

## How to Create .env File

### Option 1: Using cPanel File Manager
1. Log into cPanel
2. Open File Manager
3. Navigate to your application directory (e.g., `/public_html/api`)
4. Click "New File"
5. Name it `.env` (include the dot at the beginning)
6. Paste the environment variables above
7. Update with your actual values
8. Set permissions to 600 (read/write for owner only)

### Option 2: Using SSH/Terminal
```bash
cd ~/public_html/api
nano .env
# Paste your variables, save (Ctrl+X, Y, Enter)
chmod 600 .env
```

### Option 3: Using cPanel Node.js App Manager
- Some cPanel versions allow setting environment variables directly in the Node.js App configuration
- Check your cPanel's Node.js App section for "Environment Variables" option

## Security Notes

1. **Never commit `.env` file to version control**
2. **Use strong, unique passwords** for database
3. **Generate a random JWT_SECRET** (minimum 32 characters)
4. **Set file permissions to 600** (readable only by owner)
5. **Keep your `.env` file secure** - it contains sensitive credentials

## Testing Your Environment Variables

After setting up `.env`, test your configuration:

```bash
# In cPanel Terminal or SSH
cd ~/public_html/api
node -e "require('dotenv').config(); console.log('DB_HOST:', process.env.DB_HOST); console.log('JWT_SECRET:', process.env.JWT_SECRET ? 'SET' : 'NOT SET');"
```

If variables load correctly, you should see your DB_HOST and "SET" for JWT_SECRET.

