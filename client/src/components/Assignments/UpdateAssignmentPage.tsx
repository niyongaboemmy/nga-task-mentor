import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import UpdateAssignmentModal from "../Courses/UpdateAssignmentModal";

interface Assignment {
  id: number;
  title: string;
  description: string;
  due_date: string;
  max_score: number;
  submission_type: string;
  status: string;
}

const UpdateAssignmentPage: React.FC = () => {
  const navigate = useNavigate();
  const { assignmentId } = useParams<{ assignmentId: string }>();
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchAssignment = async () => {
      try {
        const response = await axios.get(`/api/assignments/${assignmentId}`);
        setAssignment(response.data.data);
      } catch (error: any) {
        console.error("Error fetching assignment:", error);
        setError(error.response?.data?.message || "Failed to load assignment");
      } finally {
        setIsLoading(false);
      }
    };

    if (assignmentId) {
      fetchAssignment();
    }
  }, [assignmentId]);

  const handleSubmit = async (assignmentData: any) => {
    try {
      await axios.put(`/api/assignments/${assignmentId}`, assignmentData);

      // Navigate back to assignment details
      navigate(`/assignments/${assignmentId}`);
    } catch (error: any) {
      console.error("Error updating assignment:", error);
      setError(error.response?.data?.message || "Failed to update assignment");
    }
  };

  const handleCancel = () => {
    navigate(`/assignments/${assignmentId}`);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !assignment) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Error
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            {error || "Assignment not found"}
          </p>
          <button
            onClick={handleCancel}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 py-8">
      <div className="max-w-5xl mx-auto">
        <UpdateAssignmentModal
          assignment={assignment}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
        />
      </div>
    </div>
  );
};

export default UpdateAssignmentPage;
