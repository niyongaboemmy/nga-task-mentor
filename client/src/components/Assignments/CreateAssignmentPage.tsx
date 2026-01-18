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

      // Create FormData object
      const formData = new FormData();
      formData.append("title", assignmentData.title);
      formData.append("description", assignmentData.description);
      formData.append("due_date", assignmentData.due_date);
      formData.append("max_score", assignmentData.max_score.toString());
      formData.append("submission_type", assignmentData.submission_type);
      if (assignmentData.course_id) {
        formData.append("course_id", assignmentData.course_id);
      }

      // Append files
      if (assignmentData.attachments && assignmentData.attachments.length > 0) {
        assignmentData.attachments.forEach((file: File) => {
          formData.append("attachments", file);
        });
      }

      await axios.post(endpoint, formData);

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
