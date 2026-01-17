const mysql = require('mysql2/promise');

// Database configuration (same as your server)
const dbConfig = {
  host: '127.0.0.1',
  user: 'root',
  password: '',
  database: 'spwms_dev'
};

async function updateAssignmentDueDate() {
  let connection;

  try {
    // Connect to database
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Database connected successfully');

    // Calculate today at 20:00 Kigali time (which is 18:00 UTC)
    const today = new Date();
    const kigaliTime = new Date(today.getTime() + (2 * 60 * 60 * 1000)); // Add 2 hours for Kigali timezone
    const targetDate = new Date(kigaliTime.getFullYear(), kigaliTime.getMonth(), kigaliTime.getDate(), 20, 0, 0);

    // Convert to UTC (subtract 2 hours)
    const utcDate = new Date(targetDate.getTime() - (2 * 60 * 60 * 1000));

    console.log('📅 Current date:', new Date().toISOString());
    console.log('🎯 Target Kigali time (20:00):', targetDate.toISOString());
    console.log('🌍 UTC equivalent:', utcDate.toISOString());

    // Update assignment
    const [result] = await connection.execute(
      'UPDATE assignments SET due_date = ?, updated_at = NOW() WHERE id = ?',
      [utcDate, 2]
    );

    console.log('📊 Update result:', result);

    if (result.affectedRows > 0) {
      console.log('✅ Successfully updated assignment ID 2');

      // Verify the update
      const [rows] = await connection.execute(
        'SELECT id, title, due_date FROM assignments WHERE id = ?',
        [2]
      );

      if (rows.length > 0) {
        console.log('🔍 Verified assignment:');
        console.log('   Title:', rows[0].title);
        console.log('   Due date:', rows[0].due_date);
        console.log('   Due date (ISO):', new Date(rows[0].due_date).toISOString());
        console.log('✅ Assignment due date updated successfully!');
      }
    } else {
      console.log('❌ No assignment found with ID 2');
    }

  } catch (error) {
    console.error('❌ Error updating assignment:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

updateAssignmentDueDate();
