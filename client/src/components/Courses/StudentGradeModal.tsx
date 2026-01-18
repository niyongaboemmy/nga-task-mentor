import React from "react";

interface StudentGradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: any | null; // Using any for flexibility with the composite grade object, but ideally reused type
}

const StudentGradeModal: React.FC<StudentGradeModalProps> = ({
  isOpen,
  onClose,
  student,
}) => {
  if (!isOpen || !student) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div
          className="fixed inset-0 transition-opacity"
          aria-hidden="true"
          onClick={onClose}
        >
          <div className="absolute inset-0 bg-gray-500 opacity-75 dark:bg-gray-900/80 backdrop-blur-sm"></div>
        </div>

        <span
          className="hidden sm:inline-block sm:align-middle sm:h-screen"
          aria-hidden="true"
        >
          &#8203;
        </span>

        <div className="inline-block align-bottom bg-white dark:bg-gray-800 rounded-3xl text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full w-full">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-600 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="flex-shrink-0 h-12 w-12 bg-white/20 rounded-full flex items-center justify-center border-2 border-white/30">
                  {student.student.profile_image ? (
                    <img
                      src={student.student.profile_image}
                      alt=""
                      className="h-12 w-12 rounded-full object-cover"
                    />
                  ) : (
                    <span className="text-white font-bold text-lg">
                      {student.student.name.charAt(0)}
                    </span>
                  )}
                </div>
                <div className="ml-4 text-white">
                  <h3 className="text-xl font-bold leading-6">
                    {student.student.name}
                  </h3>
                  <p className="text-blue-100 text-sm">
                    {student.student.email}
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="text-white/70 hover:text-white focus:outline-none"
                onClick={onClose}
              >
                <svg
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* Quick Stats in Header */}
            <div className="flex gap-6 mt-4">
              <div>
                <p className="text-blue-100 text-xs uppercase tracking-wider font-semibold">
                  Total Grade
                </p>
                <p className="text-white text-2xl font-bold">
                  {student.summary.total_percentage}%
                </p>
              </div>
              <div>
                <p className="text-blue-100 text-xs uppercase tracking-wider font-semibold">
                  Points
                </p>
                <p className="text-white text-2xl font-bold">
                  {student.summary.total_points_earned}{" "}
                  <span className="text-sm font-normal text-blue-200">
                    / {student.summary.total_max_points}
                  </span>
                </p>
              </div>
              <div>
                <p className="text-blue-100 text-xs uppercase tracking-wider font-semibold">
                  Status
                </p>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold mt-1 ${
                    student.summary.total_percentage >= 60
                      ? "bg-green-100 text-green-800"
                      : "bg-red-100 text-red-800"
                  }`}
                >
                  {student.summary.total_percentage >= 60
                    ? "PASSING"
                    : "FAILING"}
                </span>
              </div>
            </div>
          </div>

          <div className="px-6 py-6 pb-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
            {/* Assignments Section */}
            <h4 className="flex items-center text-gray-900 dark:text-white font-bold text-lg mb-4">
              <span className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 flex items-center justify-center mr-3">
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
                  />
                </svg>
              </span>
              Assignments
              <span className="ml-2 text-sm font-normal text-gray-500 bg-gray-100 dark:bg-gray-700 dark:text-gray-400 px-2 py-0.5 rounded-full">
                {student.summary.assignment_percentage}% Avg
              </span>
            </h4>

            <div className="space-y-3 mb-8">
              {student.assignments.length > 0 ? (
                student.assignments.map((assignment: any) => (
                  <div
                    key={assignment.assignment_id}
                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/30 rounded-xl border border-gray-100 dark:border-gray-700/50 hover:border-blue-200 dark:hover:border-blue-800 transition-colors"
                  >
                    <div className="flex-1 min-w-0 pr-4">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {assignment.title}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          Max Score: {assignment.max_score}
                        </span>
                        {!assignment.submitted && (
                          <span className="text-[10px] text-red-500 bg-red-50 dark:bg-red-900/20 px-1.5 py-0.5 rounded">
                            Missed / Not Submitted
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      {assignment.submitted ? (
                        assignment.grade !== null ? (
                          <span className="text-base font-bold text-gray-900 dark:text-white">
                            {assignment.grade}
                          </span>
                        ) : (
                          <span className="text-xs font-medium text-yellow-600 bg-yellow-50 px-2 py-1 rounded">
                            Pending
                          </span>
                        )
                      ) : (
                        <span className="text-base font-bold text-gray-300 dark:text-gray-600">
                          -
                        </span>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500 italic">
                  No assignments for this course.
                </p>
              )}
            </div>

            {/* Quizzes Section */}
            <h4 className="flex items-center text-gray-900 dark:text-white font-bold text-lg mb-4">
              <span className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 flex items-center justify-center mr-3">
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </span>
              Quizzes
              <span className="ml-2 text-sm font-normal text-gray-500 bg-gray-100 dark:bg-gray-700 dark:text-gray-400 px-2 py-0.5 rounded-full">
                {student.summary.quiz_percentage}% Avg
              </span>
            </h4>

            <div className="space-y-3">
              {student.quizzes.length > 0 ? (
                student.quizzes.map((quiz: any) => (
                  <div
                    key={quiz.quiz_id}
                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/30 rounded-xl border border-gray-100 dark:border-gray-700/50 hover:border-blue-200 dark:hover:border-blue-800 transition-colors"
                  >
                    <div className="flex-1 min-w-0 pr-4">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {quiz.title}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          Max Score: {quiz.max_score}
                        </span>
                        {quiz.submitted && (
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded ${quiz.passed ? "bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400" : "bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400"}`}
                          >
                            {quiz.passed ? "PASSED" : "FAILED"}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      {quiz.submitted ? (
                        quiz.score !== null ? (
                          <div className="flex flex-col items-end">
                            <span className="text-base font-bold text-gray-900 dark:text-white">
                              {quiz.score}
                            </span>
                            <span className="text-[10px] text-gray-500">
                              {quiz.percentage}%
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs font-medium text-yellow-600 bg-yellow-50 px-2 py-1 rounded">
                            Pending
                          </span>
                        )
                      ) : (
                        <span className="text-base font-bold text-gray-300 dark:text-gray-600">
                          -
                        </span>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500 italic">
                  No quizzes for this course.
                </p>
              )}
            </div>
          </div>
          <div className="bg-gray-50 dark:bg-gray-700/30 px-6 py-4 flex justify-end">
            <button
              type="button"
              className="w-full inline-flex justify-center rounded-xl border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none sm:ml-3 sm:w-auto sm:text-sm"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentGradeModal;
