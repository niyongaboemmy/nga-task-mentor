import React from "react";
import type { LogicalExpressionData } from "../../../types/quiz.types";

interface LogicalExpressionQuestionFormProps {
  data: LogicalExpressionData;
  onChange: (data: any) => void;
}

export const LogicalExpressionQuestionForm: React.FC<
  LogicalExpressionQuestionFormProps
> = ({ data, onChange }) => {
  // Ensure data has default values
  const safeData = {
    expression_format: data.expression_format || "",
    variables: data.variables || [],
    truth_table: data.truth_table || [],
    correct_expression: data.correct_expression || "",
  };

  // Validation
  const isValidExpressionFormat = safeData.expression_format.trim() !== "";
  const isValidCorrectExpression = safeData.correct_expression.trim() !== "";
  const hasVariables = safeData.variables.length > 0;

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          Expression Format *
        </label>
        <textarea
          value={safeData.expression_format}
          onChange={(e) =>
            onChange({
              ...safeData,
              expression_format: e.target.value,
            })
          }
          placeholder="Describe the format of the logical expression (e.g., 'Use ∧, ∨, ¬ operators')"
          rows={3}
          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-2xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition-colors duration-200"
        />
        {!isValidExpressionFormat && (
          <p className="mt-2 text-sm text-red-600 dark:text-red-400">
            Expression format is required.
          </p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          Variables *
        </label>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
          Define at least one variable for the logical expression
        </p>
        <div className="space-y-3">
          {safeData.variables?.map((variable, index) => (
            <div
              key={index}
              className="flex gap-3 items-start p-4 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-600 rounded-2xl"
            >
              <div className="flex-1">
                <input
                  type="text"
                  value={variable.name || ""}
                  onChange={(e) => {
                    const newVariables = [...safeData.variables];
                    newVariables[index] = { ...variable, name: e.target.value };
                    onChange({
                      ...safeData,
                      variables: newVariables,
                    });
                  }}
                  placeholder="Variable name (e.g., P, Q, R)"
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition-colors duration-200"
                />
              </div>
              <div className="flex-1">
                <input
                  type="text"
                  value={variable.description || ""}
                  onChange={(e) => {
                    const newVariables = [...safeData.variables];
                    newVariables[index] = {
                      ...variable,
                      description: e.target.value,
                    };
                    onChange({
                      ...safeData,
                      variables: newVariables,
                    });
                  }}
                  placeholder="Description"
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition-colors duration-200"
                />
              </div>
              <div className="flex-1">
                <select
                  value={variable.type || "boolean"}
                  onChange={(e) => {
                    const newVariables = [...safeData.variables];
                    newVariables[index] = {
                      ...variable,
                      type: e.target.value as "boolean" | "number" | "string",
                    };
                    onChange({
                      ...safeData,
                      variables: newVariables,
                    });
                  }}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition-colors duration-200"
                >
                  <option value="boolean">Boolean</option>
                  <option value="number">Number</option>
                  <option value="string">String</option>
                </select>
              </div>
              {safeData.variables.length > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    const newVariables = safeData.variables.filter(
                      (_, i) => i !== index
                    );
                    onChange({
                      ...safeData,
                      variables: newVariables,
                    });
                  }}
                  className="w-8 h-8 rounded-full bg-red-100 hover:bg-red-200 dark:bg-red-900 dark:hover:bg-red-800 text-red-600 dark:text-red-400 flex items-center justify-center text-sm font-medium transition-colors duration-200"
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
                ...safeData.variables,
                { name: "", description: "", type: "boolean" as const },
              ];
              onChange({
                ...safeData,
                variables: newVariables,
              });
            }}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white text-sm font-medium rounded-full transition-colors duration-200"
          >
+ Add Variable
          </button>
        </div>
        {!hasVariables && (
          <p className="mt-2 text-sm text-red-600 dark:text-red-400">
            At least one variable is required.
          </p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          Correct Expression *
        </label>
        <input
          type="text"
          value={safeData.correct_expression}
          onChange={(e) =>
            onChange({
              ...safeData,
              correct_expression: e.target.value,
            })
          }
          placeholder="Enter the correct logical expression (e.g., P ∧ Q)"
          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-2xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition-colors duration-200"
        />
        {!isValidCorrectExpression && (
          <p className="mt-2 text-sm text-red-600 dark:text-red-400">
            Correct expression is required.
          </p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          Truth Table (Optional)
        </label>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
          Define truth table rows for validation
        </p>
        <div className="space-y-3">
          {safeData.truth_table?.map((row, index) => (
            <div
              key={index}
              className="flex gap-3 items-center p-4 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-600 rounded-2xl"
            >
              <div className="flex-1">
                <input
                  type="text"
                  value={JSON.stringify(row.inputs) || ""}
                  onChange={(e) => {
                    try {
                      const inputs = JSON.parse(e.target.value);
                      const newTruthTable = [...safeData.truth_table];
                      newTruthTable[index] = { ...row, inputs };
                      onChange({
                        ...safeData,
                        truth_table: newTruthTable,
                      });
                    } catch {
                      // Invalid JSON, ignore
                    }
                  }}
                  placeholder='{"P": true, "Q": false}'
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition-colors duration-200"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Output:
                </label>
                <input
                  type="checkbox"
                  checked={row.output || false}
                  onChange={(e) => {
                    const newTruthTable = [...safeData.truth_table];
                    newTruthTable[index] = { ...row, output: e.target.checked };
                    onChange({
                      ...safeData,
                      truth_table: newTruthTable,
                    });
                  }}
                  className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                />
              </div>
              {safeData.truth_table.length > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    const newTruthTable = safeData.truth_table.filter(
                      (_, i) => i !== index
                    );
                    onChange({
                      ...safeData,
                      truth_table: newTruthTable,
                    });
                  }}
                  className="w-8 h-8 rounded-full bg-red-100 hover:bg-red-200 dark:bg-red-900 dark:hover:bg-red-800 text-red-600 dark:text-red-400 flex items-center justify-center text-sm font-medium transition-colors duration-200"
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
                ...safeData.truth_table,
                { inputs: {}, output: false },
              ];
              onChange({
                ...safeData,
                truth_table: newTruthTable,
              });
            }}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white text-sm font-medium rounded-full transition-colors duration-200"
          >
            + Add Truth Table Row
          </button>
        </div>
      </div>
    </div>
  );
};
