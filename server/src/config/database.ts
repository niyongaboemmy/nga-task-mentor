import { Sequelize } from "sequelize-typescript";

const sequelize = new Sequelize({
  database: process.env.DB_NAME!,
  username: process.env.DB_USER!,
  password: process.env.DB_PASS!,
  host: process.env.DB_HOST!,
  port: parseInt(process.env.DB_PORT || "3306"),
  dialect: "mysql",
  logging: process.env.NODE_ENV === "development" ? console.log : false,
  timezone: "+00:00", // Ensure all dates are handled in UTC
  dialectOptions: {
    // Ensure MySQL connection uses UTC
    timezone: "Z",
    typeCast: function (field: any, next: any) {
      if (field.type === "DATETIME" || field.type === "DATE") {
        const value = field.string();
        return value ? new Date(value) : null;
      }
      return next();
    },
  },
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
  models: [], // Initialize with empty array, models will be added later
});

// Test the database connection
const testConnection = async (): Promise<void> => {
  try {
    await sequelize.authenticate();
    console.log("Database connection has been established successfully.");
  } catch (error) {
    console.error("Unable to connect to the database:", error);
    process.exit(1);
  }
};

export { sequelize, testConnection, Sequelize };

// Define types for database configuration
declare global {
  namespace NodeJS {
    interface ProcessEnv {
      NODE_ENV: "development" | "production" | "test";
      DB_HOST: string;
      DB_USER: string;
      DB_PASS: string;
      DB_NAME: string;
      JWT_SECRET: string;
      CLIENT_URL?: string;
      PORT?: string;
      NGA_MIS_BASE_URL: string;
    }
  }
}
