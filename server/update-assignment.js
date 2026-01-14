const { sequelize } = require('./dist/config/database');
const { Assignment } = require('./dist/models/Assignment.model');

// Update assignment due date to today at 20:00 Kigali time (18:00 UTC)
async function updateAssignmentDueDate() {
  try {
    // Connect to database
    await sequelize.authenticate();
    console.log('Database connected successfully');

    // Calculate today at 20:00 Kigali time (which is 18:00 UTC)
    const today = new Date();
    const kigaliTime = new Date(today.getTime() + (2 * 60 * 60 * 1000)); // Add 2 hours for Kigali timezone
    const targetDate = new Date(kigaliTime.getFullYear(), kigaliTime.getMonth(), kigaliTime.getDate(), 20, 0, 0);

    // Convert to UTC (subtract 2 hours)
    const utcDate = new Date(targetDate.getTime() - (2 * 60 * 60 * 1000));

    console.log('Current date:', new Date().toISOString());
    console.log('Target Kigali time:', targetDate.toISOString());
    console.log('UTC equivalent:', utcDate.toISOString());
    console.log('Updating assignment ID 2...');

    // Update assignment
    const [affectedRows] = await Assignment.update(
      { due_date: utcDate },
      { where: { id: 2 } }
    );

    console.log('Affected rows:', affectedRows);

    if (affectedRows > 0) {
      console.log(`✅ Successfully updated assignment ID 2 due date to: ${utcDate.toISOString()}`);

      // Verify the update
      const updatedAssignment = await Assignment.findByPk(2);
      console.log('Updated assignment due_date:', updatedAssignment?.due_date?.toISOString());
      console.log('✅ Assignment due date updated successfully!');
    } else {
      console.log('❌ No assignment found with ID 2');
    }

  } catch (error) {
    console.error('❌ Error updating assignment:', error);
  } finally {
    if (sequelize.close) {
      await sequelize.close();
    }
  }
}

updateAssignmentDueDate();
