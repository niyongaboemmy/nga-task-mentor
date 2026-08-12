// Resolve .env relative to this file, not process.cwd() -- same fix as
// src/index.ts, applies here too since sequelize-cli loads this file
// directly (bypassing index.ts's own dotenv setup entirely).
require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });

module.exports = {
  development: {
    username: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || "3306"),
    dialect: "mysql",
  },
  production: {
    username: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || "3306"),
    dialect: "mysql",
  },
};
