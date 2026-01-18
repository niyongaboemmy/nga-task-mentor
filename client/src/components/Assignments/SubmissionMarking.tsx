import React from "react";
import { toast } from "react-toastify";
import type { AssignmentInterface } from "./AssignmentCard";

export interface SubmissionItemInterface {
  id: string;
  assignment_id: string;
  student_id: string;
  status: string;
  submitted_at: string;
  text_submission: string;
  file_submissions: {
    path: string;
    size: number;
    filename: string;
    mimetype: string;
    originalname: string;
  }[];
  grade: string | null;
  feedback: string | null;
  resubmissions: any[];
  is_late: boolean;
  comments: any[];
  createdAt: string;
  updatedAt: string;
  student: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    profile_image?: string;
  };
}

interface SubmissionMarkingProps {
  submission: SubmissionItemInterface;
  assignment: AssignmentInterface;
  onGradeSubmission: (
    submissionId: string,
    score: number,
    feedback: string,
  ) => void;
}

const SubmissionMarking: React.FC<SubmissionMarkingProps> = ({
  submission,
  assignment,
  onGradeSubmission,
}) => {
  // Initialize score from submission.grade (e.g. "85/100" -> "85")
  const initialScore = React.useMemo(() => {
    if (!submission.grade) return "";
    const parts = submission.grade.toString().split("/");
    return parts[0] || "";
  }, [submission.grade]);

  const [score, setScore] = React.useState<string>(initialScore);
  const [feedback, setFeedback] = React.useState<string>(
    submission.feedback || "",
  );
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Update local state if submission changes
  React.useEffect(() => {
    if (submission.grade) {
      const parts = submission.grade.toString().split("/");
      setScore(parts[0] || "");
    }
    setFeedback(submission.feedback || "");
  }, [submission]);

  const handleSubmit = async () => {
    if (!score || isNaN(Number(score))) {
      toast.error("Please enter a valid score.");
      return;
    }
    const numScore = Number(score);
    if (numScore < 0 || numScore > Number(assignment.max_score)) {
      toast.error(`Score must be between 0 and ${assignment.max_score}.`);
      return;
    }
    setIsSubmitting(true);
    try {
      await onGradeSubmission(submission.id, numScore, feedback);
      toast.success(
        submission.grade
          ? "Grade updated successfully!"
          : "Submission graded successfully!",
      );
    } catch (error: any) {
      toast.error("Failed to grade submission.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const isGraded = !!submission.grade;

  return (
    <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-800">
      <h5 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
          />
        </svg>
        {isGraded ? "Update Grade" : "Grade Submission"}
      </h5>
      <div className="flex items-center gap-4">
        <div className="flex-1 max-w-xs">
          <input
            type="number"
            min="0"
            max={assignment.max_score}
            value={score}
            onChange={(e) => setScore(e.target.value)}
            placeholder="Score"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div className="flex-1">
          <input
            type="text"
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="Feedback (optional)"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="px-5 py-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {isSubmitting
            ? "Submitting..."
            : isGraded
              ? "Update Grade"
              : "Submit Grade"}
        </button>
      </div>
    </div>
  );
};

export default SubmissionMarking;
