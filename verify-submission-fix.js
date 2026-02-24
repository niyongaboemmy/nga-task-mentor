const { Submission, Assignment } = require("./server/src/models");
const { sequelize } = require("./server/src/config/database");

async function testSubmissionValidation() {
  try {
    // 1. Create a dummy assignment with null allowed_file_types
    const assignment = await Assignment.create({
      title: "Test Assignment " + Date.now(),
      description: "Test Description",
      due_date: new Date(Date.now() + 86400000), // Tomorrow
      max_score: 100,
      submission_type: "file",
      allowed_file_types: null,
      status: "published",
      created_by: 1,
    });

    console.log("Created assignment with allowed_file_types: null");

    // 2. Try to create a submission with a PDF file
    const submission = await Submission.create({
      assignment_id: assignment.id,
      student_id: 1,
      status: "submitted",
      submitted_at: new Date(),
      file_submissions: [
        {
          filename: "test-file.pdf",
          originalname: "test-file.pdf",
          mimetype: "application/pdf",
          size: 100,
          path: "/dummy/path",
        },
      ],
    });

    console.log("Submission with PDF succeeded (Expected)");

    // 3. Update assignment to only allow .docx
    await assignment.update({ allowed_file_types: [".docx"] });
    console.log("Updated assignment to only allow .docx");

    // 4. Try to create another submission for a different student with PDF (should fail)
    try {
      await Submission.create({
        assignment_id: assignment.id,
        student_id: 2,
        status: "submitted",
        submitted_at: new Date(),
        file_submissions: [
          {
            filename: "test-file.pdf",
            originalname: "test-file.pdf",
            mimetype: "application/pdf",
            size: 100,
            path: "/dummy/path",
          },
        ],
      });
      console.error("Submission with PDF succeeded but should have failed");
    } catch (error) {
      console.log("Submission with PDF failed as expected:", error.message);
    }

    // 5. Cleanup
    await assignment.destroy();
    console.log("Cleaned up test data");
  } catch (error) {
    console.error("Verification failed:", error);
  } finally {
    await sequelize.close();
  }
}

testSubmissionValidation();
