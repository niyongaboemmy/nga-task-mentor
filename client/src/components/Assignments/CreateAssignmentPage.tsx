import React from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import type { AxiosProgressEvent } from "axios";
import axios, { isAxiosError } from "../../utils/axiosConfig";
import CreateAssignment from "./CreateAssignmentModal";
import { toast } from "react-toastify";

const CreateAssignmentPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const courseId = searchParams.get("courseId");

  const goBack = () => navigate(courseId ? `/courses/${courseId}` : "/assignments");

  const handleSubmit = async (formData: FormData, onUploadProgress: (e: AxiosProgressEvent) => void) => {
    const endpoint = courseId ? `/courses/${courseId}/assignments` : "/assignments";
    try {
      // No 30 s cap: a few large attachments on a school connection take longer.
      await axios.post(endpoint, formData, { timeout: 0, onUploadProgress });
    } catch (error) {
      console.error("Error creating assignment:", error);
      toast.error((isAxiosError(error) && error.response?.data?.message) || "Failed to create assignment");
      throw error; // keep the form as the teacher left it
    }
    toast.success("Assignment created successfully!");
    goBack();
  };

  return (
    <div className="px-2 sm:px-4 py-4">
      <CreateAssignment onSubmit={handleSubmit} onCancel={goBack} initialCourseId={courseId || undefined} />
    </div>
  );
};

export default CreateAssignmentPage;
