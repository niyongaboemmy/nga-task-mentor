import { sequelize } from "../config/database";

/**
 * Standard include to JOIN quiz_questions → question_bank → blooms_taxonomy_levels.
 * Use this everywhere we need full question data returned to the client.
 */
export const getQuestionBankInclude = () => [
  {
    model: sequelize.models.QuestionBank,
    as: "questionBank",
    include: [
      {
        model: sequelize.models.BloomsTaxonomyLevel,
        as: "bloomsLevel",
        attributes: ["id", "name", "level_order"],
        required: false,
      },
    ],
  },
];
