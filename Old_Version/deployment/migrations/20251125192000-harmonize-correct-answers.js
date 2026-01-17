"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Get all quiz questions
    const questions = await queryInterface.sequelize.query(
      "SELECT id, question_type, question_data, correct_answer FROM quiz_questions",
      { type: Sequelize.QueryTypes.SELECT }
    );

    for (const question of questions) {
      let questionData = question.question_data;
      let correctAnswer = question.correct_answer;

      // Parse JSON if stored as strings
      if (typeof questionData === "string") {
        try {
          questionData = JSON.parse(questionData);
        } catch (e) {
          questionData = {};
        }
      }

      if (typeof correctAnswer === "string") {
        try {
          correctAnswer = JSON.parse(correctAnswer);
        } catch (e) {
          correctAnswer = null;
        }
      }

      let updatedQuestionData = { ...questionData };
      let needsUpdate = false;

      switch (question.question_type) {
        case "single_choice":
          // Ensure correct_option_index is in question_data
          if (
            correctAnswer &&
            typeof correctAnswer === "object" &&
            correctAnswer.correct_option_index !== undefined
          ) {
            updatedQuestionData.correct_option_index =
              correctAnswer.correct_option_index;
            needsUpdate = true;
          } else if (correctAnswer && typeof correctAnswer === "number") {
            updatedQuestionData.correct_option_index = correctAnswer;
            needsUpdate = true;
          } else if (correctAnswer && typeof correctAnswer === "string") {
            const parsed = parseInt(correctAnswer, 10);
            if (!isNaN(parsed)) {
              updatedQuestionData.correct_option_index = parsed;
              needsUpdate = true;
            }
          }
          break;

        case "multiple_choice":
          // Ensure correct_option_indices is in question_data
          if (
            correctAnswer &&
            typeof correctAnswer === "object" &&
            Array.isArray(correctAnswer.correct_option_indices)
          ) {
            updatedQuestionData.correct_option_indices =
              correctAnswer.correct_option_indices.map((idx) =>
                typeof idx === "string" ? parseInt(idx, 10) : idx
              );
            needsUpdate = true;
          } else if (Array.isArray(correctAnswer)) {
            updatedQuestionData.correct_option_indices = correctAnswer.map(
              (idx) => (typeof idx === "string" ? parseInt(idx, 10) : idx)
            );
            needsUpdate = true;
          }
          break;

        case "true_false":
          // Ensure correct_answer is in question_data
          if (
            correctAnswer &&
            typeof correctAnswer === "object" &&
            correctAnswer.answer !== undefined
          ) {
            updatedQuestionData.correct_answer = correctAnswer.answer;
            needsUpdate = true;
          } else if (correctAnswer !== null && correctAnswer !== undefined) {
            if (typeof correctAnswer === "boolean") {
              updatedQuestionData.correct_answer = correctAnswer;
              needsUpdate = true;
            } else if (typeof correctAnswer === "number") {
              updatedQuestionData.correct_answer = correctAnswer === 1;
              needsUpdate = true;
            } else if (typeof correctAnswer === "string") {
              updatedQuestionData.correct_answer =
                correctAnswer.toLowerCase() === "true";
              needsUpdate = true;
            }
          }
          break;

        case "numerical":
          // Ensure correct_answer is in question_data
          if (correctAnswer && typeof correctAnswer === "number") {
            updatedQuestionData.correct_answer = correctAnswer;
            needsUpdate = true;
          } else if (correctAnswer && typeof correctAnswer === "string") {
            const parsed = parseFloat(correctAnswer);
            if (!isNaN(parsed)) {
              updatedQuestionData.correct_answer = parsed;
              needsUpdate = true;
            }
          }
          break;

        case "fill_blank":
          // Ensure acceptable_answers is in question_data
          if (correctAnswer && Array.isArray(correctAnswer)) {
            updatedQuestionData.acceptable_answers = correctAnswer;
            needsUpdate = true;
          }
          break;

        case "matching":
          // Ensure correct_matches is in question_data
          if (
            correctAnswer &&
            typeof correctAnswer === "object" &&
            correctAnswer.mappings
          ) {
            updatedQuestionData.correct_matches = correctAnswer.mappings;
            needsUpdate = true;
          } else if (correctAnswer && typeof correctAnswer === "object") {
            updatedQuestionData.correct_matches = correctAnswer;
            needsUpdate = true;
          }
          break;

        case "ordering":
          // Ensure correct order is in question_data
          if (correctAnswer && Array.isArray(correctAnswer.ordered_item_ids)) {
            // For ordering, the correct order is derived from question_data.items
            // No need to move anything specific
          }
          break;

        case "dropdown":
          // correct_answer contains the correct options for each dropdown
          if (correctAnswer && Array.isArray(correctAnswer)) {
            // Already in correct format, but ensure it's consistent
            // No change needed as dropdown uses correct_answer differently
          }
          break;

        case "coding":
          // For coding, correct answer might be expected code or test cases
          // Test cases are already in question_data
          break;

        default:
          // For other types, no specific action needed
          break;
      }

      if (needsUpdate) {
        await queryInterface.sequelize.query(
          "UPDATE quiz_questions SET question_data = ? WHERE id = ?",
          {
            replacements: [JSON.stringify(updatedQuestionData), question.id],
            type: Sequelize.QueryTypes.UPDATE,
          }
        );
      }
    }

    // Clear the correct_answer column since we've moved everything to question_data
    await queryInterface.sequelize.query(
      "UPDATE quiz_questions SET correct_answer = NULL WHERE correct_answer IS NOT NULL",
      { type: Sequelize.QueryTypes.UPDATE }
    );
  },

  down: async (queryInterface, Sequelize) => {
    // This migration moves data from correct_answer to question_data
    // Down migration would be complex to reverse, so we'll leave it empty
    // In production, you would need to implement proper reversal logic
  },
};
