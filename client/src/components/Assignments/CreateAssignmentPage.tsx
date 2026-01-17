import React from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import axios from "../../utils/axiosConfig";
import CreateAssignment from "./CreateAssignmentModal";

const CreateAssignmentPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const courseId = searchParams.get("courseId");

  const handleSubmit = async (assignmentData: any) => {
    try {
      const endpoint = courseId
        ? `/api/courses/${courseId}/assignments`
        : "/api/assignments";

      await axios.post(endpoint, assignmentData);

      // Navigate back to assignments list or course details
      if (courseId) {
        navigate(`/courses/${courseId}`);
      } else {
        navigate("/assignments");
      }
    } catch (error) {
      console.error("Error creating assignment:", error);
      // You might want to show an error message here
    }
  };

  const handleCancel = () => {
    // Navigate back to assignments list or course details
    if (courseId) {
      navigate(`/courses/${courseId}`);
    } else {
      navigate("/assignments");
    }
  };

  return (
    <div className="">
      <CreateAssignment
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        initialCourseId={courseId || undefined}
      />
    </div>
  );
};

export default CreateAssignmentPage;
