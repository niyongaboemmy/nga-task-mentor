import React from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import type { AxiosProgressEvent } from "axios";
import axios, { isAxiosError } from "../../utils/axiosConfig";
import CreateAssignment from "./CreateAssignmentModal";
import { toast } from "react-toastify";
import { tmcodeAssignmentsApi, type TmcodeSettings } from "../../services/tmcodeAssignmentsApi";
import { apiErrorMessage } from "../../services/projectsApi";

const CreateAssignmentPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const courseId = searchParams.get("courseId");

  const goBack = () => navigate(courseId ? `/courses/${courseId}` : "/assignments");

  const handleSubmit = async (
    formData: FormData,
    onUploadProgress: (e: AxiosProgressEvent) => void,
    tmcode: TmcodeSettings | null,
  ) => {
    const endpoint = courseId ? `/courses/${courseId}/assignments` : "/assignments";
    let createdId: number | null = null;
    try {
      // No 30 s cap: a few large attachments on a school connection take longer.
      const res = await axios.post(endpoint, formData, { timeout: 0, onUploadProgress });
      createdId = Number(res.data?.data?.id) || null;
    } catch (error) {
      console.error("Error creating assignment:", error);
      toast.error((isAxiosError(error) && error.response?.data?.message) || "Failed to create assignment");
      throw error; // keep the form as the teacher left it
    }
    // The TMCode practical settings go on the new assignment.
    if (tmcode?.kind && createdId) {
      try {
        await tmcodeAssignmentsApi.setTmcode(createdId, tmcode);
      } catch (error) {
        toast.error(`Assignment created, but its TMCode settings weren't saved: ${apiErrorMessage(error, "try again")}.`);
        navigate(`/assignments/${createdId}/edit`);
        return;
      }
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
