import React, { useMemo } from "react";
import { 
  Binary, 
  FileText, 
  Variable, 
  CheckCircle, 
  Table, 
  Plus, 
  Trash2, 
  AlertCircle,
  HelpCircle,
  Settings
} from "lucide-react";
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

  // Validation - moved to useMemo for stability
  const errors = useMemo(() => {
    const errs: string[] = [];
    if (!safeData.expression_format.trim()) errs.push("Expression format is required");
    if (!safeData.correct_expression.trim()) errs.push("Correct expression is required");
    if (safeData.variables.length === 0) errs.push("At least one variable is required");
    return errs;
  }, [safeData]);

  const updateData = (newData: LogicalExpressionData) => {
    // Determine validity for correct_answer inclusion
    const hasFormat = !!newData.expression_format.trim();
    const hasExpression = !!newData.correct_expression.trim();
    const hasVariables = newData.variables.length > 0 && newData.variables.every(v => !!v.name.trim());
    
    const isValid = hasFormat && hasExpression && hasVariables;

    onChange({
      ...newData,
      correct_answer: isValid ? newData.correct_expression : undefined
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6 pb-6 border-b border-gray-100 dark:border-gray-700">
        <div className="p-3 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg">
          <Binary className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
             Logical Expression Setup
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Define logical propositions, variables, and truth tables.
          </p>
        </div>
      </div>

      {/* Expression Format */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <FileText className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          <h4 className="font-semibold text-gray-900 dark:text-white">
            Expression Format
          </h4>
        </div>
        <textarea
          value={safeData.expression_format}
          onChange={(e) =>
            updateData({
              ...safeData,
              expression_format: e.target.value,
            })
          }
          placeholder="Describe the format (e.g., 'Use ^ for AND, v for OR, ~ for NOT')..."
          rows={3}
          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900/50 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm resize-none"
        />
        <p className="mt-2 text-xs text-gray-500 flex items-center gap-1">
          <HelpCircle className="w-3 h-3" />
          <span>Instructions shown to the student above the input field.</span>
        </p>
      </div>

      {/* Variables Section */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Variable className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
            <h4 className="font-semibold text-gray-900 dark:text-white">
              Variables
            </h4>
          </div>
          <span className="text-xs font-medium px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-gray-600 dark:text-gray-300">
             {safeData.variables.length} Variables
          </span>
        </div>

        <div className="space-y-4">
          {safeData.variables?.map((variable, index) => (
            <div
              key={index}
              className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800/50 hover:border-indigo-300 dark:hover:border-indigo-700 transition-all group"
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                    Name
                  </label>
                  <input
                    type="text"
                    value={variable.name || ""}
                    onChange={(e) => {
                      const newVariables = [...safeData.variables];
                      newVariables[index] = { ...variable, name: e.target.value };
                      updateData({
                        ...safeData,
                        variables: newVariables,
                      });
                    }}
                    placeholder="P, Q, R"
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 focus:ring-1 focus:ring-indigo-500 outline-none"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                    Description
                  </label>
                  <input
                    type="text"
                    value={variable.description || ""}
                    onChange={(e) => {
                      const newVariables = [...safeData.variables];
                      newVariables[index] = {
                        ...variable,
                        description: e.target.value,
                      };
                      updateData({
                        ...safeData,
                        variables: newVariables,
                      });
                    }}
                    placeholder="e.g., 'It is raining'"
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 focus:ring-1 focus:ring-indigo-500 outline-none"
                  />
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">Type:</span>
                  <select
                    value={variable.type || "boolean"}
                    onChange={(e) => {
                      const newVariables = [...safeData.variables];
                      newVariables[index] = {
                        ...variable,
                        type: e.target.value as "boolean" | "number" | "string",
                      };
                      updateData({
                        ...safeData,
                        variables: newVariables,
                      });
                    }}
                    className="text-xs border-none bg-transparent font-medium text-indigo-600 dark:text-indigo-400 focus:ring-0 cursor-pointer"
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
                      updateData({
                        ...safeData,
                        variables: newVariables,
                      });
                    }}
                    className="text-gray-400 hover:text-red-500 text-xs font-medium flex items-center gap-1 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Remove
                  </button>
                )}
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={() => {
              const newVariables = [
                ...safeData.variables,
                { name: "", description: "", type: "boolean" as const },
              ];
              updateData({
                ...safeData,
                variables: newVariables,
              });
            }}
            className="w-full py-3 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-500 hover:border-indigo-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all flex items-center justify-center gap-2 group"
          >
             <div className="p-1 rounded-full bg-gray-100 dark:bg-gray-700 group-hover:bg-indigo-100 dark:group-hover:bg-indigo-900/50 transition-colors">
                 <Plus className="w-4 h-4" />
              </div>
            <span className="font-medium text-sm">Add Variable</span>
          </button>
        </div>
      </div>

      {/* Correct Expression */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <CheckCircle className="w-5 h-5 text-green-500 dark:text-green-400" />
          <h4 className="font-semibold text-gray-900 dark:text-white">
            Correct Expression
          </h4>
        </div>
        <input
          type="text"
          value={safeData.correct_expression}
          onChange={(e) =>
            updateData({
              ...safeData,
              correct_expression: e.target.value,
            })
          }
          placeholder="Enter the correct logical expression (e.g., P ∧ Q)"
          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900/50 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all text-sm"
        />
        <p className="mt-2 text-xs text-gray-500 flex items-center gap-1">
          <Settings className="w-3 h-3" />
          <span>This expression will be used for auto-grading.</span>
        </p>
      </div>

      {/* Truth Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Table className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            <h4 className="font-semibold text-gray-900 dark:text-white">
              Truth Table (Optional)
            </h4>
          </div>
          <span className="text-xs font-medium px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-gray-600 dark:text-gray-300">
             {safeData.truth_table.length} Rows
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700/50 dark:text-gray-400">
              <tr>
                <th scope="col" className="px-4 py-3 rounded-l-lg">Inputs (JSON)</th>
                <th scope="col" className="px-4 py-3">Output</th>
                <th scope="col" className="px-4 py-3 rounded-r-lg w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {safeData.truth_table?.map((row, index) => (
                <tr key={index} className="bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                  <td className="px-4 py-3">
                    <input
                      type="text"
                      value={JSON.stringify(row.inputs)}
                      onChange={(e) => {
                        try {
                          const inputs = JSON.parse(e.target.value);
                          const newTruthTable = [...safeData.truth_table];
                          newTruthTable[index] = { ...row, inputs };
                          updateData({
                            ...safeData,
                            truth_table: newTruthTable,
                          });
                        } catch {
                          // Invalid JSON, allow typing but don't update state yet or handle gracefully? 
                          // Actually for raw input we might need local state or just let it fail silently until valid.
                          // Ideally we'd have a better editor. For now keeping existing logic but styled.
                        }
                      }}
                      placeholder='{"P": true, "Q": false}'
                      className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded bg-gray-50 dark:bg-gray-900/50 text-gray-900 dark:text-white font-mono text-xs focus:ring-1 focus:ring-indigo-500 outline-none"
                    />
                  </td>
                  <td className="px-4 py-3">
                     <label className="inline-flex items-center cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={row.output || false} 
                          onChange={(e) => {
                            const newTruthTable = [...safeData.truth_table];
                            newTruthTable[index] = { ...row, output: e.target.checked };
                            updateData({ ...safeData, truth_table: newTruthTable });
                          }}
                          className="sr-only peer"
                        />
                        <div className="relative w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-indigo-600"></div>
                        <span className="ms-3 text-xs font-medium text-gray-900 dark:text-gray-300">{row.output ? 'True' : 'False'}</span>
                      </label>
                  </td>
                  <td className="px-4 py-3 text-right">
                     {safeData.truth_table.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            const newTruthTable = safeData.truth_table.filter((_, i) => i !== index);
                            updateData({ ...safeData, truth_table: newTruthTable });
                          }}
                          className="text-gray-400 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                     )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        <div className="mt-4">
          <button
            type="button"
            onClick={() => {
              // Pre-fill with variables if possible
              const inputs: Record<string, boolean> = {};
              safeData.variables.forEach(v => inputs[v.name] = false);
              
              const newTruthTable = [
                ...safeData.truth_table,
                { inputs, output: false },
              ];
              updateData({
                ...safeData,
                truth_table: newTruthTable,
              });
            }}
            className="w-full py-3 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-500 hover:border-indigo-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all flex items-center justify-center gap-2 group"
          >
             <div className="p-1 rounded-full bg-gray-100 dark:bg-gray-700 group-hover:bg-indigo-100 dark:group-hover:bg-indigo-900/50 transition-colors">
                 <Plus className="w-4 h-4" />
              </div>
            <span className="font-medium text-sm">Add Row</span>
          </button>
        </div>
      </div>

      {errors.length > 0 && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-start gap-3">
           <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5" />
           <div>
             <h4 className="text-sm font-semibold text-red-900 dark:text-red-200 mb-1">
               Validation Errors
             </h4>
             <ul className="text-sm text-red-700 dark:text-red-300 space-y-1 list-disc list-inside">
               {errors.map((err, i) => (
                 <li key={i}>{err}</li>
               ))}
             </ul>
           </div>
        </div>
      )}
    </div>
  );
};
