import React, { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import QuestionBankModal from "../../components/QuestionBank/QuestionBankModal";
import PageHeader from "../../components/ui/PageHeader";
import { QuestionBankApiService } from "../../services/quizApi";
import type { QuestionBankEntry } from "../../types/quiz.types";

/**
 * Creating or editing a Question Bank question on its own page
 * (CODE_RUNNER_PLAN.md §7.3) instead of a pop-up: the same form, with room
 * for the coding question's editor and tests. `?back=` is where to return.
 */
const QuestionEditPage: React.FC = () => {
  const { courseId: courseParam, questionId } = useParams();
  const courseId = Number(courseParam);
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const back = (() => {
    const b = search.get("back");
    // Only paths inside this app.
    return b && b.startsWith("/") && !b.startsWith("//") ? b : `/courses/${courseId}/question-bank`;
  })();
  const editing = !!questionId;
  const [question, setQuestion] = useState<QuestionBankEntry | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!editing) return;
    let live = true;
    QuestionBankApiService.getCourseQuestion(courseId, Number(questionId))
      .then((r) => live && setQuestion(r.data))
      .catch((e) => live && setError(e?.response?.data?.message ?? "Couldn't load this question."));
    return () => {
      live = false;
    };
  }, [courseId, questionId, editing]);

  const close = () => navigate(back);

  return (
    <div className="space-y-4">
      <PageHeader
        breadcrumb={[{ label: "Question Bank", to: back }, { label: editing ? "Edit question" : "New question" }]}
        title={editing ? "Edit question" : "New question"}
      />
      {error ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200" role="alert">
          {error}
        </p>
      ) : editing && !question ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <QuestionBankModal asPage isOpen onClose={close} onSuccess={() => undefined} courseId={courseId} question={question} />
      )}
    </div>
  );
};

export default QuestionEditPage;
