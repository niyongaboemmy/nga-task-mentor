import axios from "../utils/axiosConfig";

/** Learning outcomes on quizzes and assignments (server routes/competency.ts). */
export type TaskType = "quiz" | "assignment";
export interface Outcome {
  competency_id: number;
  element_number: number;
  title: string;
  criteria: { criteria_id: number; criteria_number: string; description: string }[];
}
export interface CriterionTag {
  criteria_id: number;
  competency_id: number;
  element_number: number;
  outcome_title: string;
  criteria_number: string;
  description: string;
}
export interface TaskOutcomes {
  subject_id: number | null;
  criteria: CriterionTag[];
  can_edit: boolean;
}

export const competencyApi = {
  task: async (type: TaskType, id: number): Promise<TaskOutcomes> => (await axios.get(`/competency/tasks/${type}/${id}`)).data.data,
  save: async (type: TaskType, id: number, criteriaIds: number[]): Promise<TaskOutcomes> =>
    (await axios.put(`/competency/tasks/${type}/${id}`, { criteria_ids: criteriaIds })).data.data,
  curriculum: async (subjectId: number): Promise<Outcome[]> => (await axios.get(`/competency/curriculum/${subjectId}`)).data.data.outcomes,
};
