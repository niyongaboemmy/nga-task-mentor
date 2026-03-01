import React, { useState, useEffect } from "react";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
} from "chart.js";
import { Doughnut, Bar } from "react-chartjs-2";
import { QuestionBankApiService } from "../../services/quizApi";
import type { QuestionBankEntry } from "../../types/quiz.types";
import { Loader2, LayoutDashboard, Target, Activity } from "lucide-react";

ChartJS.register(
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
);

interface QuestionBankDashboardProps {
  courseId: number;
}

const QuestionBankDashboard: React.FC<QuestionBankDashboardProps> = ({
  courseId,
}) => {
  const [questions, setQuestions] = useState<QuestionBankEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch up to 1000 questions to generate analytics
    QuestionBankApiService.getCourseQuestions(courseId, { limit: 1000 })
      .then((res) => {
        setQuestions(res.data);
      })
      .catch((err) =>
        console.error("Failed to load questions for dashboard", err),
      )
      .finally(() => setLoading(false));
  }, [courseId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-24">
        <Loader2 className="w-10 h-10 text-blue-500 animate-spin mb-4" />
        <p className="text-gray-500">Compiling question bank analytics...</p>
      </div>
    );
  }

  // --- Calculations ---
  const typeCounts: Record<string, number> = {};
  const difficultyCounts = { EASY: 0, MEDIUM: 0, DIFFICULT: 0, UNASSIGNED: 0 };
  const bloomsCounts: Record<string, number> = {};

  questions.forEach((q) => {
    // Types
    const t = q.question_type.replace(/_/g, " ");
    typeCounts[t] = (typeCounts[t] || 0) + 1;

    // Difficulty
    if (q.difficulty_level === "EASY") difficultyCounts.EASY++;
    else if (q.difficulty_level === "MEDIUM") difficultyCounts.MEDIUM++;
    else if (q.difficulty_level === "DIFFICULT") difficultyCounts.DIFFICULT++;
    else difficultyCounts.UNASSIGNED++;

    // Bloom's taxonomy
    if (q.bloomsLevel) {
      const bName = `L${q.bloomsLevel.level_order}: ${q.bloomsLevel.name}`;
      bloomsCounts[bName] = (bloomsCounts[bName] || 0) + 1;
    } else {
      bloomsCounts["Unclassified"] = (bloomsCounts["Unclassified"] || 0) + 1;
    }
  });

  // --- Chart Data ---
  const typeChartData = {
    labels: Object.keys(typeCounts),
    datasets: [
      {
        data: Object.values(typeCounts),
        backgroundColor: [
          "#3b82f6",
          "#8b5cf6",
          "#10b981",
          "#f59e0b",
          "#ef4444",
          "#06b6d4",
          "#f43f5e",
          "#84cc16",
          "#eab308",
          "#6366f1",
        ],
        borderWidth: 0,
      },
    ],
  };

  const difficultyChartData = {
    labels: ["Easy", "Medium", "Difficult", "Unassigned"],
    datasets: [
      {
        label: "Questions",
        data: [
          difficultyCounts.EASY,
          difficultyCounts.MEDIUM,
          difficultyCounts.DIFFICULT,
          difficultyCounts.UNASSIGNED,
        ],
        backgroundColor: ["#22c55e", "#f59e0b", "#ef4444", "#94a3b8"],
        borderRadius: 6,
      },
    ],
  };

  const bloomsChartData = {
    labels: Object.keys(bloomsCounts),
    datasets: [
      {
        label: "Questions",
        data: Object.values(bloomsCounts),
        backgroundColor: "#8b5cf6",
        borderRadius: 6,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: "bottom" as const, labels: { color: "#64748b" } },
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: { color: "#e2e8f0", drawBorder: false },
        ticks: { stepSize: 1, precision: 0 },
      },
      x: { grid: { display: false } },
    },
  };

  const pieOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: "right" as const, labels: { color: "#64748b" } },
    },
    cutout: "70%",
  };

  return (
    <div className="space-y-6">
      {/* Top Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white/90 dark:bg-gray-900/80 backdrop-blur-xl rounded-[1.4rem] border border-gray-200/80 dark:border-gray-800/60 p-5 flex items-center">
          <div className="w-12 h-12 rounded-2xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 mr-4">
            <LayoutDashboard className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Total Questions
            </p>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
              {questions.length}
            </h3>
          </div>
        </div>

        <div className="bg-white/90 dark:bg-gray-900/80 backdrop-blur-xl rounded-[1.4rem] border border-gray-200/80 dark:border-gray-800/60 p-5 flex items-center">
          <div className="w-12 h-12 rounded-2xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600 dark:text-green-400 mr-4">
            <Target className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Classified by Bloom's
            </p>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
              {questions.length - (bloomsCounts["Unclassified"] || 0)}
            </h3>
          </div>
        </div>

        <div className="bg-white/90 dark:bg-gray-900/80 backdrop-blur-xl rounded-[1.4rem] border border-gray-200/80 dark:border-gray-800/60 p-5 flex items-center">
          <div className="w-12 h-12 rounded-2xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 dark:text-purple-400 mr-4">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Unique Types Used
            </p>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
              {Object.keys(typeCounts).length}
            </h3>
          </div>
        </div>
      </div>

      {/* Charts */}
      {questions.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white/90 dark:bg-gray-900/80 backdrop-blur-xl rounded-[1.6rem] border border-gray-200/80 dark:border-gray-800/60 p-6 flex flex-col">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
              Distribution by Type
            </h3>
            <div className="flex-1 min-h-[250px] relative">
              <Doughnut data={typeChartData} options={pieOptions} />
            </div>
          </div>

          <div className="bg-white/90 dark:bg-gray-900/80 backdrop-blur-xl rounded-[1.6rem] border border-gray-200/80 dark:border-gray-800/60 p-6 flex flex-col">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
              Difficulty Level Spread
            </h3>
            <div className="flex-1 min-h-[250px] relative">
              <Bar data={difficultyChartData} options={chartOptions as any} />
            </div>
          </div>

          <div className="bg-white/90 dark:bg-gray-900/80 backdrop-blur-xl rounded-[1.6rem] border border-gray-200/80 dark:border-gray-800/60 p-6 flex flex-col lg:col-span-2">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
              Bloom's Taxonomy Classification
            </h3>
            <div className="flex-1 min-h-[300px] relative">
              <Bar data={bloomsChartData} options={chartOptions as any} />
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center p-12 text-center bg-white/90 dark:bg-gray-900/80 backdrop-blur-xl rounded-[1.6rem] border border-gray-200/80 dark:border-gray-800/60 border-dashed">
          <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
            <Activity className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">
            No data to display
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
            Add some questions to the bank to start seeing analytics and
            distribution charts here.
          </p>
        </div>
      )}
    </div>
  );
};

export default QuestionBankDashboard;
