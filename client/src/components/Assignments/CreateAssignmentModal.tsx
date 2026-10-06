import React, { useEffect, useState } from "react";
import type { AxiosProgressEvent } from "axios";
import axios from "../../utils/axiosConfig";
import AssignmentEditorForm from "./form/AssignmentEditorForm";

interface CreateAssignmentProps {
  /** Sends the prepared multipart body; reject to keep the form filled in. */
  onSubmit: (data: FormData, onUploadProgress: (e: AxiosProgressEvent) => void) => Promise<void>;
  onCancel?: () => void;
  initialCourseId?: string;
}

const CreateAssignment: React.FC<CreateAssignmentProps> = ({ onSubmit, onCancel, initialCourseId }) => {
  const [courses, setCourses] = useState<{ id: string; title: string; code: string }[]>([]);

  useEffect(() => {
    axios
      .get("/courses")
      .then((response) => setCourses(response.data.data || response.data))
      .catch((error) => {
        console.error("Error fetching courses:", error);
        setCourses([]);
      });
  }, []);

  return (
    <AssignmentEditorForm
      mode="create"
      courses={courses}
      initial={{
        title: "",
        description: "",
        due_date: "",
        max_score: 100,
        submission_type: "both",
        course_id: initialCourseId || "",
        rubric: [],
        allowed_file_types: ["pdf", "docx", "jpg", "png", "zip"],
        status: "draft",
      }}
      submit={onSubmit}
      onCancel={onCancel}
    />
  );
};

export default CreateAssignment;
