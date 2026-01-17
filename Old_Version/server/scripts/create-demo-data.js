require("dotenv").config({ path: "../.env" });
const { sequelize, User, Course, UserCourse } = require("../models");

async function createDemoData() {
  try {
    console.log("Creating demo accounts and data...");

    // Create demo users
    const users = await User.bulkCreate(
      [
        {
          first_name: "John",
          last_name: "Doe",
          email: "john.doe@student.com",
          password: "password123",
          role: "student",
          department: "Computer Science",
          student_id: "STU001",
        },
        {
          first_name: "Jane",
          last_name: "Smith",
          email: "jane.smith@student.com",
          password: "password123",
          role: "student",
          department: "Computer Science",
          student_id: "STU002",
        },
        {
          first_name: "Dr. Alice",
          last_name: "Johnson",
          email: "alice.johnson@teacher.com",
          password: "password123",
          role: "instructor",
          department: "Computer Science",
        },
        {
          first_name: "Dr. Bob",
          last_name: "Wilson",
          email: "bob.wilson@teacher.com",
          password: "password123",
          role: "instructor",
          department: "Mathematics",
        },
      ],
      { validate: true }
    );

    console.log("✅ Demo users created:", users.length);

    // Create demo courses
    const courses = await Course.bulkCreate(
      [
        {
          code: "CS101",
          title: "Introduction to Computer Science",
          description:
            "Fundamental concepts of programming and computer science",
          credits: 3,
          department: "Computer Science",
          start_date: "2025-01-15",
          end_date: "2025-05-15",
          is_active: true,
          syllabus:
            "Week 1-2: Basic concepts\nWeek 3-4: Programming fundamentals\nWeek 5-6: Data structures",
        },
        {
          code: "CS201",
          title: "Data Structures and Algorithms",
          description: "Advanced programming concepts and algorithm design",
          credits: 4,
          department: "Computer Science",
          start_date: "2025-01-15",
          end_date: "2025-05-15",
          is_active: true,
          syllabus:
            "Week 1-3: Arrays and Lists\nWeek 4-6: Trees and Graphs\nWeek 7-9: Sorting Algorithms",
        },
        {
          code: "MATH101",
          title: "Calculus I",
          description: "Introduction to differential and integral calculus",
          credits: 4,
          department: "Mathematics",
          start_date: "2025-01-15",
          end_date: "2025-05-15",
          is_active: true,
          syllabus:
            "Week 1-4: Limits and Continuity\nWeek 5-8: Differentiation\nWeek 9-12: Integration",
        },
      ],
      { validate: true }
    );

    console.log("✅ Demo courses created:", courses.length);

    // Enroll students in courses
    const johnDoe = users.find((u) => u.email === "john.doe@student.com");
    const janeSmith = users.find((u) => u.email === "jane.smith@student.com");
    const cs101 = courses.find((c) => c.code === "CS101");
    const cs201 = courses.find((c) => c.code === "CS201");
    const math101 = courses.find((c) => c.code === "MATH101");

    if (johnDoe && janeSmith && cs101 && cs201 && math101) {
      await UserCourse.bulkCreate([
        { user_id: johnDoe.id, course_id: cs101.id },
        { user_id: johnDoe.id, course_id: cs201.id },
        { user_id: janeSmith.id, course_id: cs101.id },
        { user_id: janeSmith.id, course_id: math101.id },
      ]);

      console.log("✅ Students enrolled in courses");
    }

    console.log("\n🎉 Demo data created successfully!");
    console.log("\n📋 Demo Accounts:");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    users.forEach((user) => {
      console.log(
        `${user.role.toUpperCase()}: ${user.first_name} ${user.last_name}`
      );
      console.log(`Email: ${user.email}`);
      console.log(`Password: password123`);
      console.log("─────────────────────────────────────────────────");
    });

    console.log("\n📚 Demo Courses:");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    courses.forEach((course) => {
      console.log(`${course.code}: ${course.title}`);
      console.log(`Department: ${course.department}`);
      console.log(`Credits: ${course.credits}`);
      console.log("─────────────────────────────────────────────────");
    });
  } catch (error) {
    console.error("❌ Error creating demo data:", error);
  } finally {
    await sequelize.close();
  }
}

createDemoData();
