const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize({
  dialect: 'mysql',
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  username: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  logging: console.log,
});

async function testUserCourse() {
  try {
    await sequelize.authenticate();
    console.log('Database connected successfully');

    // Test if UserCourse model is available
    const UserCourse = sequelize.models.UserCourse;
    if (UserCourse) {
      console.log('UserCourse model found:', UserCourse.name);

      // Test query
      const enrolledCourses = await UserCourse.findAll({
        where: {
          user_id: 3,
          status: "enrolled",
        },
        attributes: ["course_id"],
      });

      console.log('Enrolled courses found:', enrolledCourses.length);
      console.log('Course IDs:', enrolledCourses.map(ec => ec.course_id));

    } else {
      console.log('UserCourse model NOT found in sequelize.models');
      console.log('Available models:', Object.keys(sequelize.models));
    }

  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await sequelize.close();
  }
}

testUserCourse();
