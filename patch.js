const fs = require('fs');

const path = '/Users/m2pro/dev/projects/nga-task-mentor/client/src/pages/QuizResultsPage.tsx';
let content = fs.readFileSync(path, 'utf8');

// Insert imports
content = content.replace(
  'import {',
  'import { QuestionRenderer } from "../components/Quizzes/QuestionRenderer";\nimport RichTextDisplay from "../components/Common/RichTextDisplay";\nimport {'
);

// Define UI snippet to insert
const uiSnippet = `          </div>

          {/* Question Review Section */}
          <div className="bg-white dark:bg-gray-900/50 rounded-3xl p-8 mt-8 border border-purple-200 dark:border-purple-800/30 animate-in slide-in-from-bottom duration-500 delay-1200">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                <span className="text-white text-lg">📝</span>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Question Review
                </h2>
                <p className="text-gray-600 dark:text-gray-400">
                  Review your answers and learn from the experience
                </p>
              </div>
            </div>

            <div className="space-y-6">
              {result.answers.map((attempt: any, index: number) => {
                const questionData = quiz.questions?.find((q: any) => q.id === attempt.question_id);
                if (!questionData) return null;

                return (
                  <div
                    key={attempt.question_id}
                    className={\`border-2 rounded-2xl p-6 transition-all duration-300 hover:shadow-lg \${
                      attempt.is_correct
                        ? "border-emerald-200 dark:border-emerald-800 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/10 dark:to-teal-900/10"
                        : "border-red-200 dark:border-red-800 bg-gradient-to-r from-red-50 to-pink-50 dark:from-red-900/10 dark:to-pink-900/10"
                    }\`}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                          <div
                            className={\`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold \${
                              attempt.is_correct
                                ? "bg-emerald-500 text-white"
                                : "bg-red-500 text-white"
                            }\`}
                          >
                            {index + 1}
                          </div>
                          <span
                            className={\`px-3 py-1 text-sm font-medium rounded-full \${
                              attempt.is_correct
                                ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700"
                                : "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-700"
                            }\`}
                          >
                            {attempt.is_correct ? "✅ Correct" : "❌ Incorrect"}
                          </span>
                          <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
                            <span className="font-medium">
                              {attempt.points_earned || 0}
                            </span>
                            <span>/</span>
                            <span>{attempt.max_points || 0} pts</span>
                          </div>
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 leading-relaxed">
                          <RichTextDisplay content={questionData.question_text || ""} />
                        </h3>
                      </div>
                    </div>

                    {/* Show user's answer */}
                    <div className="mt-4 p-4 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-200 dark:border-gray-700 rounded-xl">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-gray-600 dark:text-gray-400">📝</span>
                        <span className="text-gray-800 dark:text-gray-200 font-semibold">
                          Your Answer
                        </span>
                      </div>
                      <div className="text-gray-700 dark:text-gray-300">
                        <QuestionRenderer
                          question={questionData as any}
                          answer={attempt.user_answer}
                          onAnswerChange={() => {}}
                          disabled={true}
                          showCorrectAnswer={false}
                        />
                      </div>
                    </div>

                    {/* Show explanation if available */}
                    {attempt.explanation && attempt.explanation !== "No explanation provided." && (
                      <div className="mt-4 p-4 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-emerald-200 dark:border-emerald-800 rounded-xl">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-emerald-500">💡</span>
                          <span className="text-emerald-800 dark:text-emerald-300 font-semibold">
                            Explanation
                          </span>
                        </div>
                        <p className="text-emerald-700 dark:text-emerald-400 leading-relaxed">
                          <RichTextDisplay content={attempt.explanation} />
                        </p>
                      </div>
                    )}

                    {/* Show correct answer if available and permitted */}
                    {result.grading_settings?.show_correct_answers && attempt.correct_answer !== undefined && (
                      <div className="mt-4 p-4 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-blue-200 dark:border-blue-800 rounded-xl">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-blue-500">🎯</span>
                          <span className="text-blue-800 dark:text-blue-300 font-semibold">
                            Correct Answer
                          </span>
                        </div>
                        <div className="text-blue-700 dark:text-blue-400">
                          <QuestionRenderer
                            question={questionData as any}
                            answer={attempt.correct_answer}
                            onAnswerChange={() => {}}
                            disabled={true}
                            showCorrectAnswer={true}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
`;

// Insert UI right before closing tags of the main layout
content = content.replace(
  '          </div>\n        </div>\n\n      </div>\n    </div>',
  uiSnippet + '\n\n      </div>\n    </div>'
);

fs.writeFileSync(path, content, 'utf8');
console.log('Patched correctly!');
