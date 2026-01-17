const { sequelize } = require('./dist/config/database');

// Import all models
require('./dist/models/Assignment.model');
require('./dist/models/Course.model');
require('./dist/models/Submission.model');
require('./dist/models/User.model');
require('./dist/models/UserCourse.model');

async function checkAssignment() {
  try {
    await sequelize.authenticate();
    console.log('Database connected successfully');

    // Get the Assignment model from sequelize
    const Assignment = sequelize.models.Assignment;

    const assignment = await Assignment.findByPk(2);
    if (assignment) {
      console.log('Assignment ID 2:');
      console.log('Title:', assignment.title);
      console.log('Due date:', assignment.due_date);
      console.log('Due date (ISO):', assignment.due_date?.toISOString());
    } else {
      console.log('Assignment with ID 2 not found');
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    if (sequelize.close) {
      await sequelize.close();
    }
  }
}

checkAssignment();
