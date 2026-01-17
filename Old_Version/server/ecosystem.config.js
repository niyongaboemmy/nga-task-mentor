/**
 * PM2 Ecosystem Configuration
 * Use this if you want to manage the app with PM2 on the server
 *
 * To use:
 * 1. Install PM2: npm install -g pm2
 * 2. Start: pm2 start ecosystem.config.js
 * 3. Save: pm2 save
 * 4. Setup startup: pm2 startup
 */

module.exports = {
  apps: [
    {
      name: "spwms-api",
      script: "./dist/index.js",
      instances: 1,
      exec_mode: "fork",
      watch: false,
      max_memory_restart: "500M",
      env: {
        NODE_ENV: "production",
        PORT: 5000,
      },
      env_production: {
        NODE_ENV: "production",
        PORT: 5000,
      },
      error_file: "./logs/pm2-error.log",
      out_file: "./logs/pm2-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      merge_logs: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: "10s",
    },
  ],
};
