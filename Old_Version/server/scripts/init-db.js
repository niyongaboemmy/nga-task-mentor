require("dotenv").config({ path: "./.env" });
const { sequelize, Sequelize } = require("./src/config/database");
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const { User, Course, Assignment, Submission } = require("./src/models");

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || "localhost",
  username: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "taskmentor_dev",
  dialect: "mysql",
  logging: console.log,
};

// Create database if it doesn't exist
async function createDatabase() {
  const tempSequelize = new Sequelize(
    "",
    dbConfig.username,
    dbConfig.password,
    {
      host: dbConfig.host,
      dialect: "mysql",
      logging: false,
    }
  );

  try {
    await tempSequelize.query(
      `CREATE DATABASE IF NOT EXISTS \`${dbConfig.database}\`;`
    );
    console.log(`Database ${dbConfig.database} is ready`);
  } catch (error) {
    console.error("Error creating database:", error);
    throw error;
  } finally {
    await tempSequelize.close();
  }
}

// Initialize the database
async function initializeDatabase() {
  try {
    console.log("Starting database initialization...");

    // 1. Create database if it doesn't exist
    await createDatabase();

    // 2. Test the database connection
    await sequelize.authenticate();
    console.log("Database connection established successfully.");

    // 3. Create uploads directory if it doesn't exist
    const uploadsDir = path.join(__dirname, "../../uploads");
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
      console.log("Uploads directory created successfully");
    }

    // 4. Sync all models
    console.log("Syncing database models...");
    await sequelize.sync({ force: false, alter: true });
    console.log("Database models synchronized successfully");

    // 5. Create default admin user if not exists
    const adminEmail = process.env.ADMIN_EMAIL || "admin@spwms.com";
    const adminPassword = process.env.ADMIN_PASSWORD || "admin123";

    const [admin, created] = await User.findOrCreate({
      where: { email: adminEmail },
      defaults: {
        firstName: "Admin",
        lastName: "User",
        email: adminEmail,
        password: await bcrypt.hash(adminPassword, 10),
        role: "admin",
        isActive: true,
      },
    });

    if (created) {
      console.log("\n=== ADMIN CREDENTIALS ===");
      console.log(`Email: ${adminEmail}`);
      console.log(`Password: ${adminPassword}`);
      console.log("========================\n");
      console.log(
        "Please change the default admin password after first login!"
      );
    } else {
      console.log("Admin user already exists");
    }

    // 6. Create some sample data in development
    if (process.env.NODE_ENV === "development") {
      await createSampleData();
    }

    console.log("\nDatabase initialization completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("\nError initializing database:", error);
    process.exit(1);
  }
}

// Create sample data for development
async function createSampleData() {
  try {
    // Create sample instructor
    const [instructor] = await User.findOrCreate({
      where: { email: "instructor@spwms.com" },
      defaults: {
        firstName: "John",
        lastName: "Doe",
        email: "instructor@spwms.com",
        password: await bcrypt.hash("instructor123", 10),
        role: "instructor",
        isActive: true,
      },
    });

    // Create sample student
    const [student] = await User.findOrCreate({
      where: { email: "student@spwms.com" },
      defaults: {
        firstName: "Jane",
        lastName: "Smith",
        email: "student@spwms.com",
        password: await bcrypt.hash("student123", 10),
        role: "student",
        studentId: "STU" + Math.floor(1000 + Math.random() * 9000),
        isActive: true,
      },
    });

    // Create sample course
    const [course] = await Course.findOrCreate({
      where: { code: "CS101" },
      defaults: {
        title: "Introduction to Computer Science",
        description: "Basic concepts of computer science and programming",
        credits: 3,
        instructorId: instructor.id,
        startDate: new Date(),
        endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days from now
        isActive: true,
      },
    });

    // Enroll student in course
    await course.addStudent(student);

    // Create sample assignment
    const [assignment] = await Assignment.findOrCreate({
      where: { title: "First Programming Assignment" },
      defaults: {
        courseId: course.id,
        title: "First Programming Assignment",
        description: 'Write a simple program that prints "Hello, World!"',
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
        maxScore: 100,
        status: "published",
        isPublished: true,
        publishedAt: new Date(),
        createdBy: instructor.id,
      },
    });

    console.log("\n=== SAMPLE DATA CREATED ===");
    console.log(`Instructor: instructor@spwms.com / instructor123`);
    console.log(`Student: student@spwms.com / student123`);
    console.log(`Course: ${course.code} - ${course.title}`);
    console.log(
      `Assignment: ${
        assignment.title
      } (Due: ${assignment.dueDate.toDateString()})`
    );
    console.log("==========================\n");
  } catch (error) {
    console.error("Error creating sample data:", error);
  }
}

// Run the initialization
initializeDatabase();
