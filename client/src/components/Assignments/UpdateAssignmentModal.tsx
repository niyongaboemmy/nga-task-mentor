import React from "react";
import type { AxiosProgressEvent } from "axios";
import { toast } from "react-toastify";
import api, { isAxiosError } from "../../utils/axiosConfig";
import { formatUTCToLocalDateTime } from "../../utils/dateUtils";
import { type RubricCriterion } from "./AssignmentCard";
import AssignmentEditorForm, { type ExistingAttachment } from "./form/AssignmentEditorForm";
import { parseExtensions } from "../../utils/fileList";
import { usePermissions } from "../../hooks/usePermissions";
import { apiErrorMessage } from "../../services/projectsApi";
import { tmcodeAssignmentsApi, tmcodeFromAssignment, type TmcodeSettings } from "../../services/tmcodeAssignmentsApi";

interface UpdateAssignmentProps {
  assignment: {
    id: number;
    title: string;
    description: string;
    due_date: string;
    max_score: number;
    submission_type: string;
    allowed_file_types?: string[] | string | null;
    rubric?: RubricCriterion[] | string | null;
    status: string;
    attachments?: ExistingAttachment[];
    /** TMCode practical settings from GET /assignments/:id (null = off). */
    tmcode?: TmcodeSettings | null;
  };
  onSubmit: (assignmentData: unknown) => void;
  onCancel?: () => void;
}

function parseRubric(rubric: UpdateAssignmentProps["assignment"]["rubric"]): RubricCriterion[] {
  if (!rubric) return [];
  if (Array.isArray(rubric)) return rubric;
  try {
    const parsed = JSON.parse(rubric);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseTypes(types: UpdateAssignmentProps["assignment"]["allowed_file_types"]): string[] {
  if (!types) return [];
  if (Array.isArray(types)) return parseExtensions(types.join(","));
  try {
    const parsed = JSON.parse(types);
    if (Array.isArray(parsed)) return parseExtensions(parsed.join(","));
  } catch {
    /* plain "pdf, zip" string */
  }
  return parseExtensions(types);
}

const UpdateAssignmentModal: React.FC<UpdateAssignmentProps> = ({ assignment, onSubmit, onCancel }) => {
  const { can } = usePermissions();
  const initialTmcode = React.useMemo(() => tmcodeFromAssignment(assignment.tmcode), [assignment.tmcode]);

  const submit = async (
    data: FormData,
    onUploadProgress: (e: AxiosProgressEvent) => void,
    tmcode: TmcodeSettings | null,
  ) => {
    let saved: unknown;
    try {
      // No 30 s cap: a few large attachments on a school connection take longer.
      const res = await api.put(`/assignments/${assignment.id}`, data, { timeout: 0, onUploadProgress });
      saved = res.data?.data;
    } catch (error) {
      console.error("Error updating assignment:", error);
      toast.error((isAxiosError(error) && error.response?.data?.message) || "Failed to update assignment");
      throw error;
    }
    if (tmcode) {
      try {
        await tmcodeAssignmentsApi.setTmcode(assignment.id, tmcode);
      } catch (error) {
        // The form stays open with this message, so the teacher can retry.
        throw new Error(`The assignment was saved, but its TMCode settings weren't: ${apiErrorMessage(error, "try again")}.`);
      }
    }
    toast.success("Assignment updated successfully!");
    onSubmit(saved);
  };

  return (
    <AssignmentEditorForm
      mode="edit"
      initial={{
        title: assignment.title || "",
        description: assignment.description || "",
        due_date: formatUTCToLocalDateTime(assignment.due_date),
        max_score: Number(assignment.max_score) || 0,
        submission_type: assignment.submission_type || "both",
        allowed_file_types: parseTypes(assignment.allowed_file_types),
        rubric: parseRubric(assignment.rubric),
        course_id: "",
        status: assignment.status || "draft",
      }}
      existingAttachments={assignment.attachments || []}
      initialTmcode={initialTmcode}
      tmcodeEnabled={can("PROJECTS_USE") || !!initialTmcode.kind}
      submit={submit}
      onCancel={onCancel}
    />
  );
};

export default UpdateAssignmentModal;
