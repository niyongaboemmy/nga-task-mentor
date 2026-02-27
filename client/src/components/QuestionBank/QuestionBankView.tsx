import React, { useState } from "react";
import QuestionBankList from "./QuestionBankList";
import QuestionBankDashboard from "./QuestionBankDashboard";

interface QuestionBankViewProps {
  courseId: number;
}

const QuestionBankView: React.FC<QuestionBankViewProps> = ({ courseId }) => {
  const [activeTab, setActiveTab] = useState<"list" | "dashboard">("list");

  return (
    <div className="space-y-4">
      <div className="flex border-b border-gray-200 dark:border-gray-800/50">
        <button
          onClick={() => setActiveTab("list")}
          className={`px-4 py-3 font-medium text-sm transition-colors ${
            activeTab === "list"
              ? "border-b-2 border-blue-600 text-blue-600 dark:text-blue-500 dark:border-blue-500"
              : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
          }`}
        >
          Questions List
        </button>
        <button
          onClick={() => setActiveTab("dashboard")}
          className={`px-4 py-3 font-medium text-sm transition-colors ${
            activeTab === "dashboard"
              ? "border-b-2 border-blue-600 text-blue-600 dark:text-blue-500 dark:border-blue-500"
              : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
          }`}
        >
          Dashboard Analytics
        </button>
      </div>

      <div className="pt-2">
        {activeTab === "list" ? (
          <QuestionBankList courseId={courseId} />
        ) : (
          <QuestionBankDashboard courseId={courseId} />
        )}
      </div>
    </div>
  );
};

export default QuestionBankView;
