// ─── Mock API response fixtures for Report Card E2E tests ────────────────────

export const COURSE_ID = 1;
export const STUDENT_ID = 201;

export const MOCK_COURSE = {
  id: COURSE_ID,
  title: "Mathematics",
  code: "MATH101",
};

export const MOCK_QUIZZES = [
  { id: 10, title: "Algebra Quiz 1", course_id: COURSE_ID },
  { id: 11, title: "Geometry Quiz 2", course_id: COURSE_ID },
];

export const MOCK_ASSIGNMENTS = [
  { id: 20, title: "Homework Set A", course_id: COURSE_ID },
  { id: 21, title: "Project Beta", course_id: COURSE_ID },
];

export const MOCK_STUDENTS = [
  { id: STUDENT_ID, first_name: "John", last_name: "Doe" },
  { id: 202, first_name: "Jane", last_name: "Smith" },
];

export const MOCK_BUILDER_SAVE_RESPONSE = {
  success: true,
  message: "Assessment mappings saved successfully",
  data: {
    report_card_id: 7,
    mappings_count: 2,
    assessments: [
      { subject_id: COURSE_ID, assessment_type: "assignment", assessment_id: 20, category: "HW" },
      { subject_id: COURSE_ID, assessment_type: "quiz",       assessment_id: 10, category: "MD" },
    ],
  },
};

export const MOCK_ATTRIBUTES_SAVE_RESPONSE = {
  success: true,
  message: "Attributes and teacher comment saved successfully",
  data: {
    report_card_id: 7,
    class_teacher_comment: "Excellent progress this term.",
    attendance: { present: 1, absent: 0, late: 0 },
    attributes: [
      { attribute_name: "Punctuality", rating: "Excellent" },
      { attribute_name: "Obedience",   rating: "Very good" },
    ],
  },
};

export const MOCK_REPORT_CARD_DATA = {
  success: true,
  data: {
    report_card: {
      id: 7,
      uuid: "abcd-1234-efgh-5678",
      student_id: STUDENT_ID,
      term: "Term 2",
      academic_year: "2025-2026",
      class_teacher_comment: "Excellent progress this term.",
      attendance: { present: 40, absent: 2, late: 1, total_days: 43 },
    },
    grades: [
      {
        subject_id: COURSE_ID,
        total_score: 81.5,
        categories: {
          HW:  { scaled_score: 8.5,  weight: 10, avg_percentage: 85, assessments: [] },
          MD:  { scaled_score: 20.0, weight: 25, avg_percentage: 80, assessments: [] },
          EOT: { scaled_score: 42.5, weight: 50, avg_percentage: 85, assessments: [] },
        },
      },
    ],
    attributes: [
      { attribute_name: "Punctuality", rating: "Excellent" },
      { attribute_name: "Obedience",   rating: "Very good" },
      { attribute_name: "Neatness",    rating: "Good" },
    ],
  },
};

export const MOCK_PDF_BYTES = Buffer.from("mock-pdf-binary-data");
