import React from "react";

interface AssignmentFormData {
  title: string;
  description: string;
  due_date: string;
  max_score: string;
  submission_type: string;
  allowed_file_types: string;
  rubric: string;
  status: string;
}

interface AssignmentFormProps {
  isOpen: boolean;
  onClose: () => void;
  editFormData: AssignmentFormData;
  onInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  onSubmit: (e: React.FormEvent) => void;
}

const AssignmentForm: React.FC<AssignmentFormProps> = ({
  isOpen,
  onClose,
  editFormData,
  onInputChange,
  onSubmit,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Edit Assignment
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="title"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Title
            </label>
            <input
              type="text"
              id="title"
              name="title"
              value={editFormData.title}
              onChange={onInputChange}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              required
            />
          </div>

          <div>
            <label
              htmlFor="description"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Description
            </label>
            <textarea
              id="description"
              name="description"
              value={editFormData.description}
              onChange={onInputChange}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="due_date"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Due Date
              </label>
              <input
                type="datetime-local"
                id="due_date"
                name="due_date"
                value={editFormData.due_date}
                onChange={onInputChange}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                required
              />
            </div>

            <div>
              <label
                htmlFor="max_score"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Max Score
              </label>
              <input
                type="number"
                id="max_score"
                name="max_score"
                value={editFormData.max_score}
                onChange={onInputChange}
                min="0"
                step="0.01"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                required
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="submission_type"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Submission Type
            </label>
            <select
              id="submission_type"
              name="submission_type"
              value={editFormData.submission_type}
              onChange={onInputChange}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
            >
              <option value="text">Text Only</option>
              <option value="file">File Upload Only</option>
              <option value="both">Both Text and File</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="allowed_file_types"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Allowed File Types (comma-separated)
            </label>
            <input
              type="text"
              id="allowed_file_types"
              name="allowed_file_types"
              value={editFormData.allowed_file_types}
              onChange={onInputChange}
              placeholder="pdf,docx,txt"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
            />
          </div>

          <div>
            <label
              htmlFor="rubric"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Rubric (JSON format)
            </label>
            <textarea
              id="rubric"
              name="rubric"
              value={editFormData.rubric}
              onChange={onInputChange}
              rows={3}
              placeholder="Enter rubric in JSON format"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white font-mono text-sm"
            />
          </div>

          <div>
            <label
              htmlFor="status"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Status
            </label>
            <select
              id="status"
              name="status"
              value={editFormData.status}
              onChange={onInputChange}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
            >
              <option value="draft">Draft</option>
              <option value="published">Published</option>
            </select>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AssignmentForm;
