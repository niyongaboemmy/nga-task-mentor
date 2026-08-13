import React, { useState, useEffect } from "react";
import type {
  QuestionComponentProps,
  LogicalExpressionData,
  LogicalExpressionAnswer,
  AnswerDataType,
} from "../../../types/quiz.types";
import {
  Check,
  X,
  Plus,
  Trash2,
  AlertCircle,
  Brain,
  Tag,
  RefreshCw,
  CheckCircle,
} from "lucide-react";
import RichTextDisplay from "../../Common/RichTextDisplay";

// Extended answer type for component state management
interface LogicalExpressionAnswerWithState extends LogicalExpressionAnswer {
  variables?: Array<{ name: string; value: boolean }>; // Matches LogicalExpressionAnswer format for external communication
  expressionNodes?: ExpressionNode[];
  result?: boolean;
  error?: string;
  submitted?: boolean;
}

interface ExpressionNode {
  type: "variable" | "operator" | "not";
  value: string;
  id: string;
}

interface Variable {
  name: string;
  description: string;
  type: "boolean" | "number" | "string";
  value: boolean;
}

export const LogicalExpressionQuestion: React.FC<QuestionComponentProps> = ({
  question,
  answer,
  onAnswerChange,
  disabled = false,
  showCorrectAnswer = false,
  timeRemaining: _, // Timer functionality for future implementation
}) => {
  const logicalData: LogicalExpressionData =
    question.question_data as LogicalExpressionData;

  // Helper function to convert variables to internal Variable format
  const mapToVariables = (
    variables: Array<{ name: string; value: boolean }> | undefined,
  ): Variable[] => {
    return variables
      ? variables.map((v) => ({
          name: v.name,
          description: v.name,
          type: "boolean" as const,
          value: v.value,
        }))
      : logicalData.variables.map((v) => ({
          ...v,
          value: false,
          type: v.type || "boolean",
        }));
  };

  // Initialize variables from the question data
  const [variables, setVariables] = useState<Variable[]>(
    mapToVariables(
      answer
        ? (answer as LogicalExpressionAnswerWithState)?.variables
        : undefined,
    ),
  );

  const [expressionNodes, setExpressionNodes] = useState<ExpressionNode[]>(
    (answer as LogicalExpressionAnswerWithState)?.expressionNodes || [],
  );
  const [result, setResult] = useState<boolean | null>(
    (answer as LogicalExpressionAnswerWithState)?.result || null,
  );
  const [error, setError] = useState<string>(
    (answer as LogicalExpressionAnswerWithState)?.error || "",
  );
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (answer) {
      const logicalAnswer = answer as LogicalExpressionAnswerWithState;
      if (logicalAnswer) {
        setVariables(mapToVariables(logicalAnswer.variables));
        setExpressionNodes(logicalAnswer.expressionNodes || []);
        setResult(logicalAnswer.result || null);
        setError(logicalAnswer.error || "");
      }
    }
  }, [answer, logicalData.variables]);

  // Evaluate the expression when nodes or variables change locally
  useEffect(() => {
    if (expressionNodes.length === 0) {
      setResult(null);
      setError("");
      return;
    }

    try {
      const evaluated = evaluateExpression(expressionNodes, variables);
      setResult(evaluated);
      setError("");
    } catch (err) {
      setResult(null);
      setError(err instanceof Error ? err.message : "Invalid expression");
    }
  }, [expressionNodes, variables]);

  const updateParentAnswer = (nodes: ExpressionNode[], vars: Variable[]) => {
    const evaluated = evaluateExpression(nodes, vars);
    const logicalAnswer: LogicalExpressionAnswerWithState = {
      expression: nodes.map((node) => node.value).join(" "),
      variables: vars.map((v) => ({ name: v.name, value: v.value })),
      expressionNodes: nodes,
      result: evaluated || undefined,
      error: "",
    };
    onAnswerChange(logicalAnswer as AnswerDataType);
  };

  const evaluateExpression = (
    nodes: ExpressionNode[],
    vars: Variable[],
  ): boolean | null => {
    if (nodes.length === 0) return null;

    // Create a deep copy to avoid mutating the original
    const nodesCopy = nodes.map((node) => ({ ...node }));
    const varMap = new Map(vars.map((v) => [v.name, v.value]));

    // Handle NOT operators first
    let i = 0;
    while (i < nodesCopy.length) {
      if (nodesCopy[i].type === "not") {
        if (i + 1 >= nodesCopy.length)
          throw new Error("NOT requires a following term");
        const next = nodesCopy[i + 1];
        if (next.type === "variable") {
          const value = varMap.get(next.value);
          if (value === undefined)
            throw new Error(`Unknown variable: ${next.value}`);
          nodesCopy.splice(i, 2, {
            type: "variable",
            value: (!value).toString(),
            id: `temp-${i}`,
          });
        } else if (next.type === "operator") {
          throw new Error("NOT cannot precede an operator");
        }
      } else {
        i++;
      }
    }

    // Convert variables to boolean values
    const values: boolean[] = [];
    const operators: string[] = [];

    for (let j = 0; j < nodesCopy.length; j++) {
      const node = nodesCopy[j];
      if (node.type === "variable") {
        const value = varMap.get(node.value);
        if (value === undefined)
          throw new Error(`Unknown variable: ${node.value}`);
        values.push(value);
      } else if (node.type === "operator") {
        operators.push(node.value);
      }
    }

    if (values.length === 0) return null;
    if (values.length !== operators.length + 1) {
      throw new Error("Invalid expression structure");
    }

    // Evaluate left to right
    let finalResult = values[0];
    for (let k = 0; k < operators.length; k++) {
      const op = operators[k];
      const nextValue = values[k + 1];

      if (op === "AND") {
        finalResult = finalResult && nextValue;
      } else if (op === "OR") {
        finalResult = finalResult || nextValue;
      } else if (op === "XOR") {
        finalResult = finalResult !== nextValue;
      }
    }

    return finalResult;
  };

  const addToExpression = (
    type: "variable" | "operator" | "not",
    value: string,
  ) => {
    if (disabled) return;

    const newNode: ExpressionNode = {
      type,
      value,
      id: `${type}-${Date.now()}-${Math.random()}`,
    };

    const newNodes = [...expressionNodes, newNode];
    setExpressionNodes(newNodes);
    updateParentAnswer(newNodes, variables);
  };

  const removeFromExpression = (id: string) => {
    if (disabled) return;
    const newNodes = expressionNodes.filter((node) => node.id !== id);
    setExpressionNodes(newNodes);
    updateParentAnswer(newNodes, variables);
  };

  const clearExpression = () => {
    if (disabled) return;
    setExpressionNodes([]);
    updateParentAnswer([], variables);
  };

  const toggleVariable = (name: string) => {
    if (disabled) return;
    const newVars = variables.map((v) =>
      v.name === name ? { ...v, value: !v.value } : v,
    );
    setVariables(newVars);
    updateParentAnswer(expressionNodes, newVars);
  };

  const addVariable = () => {
    if (disabled || variables.length >= 10) return;
    const nextLetter = String.fromCharCode(65 + variables.length);
    const newVariable: Variable = {
      name: nextLetter,
      description: `Variable ${nextLetter}`,
      type: "boolean",
      value: false,
    };
    const newVars = [...variables, newVariable];
    setVariables(newVars);
    updateParentAnswer(expressionNodes, newVars);
  };

  const removeVariable = (name: string) => {
    if (disabled || variables.length <= 1) return;
    const newVars = variables.filter((v) => v.name !== name);
    const newNodes = expressionNodes.filter((node) => node.value !== name);
    setVariables(newVars);
    setExpressionNodes(newNodes);
    updateParentAnswer(newNodes, newVars);
  };

  const isCorrect =
    showCorrectAnswer && logicalData.correct_expression
      ? expressionNodes.map((node) => node.value).join(" ") ===
        logicalData.correct_expression
      : null;

  return (
    <div className="space-y-6">
      {/* Problem Statement */}
      <div className="bg-white dark:bg-gray-900 border-2 border-gray-100 dark:border-gray-800 rounded-2xl p-8 shadow-sm">
        <h3 className="font-bold text-xl mb-4 text-text-primary-light dark:text-text-primary-dark flex items-center gap-2">
          <Brain className="w-6 h-6 text-purple-500 fill-purple-500/10" />
          Logical Goal
        </h3>
        <div className="text-text-primary-light dark:text-text-primary-dark leading-relaxed text-lg mb-6">
          <RichTextDisplay content={question.question_text || ""} />
        </div>
        <div className="p-4 bg-gray-50/50 dark:bg-gray-800/30 border border-gray-100 dark:border-gray-800 rounded-2xl flex items-center gap-3">
          <div className="p-2 bg-white dark:bg-gray-700 rounded-lg shadow-sm">
            <Tag className="w-4 h-4 text-blue-500" />
          </div>
          <span className="text-sm font-bold text-text-secondary-light dark:text-text-secondary-dark">
            Expression Format:{" "}
            <span className="font-mono text-blue-600 dark:text-blue-400">
              {logicalData.expression_format}
            </span>
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Variable Editor */}
        <div className="bg-gray-50/50 dark:bg-gray-800/20 border-2 border-gray-100 dark:border-gray-800 p-8 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <h3 className="font-bold text-sm text-text-secondary-light dark:text-text-secondary-dark/70 uppercase tracking-[0.2em] flex items-center gap-2">
              <Plus className="w-4 h-4 text-blue-500" />
              Environment
            </h3>
            {!disabled && variables.length < 10 && (
              <button
                onClick={addVariable}
                className="p-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 shadow-md shadow-blue-500/20 transition-all active:scale-95"
              >
                <Plus className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            {variables.map((variable) => (
              <div
                key={variable.name}
                className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between group h-16 ${
                  variable.value
                    ? "border-green-400 bg-white dark:bg-gray-800 text-green-700 dark:text-green-300 shadow-md shadow-green-500/10"
                    : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-text-secondary-light dark:text-text-secondary-dark/60 hover:border-blue-200 dark:hover:border-blue-900/40 shadow-sm"
                }`}
                onClick={() => toggleVariable(variable.name)}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center font-mono font-bold text-sm border-2 ${
                      variable.value
                        ? "bg-green-100 dark:bg-green-900/40 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300"
                        : "bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-400"
                    }`}
                  >
                    {variable.name}
                  </div>
                  <span className="text-[10px] uppercase font-bold tracking-tighter">
                    {variable.value ? "True" : "False"}
                  </span>
                </div>
                {!disabled && variables.length > 1 && (
                  <Trash2
                    className="w-4 h-4 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeVariable(variable.name);
                    }}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Expression Builder */}
        <div className="bg-white dark:bg-gray-900 border-2 border-gray-100 dark:border-gray-800 rounded-2xl p-8 shadow-sm h-full flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-sm text-text-secondary-light dark:text-text-secondary-dark/70 uppercase tracking-[0.2em] flex items-center gap-2">
              <Brain className="w-4 h-4 text-purple-500" />
              Expression Workbench
            </h3>
            {expressionNodes.length > 0 && !disabled && (
              <button
                onClick={clearExpression}
                className="text-[10px] font-bold text-red-500 hover:text-red-600 uppercase tracking-widest"
              >
                Clear
              </button>
            )}
          </div>

          <div className="bg-gray-50 dark:bg-black/20 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-2xl p-6 min-h-[120px] mb-8 relative flex-1">
            <div className="flex flex-wrap gap-2">
              {expressionNodes.length === 0 ? (
                <div className="absolute inset-0 flex items-center justify-center text-gray-400 dark:text-gray-600 text-sm italic">
                  Construct your logical expression here...
                </div>
              ) : (
                expressionNodes.map((node) => (
                  <div
                    key={node.id}
                    className={`group flex items-center gap-2 px-3 py-2 rounded-xl border-2 shadow-sm transition-all hover:scale-105 ${
                      node.type === "variable"
                        ? "bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300"
                        : node.type === "operator"
                          ? "bg-purple-50 dark:bg-purple-900/30 border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300"
                          : "bg-orange-50 dark:bg-orange-900/30 border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-300"
                    }`}
                  >
                    <span className="font-mono text-xs font-bold uppercase">
                      {node.value}
                    </span>
                    {!disabled && (
                      <X
                        className="w-3.5 h-3.5 text-gray-400 hover:text-red-500 cursor-pointer transition-colors"
                        onClick={() => removeFromExpression(node.id)}
                      />
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Controls */}
          <div className="space-y-6">
            <div className="flex flex-wrap gap-2">
              {variables.map((variable) => (
                <button
                  key={variable.name}
                  onClick={() => addToExpression("variable", variable.name)}
                  disabled={disabled}
                  className="px-5 py-2.5 bg-blue-600 text-white rounded-xl shadow-md shadow-blue-500/20 font-mono font-bold text-sm hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-50"
                >
                  {variable.name}
                </button>
              ))}
              <div className="w-px h-10 bg-gray-100 dark:bg-gray-800 mx-2" />
              <button
                onClick={() => addToExpression("not", "NOT")}
                disabled={disabled}
                className="px-5 py-2.5 bg-orange-500 text-white rounded-xl shadow-md shadow-orange-500/20 font-mono font-bold text-sm hover:bg-orange-600 transition-all active:scale-95 disabled:opacity-50"
              >
                NOT
              </button>
              <button
                onClick={() => addToExpression("operator", "AND")}
                disabled={disabled}
                className="px-5 py-2.5 bg-purple-600 text-white rounded-xl shadow-md shadow-purple-500/20 font-mono font-bold text-sm hover:bg-purple-700 transition-all active:scale-95 disabled:opacity-50"
              >
                AND
              </button>
              <button
                onClick={() => addToExpression("operator", "OR")}
                disabled={disabled}
                className="px-5 py-2.5 bg-purple-600 text-white rounded-xl shadow-md shadow-purple-500/20 font-mono font-bold text-sm hover:bg-purple-700 transition-all active:scale-95 disabled:opacity-50"
              >
                OR
              </button>
              <button
                onClick={() => addToExpression("operator", "XOR")}
                disabled={disabled}
                className="px-5 py-2.5 bg-purple-600 text-white rounded-xl shadow-md shadow-purple-500/20 font-mono font-bold text-sm hover:bg-purple-700 transition-all active:scale-95 disabled:opacity-50"
              >
                XOR
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Result Display */}
      <div
        className={`p-8 rounded-2xl border-2 shadow-sm transition-all duration-500 ${
          error
            ? "border-red-200 bg-red-50/50 dark:bg-red-900/10 dark:border-red-900/30"
            : result === null
              ? "border-gray-100 bg-gray-50/50 dark:bg-gray-800/20 dark:border-gray-800"
              : result
                ? "border-green-200 bg-green-50/50 dark:bg-green-900/10 dark:border-green-900/30"
                : "border-red-200 bg-red-50/50 dark:bg-red-900/10 dark:border-red-900/30"
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] uppercase font-bold tracking-[0.2em] text-text-secondary-light dark:text-text-secondary-dark/70">
              Real-time Evaluation
            </span>
            <h4 className="font-bold text-text-secondary-light dark:text-text-secondary-dark">
              Operational Logic
            </h4>
          </div>
          {error ? (
            <div className="flex items-center gap-2 px-4 py-2 bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 rounded-xl font-bold text-sm">
              <AlertCircle className="w-4 h-4" /> Error: {error}
            </div>
          ) : result !== null ? (
            <div
              className={`flex items-center gap-3 px-6 py-3 rounded-2xl font-bold text-lg transition-all shadow-md ${
                result
                  ? "bg-green-500 text-white shadow-green-500/20"
                  : "bg-red-500 text-white shadow-red-500/20"
              }`}
            >
              {result ? "TRUE" : "FALSE"}
            </div>
          ) : (
            <span className="text-sm text-gray-400 font-medium italic">
              Awaiting Expression...
            </span>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        {/* <button
          onClick={async () => {
            if (!expressionNodes.length || disabled) return;
            setIsSaving(true);
            try {
              const evaluated = evaluateExpression(expressionNodes, variables);
              const logicalAnswer: LogicalExpressionAnswerWithState = {
                expression: expressionNodes.map((node) => node.value).join(" "),
                variables: variables.map((v) => ({
                  name: v.name,
                  value: v.value,
                })),
                expressionNodes,
                result: evaluated || undefined,
                error: "",
                submitted: true,
              };
              await onAnswerChange(logicalAnswer as AnswerDataType, true);
            } finally {
              setIsSaving(false);
            }
          }}
          disabled={disabled || isSaving || expressionNodes.length === 0}
          className="flex items-center gap-2 px-6 py-2 bg-blue-600 dark:bg-blue-700 text-white rounded-2xl hover:bg-blue-700 dark:hover:bg-blue-600 disabled:bg-blue-300 dark:disabled:bg-gray-800 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow-md font-medium"
        >
          {isSaving ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <CheckCircle className="w-4 h-4" />
              Save Answer
            </>
          )}
        </button> */}
      </div>

      {/* Dynamic Truth Table */}
      {variables.length > 0 && variables.length <= 4 && (
        <div className="bg-white dark:bg-gray-900 border-2 border-gray-100 dark:border-gray-800 rounded-2xl p-8 shadow-sm overflow-hidden">
          <h3 className="font-bold text-xl mb-6 text-text-primary-light dark:text-text-primary-dark flex items-center gap-2">
            <Tag className="w-6 h-6 text-blue-500 fill-blue-500/10" />
            Logic Truth Table
          </h3>
          <div className="overflow-x-auto rounded-2xl border border-gray-100 dark:border-gray-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800/50 border-b-2 border-gray-100 dark:border-gray-800">
                  {variables.map((variable) => (
                    <th
                      key={variable.name}
                      className="px-6 py-4 font-bold text-text-secondary-light dark:text-text-secondary-dark/70 uppercase tracking-widest text-[10px] border-r border-gray-100 dark:border-gray-800"
                    >
                      {variable.name}
                    </th>
                  ))}
                  <th className="px-6 py-4 font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest text-[10px]">
                    Output
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {(() => {
                  // Generate all combinations for current variables
                  const combos = 1 << variables.length;
                  const rows = [];

                  for (let mask = 0; mask < combos; mask++) {
                    const testVars = variables.map((v, i) => ({
                      ...v,
                      value: Boolean(mask & (1 << i)),
                    }));

                    let output = null;
                    let outputError = "";

                    try {
                      output = evaluateExpression(
                        expressionNodes.map((node) => ({ ...node })),
                        testVars,
                      );
                    } catch (err) {
                      outputError =
                        err instanceof Error ? err.message : "Error";
                    }

                    rows.push(
                      <tr
                        key={mask}
                        className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors"
                      >
                        {testVars.map((variable) => (
                          <td
                            key={variable.name}
                            className="px-6 py-4 font-mono text-center font-bold text-text-secondary-light dark:text-text-secondary-dark border-r border-gray-50 dark:border-gray-800"
                          >
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] ${
                                variable.value
                                  ? "bg-green-100 dark:bg-green-900/30 text-green-700"
                                  : "bg-red-100 dark:bg-red-900/30 text-red-700"
                              }`}
                            >
                              {String(variable.value).toUpperCase()}
                            </span>
                          </td>
                        ))}
                        <td className="px-6 py-4 font-mono text-center font-bold text-blue-600 dark:text-blue-400">
                          <span
                            className={`px-3 py-1 rounded-lg text-xs ${
                              outputError
                                ? "bg-red-100 dark:bg-red-900/40 text-red-700"
                                : output === true
                                  ? "bg-blue-100 dark:bg-blue-900/40"
                                  : output === false
                                    ? "bg-gray-100 dark:bg-gray-800"
                                    : "bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700"
                            }`}
                          >
                            {outputError
                              ? "ERR"
                              : output === null
                                ? "-"
                                : String(output).toUpperCase()}
                          </span>
                        </td>
                      </tr>,
                    );
                  }

                  return rows;
                })()}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Correct Answer Display */}
      {showCorrectAnswer && logicalData.correct_expression && (
        <div className="bg-blue-50/50 dark:bg-blue-900/10 border-2 border-blue-200 dark:border-blue-800 rounded-2xl p-8 shadow-sm animate-fadeIn">
          <h3 className="font-bold text-xl mb-4 text-blue-900 dark:text-blue-300 flex items-center gap-2">
            <Check className="w-6 h-6" />
            Validated Logical String
          </h3>
          <div className="bg-white dark:bg-gray-900/50 rounded-2xl p-6 border-2 border-blue-100 dark:border-blue-800 shadow-inner">
            <code className="text-lg font-mono text-blue-800 dark:text-blue-200 font-bold">
              {logicalData.correct_expression}
            </code>
          </div>
        </div>
      )}
    </div>
  );
};

export default LogicalExpressionQuestion;
