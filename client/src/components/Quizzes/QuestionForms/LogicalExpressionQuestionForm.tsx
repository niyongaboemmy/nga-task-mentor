import React from "react";
import type { LogicalExpressionData } from "../../../types/quiz.types";

interface LogicalExpressionQuestionFormProps {
  data: LogicalExpressionData;
  onChange: (data: LogicalExpressionData) => void;
}

export const LogicalExpressionQuestionForm: React.FC<
  LogicalExpressionQuestionFormProps
> = ({ data, onChange }) => {
  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-normal text-gray-700 mb-2 dark:text-gray-300">
          Expression Format
        </label>
        <textarea
          value={data.expression_format || ""}
          onChange={(e) =>
            onChange({
              ...data,
              expression_format: e.target.value,
            })
          }
          placeholder="Describe the format of the logical expression (e.g., 'Use ∧, ∨, ¬ operators')"
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 dark:bg-gray-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-normal text-gray-700 mb-2 dark:text-gray-300">
          Variables
        </label>
        <div className="space-y-3">
          {data.variables?.map((variable, index) => (
            <div
              key={index}
              className="flex gap-3 items-start p-3 border border-gray-200 dark:border-gray-700 rounded-lg"
            >
              <div className="flex-1">
                <input
                  type="text"
                  value={variable.name || ""}
                  onChange={(e) => {
                    const newVariables = [...(data.variables || [])];
                    newVariables[index] = { ...variable, name: e.target.value };
                    onChange({
                      ...data,
                      variables: newVariables,
                    });
                  }}
                  placeholder="Variable name (e.g., P, Q, R)"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 dark:bg-gray-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex-1">
                <input
                  type="text"
                  value={variable.description || ""}
                  onChange={(e) => {
                    const newVariables = [...(data.variables || [])];
                    newVariables[index] = {
                      ...variable,
                      description: e.target.value,
                    };
                    onChange({
                      ...data,
                      variables: newVariables,
                    });
                  }}
                  placeholder="Description"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 dark:bg-gray-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex-1">
                <select
                  value={variable.type || "boolean"}
                  onChange={(e) => {
                    const newVariables = [...(data.variables || [])];
                    newVariables[index] = {
                      ...variable,
                      type: e.target.value as "boolean" | "number" | "string",
                    };
                    onChange({
                      ...data,
                      variables: newVariables,
                    });
                  }}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 dark:bg-gray-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="boolean">Boolean</option>
                  <option value="number">Number</option>
                  <option value="string">String</option>
                </select>
              </div>
              {data.variables && data.variables.length > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    const newVariables = data.variables.filter(
                      (_, i) => i !== index
                    );
                    onChange({
                      ...data,
                      variables: newVariables,
                    });
                  }}
                  className="text-red-600 hover:text-red-800 p-2"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={() => {
              const newVariables = [
                ...(data.variables || []),
                { name: "", description: "", type: "boolean" as const },
              ];
              onChange({
                ...data,
                variables: newVariables,
              });
            }}
            className="text-blue-600 hover:text-blue-800 text-sm"
          >
            + Add Variable
          </button>
        </div>
      </div>

      <div>
        <label className="block text-sm font-normal text-gray-700 mb-2 dark:text-gray-300">
          Correct Expression
        </label>
        <input
          type="text"
          value={data.correct_expression || ""}
          onChange={(e) =>
            onChange({
              ...data,
              correct_expression: e.target.value,
            })
          }
          placeholder="Enter the correct logical expression (e.g., P ∧ Q)"
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 dark:bg-gray-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-normal text-gray-700 mb-2 dark:text-gray-300">
          Truth Table (Optional)
        </label>
        <div className="space-y-3">
          {data.truth_table?.map((row, index) => (
            <div
              key={index}
              className="flex gap-3 items-center p-3 border border-gray-200 dark:border-gray-700 rounded-lg"
            >
              <div className="flex-1">
                <input
                  type="text"
                  value={JSON.stringify(row.inputs) || ""}
                  onChange={(e) => {
                    try {
                      const inputs = JSON.parse(e.target.value);
                      const newTruthTable = [...(data.truth_table || [])];
                      newTruthTable[index] = { ...row, inputs };
                      onChange({
                        ...data,
                        truth_table: newTruthTable,
                      });
                    } catch {
                      // Invalid JSON, ignore
                    }
                  }}
                  placeholder='{"P": true, "Q": false}'
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 dark:bg-gray-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm">Output:</label>
                <input
                  type="checkbox"
                  checked={row.output || false}
                  onChange={(e) => {
                    const newTruthTable = [...(data.truth_table || [])];
                    newTruthTable[index] = { ...row, output: e.target.checked };
                    onChange({
                      ...data,
                      truth_table: newTruthTable,
                    });
                  }}
                  className="rounded border-gray-300"
                />
              </div>
              {data.truth_table && data.truth_table.length > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    const newTruthTable = (data.truth_table || []).filter(
                      (_, i) => i !== index
                    );
                    onChange({
                      ...data,
                      truth_table: newTruthTable,
                    });
                  }}
                  className="text-red-600 hover:text-red-800 p-2"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={() => {
              const newTruthTable = [
                ...(data.truth_table || []),
                { inputs: {}, output: false },
              ];
              onChange({
                ...data,
                truth_table: newTruthTable,
              });
            }}
            className="text-blue-600 hover:text-blue-800 text-sm"
          >
            + Add Truth Table Row
          </button>
        </div>
      </div>
    </div>
  );
};
