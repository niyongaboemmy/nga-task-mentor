import React, { useState, useEffect } from "react";
import type {
  QuestionComponentProps,
  LogicalExpressionData,
  LogicalExpressionAnswer,
  AnswerDataType,
} from "../../../types/quiz.types";
import { Check, X, Plus, Trash2, AlertCircle } from "lucide-react";

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
    variables: Array<{ name: string; value: boolean }> | undefined
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
        : undefined
    )
  );

  const [expressionNodes, setExpressionNodes] = useState<ExpressionNode[]>(
    (answer as LogicalExpressionAnswerWithState)?.expressionNodes || []
  );
  const [result, setResult] = useState<boolean | null>(
    (answer as LogicalExpressionAnswerWithState)?.result || null
  );
  const [error, setError] = useState<string>(
    (answer as LogicalExpressionAnswerWithState)?.error || ""
  );

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

  // Evaluate the expression
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

      const logicalAnswer: LogicalExpressionAnswerWithState = {
        expression: expressionNodes.map((node) => node.value).join(" "),
        variables: variables.map((v) => ({ name: v.name, value: v.value })), // Transform to match LogicalExpressionAnswer format
        expressionNodes,
        result: evaluated || undefined,
        error: "",
      };

      onAnswerChange(logicalAnswer as AnswerDataType);
    } catch (err) {
      setResult(null);
      setError(err instanceof Error ? err.message : "Invalid expression");
    }
  }, [expressionNodes, variables]);

  const evaluateExpression = (
    nodes: ExpressionNode[],
    vars: Variable[]
  ): boolean | null => {
    if (nodes.length === 0) return null;

    const varMap = new Map(vars.map((v) => [v.name, v.value]));

    // Handle NOT operators first
    let i = 0;
    while (i < nodes.length) {
      if (nodes[i].type === "not") {
        if (i + 1 >= nodes.length)
          throw new Error("NOT requires a following term");
        const next = nodes[i + 1];
        if (next.type === "variable") {
          const value = varMap.get(next.value);
          if (value === undefined)
            throw new Error(`Unknown variable: ${next.value}`);
          nodes.splice(i, 2, {
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

    for (let j = 0; j < nodes.length; j++) {
      const node = nodes[j];
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
    value: string
  ) => {
    if (disabled) return;

    const newNode: ExpressionNode = {
      type,
      value,
      id: `${type}-${Date.now()}-${Math.random()}`,
    };

    setExpressionNodes([...expressionNodes, newNode]);
  };

  const removeFromExpression = (id: string) => {
    if (disabled) return;
    setExpressionNodes(expressionNodes.filter((node) => node.id !== id));
  };

  const clearExpression = () => {
    if (disabled) return;
    setExpressionNodes([]);
  };

  const toggleVariable = (name: string) => {
    if (disabled) return;
    setVariables(
      variables.map((v) => (v.name === name ? { ...v, value: !v.value } : v))
    );
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
    setVariables([...variables, newVariable]);
  };

  const removeVariable = (name: string) => {
    if (disabled || variables.length <= 1) return;
    setVariables(variables.filter((v) => v.name !== name));
    setExpressionNodes(expressionNodes.filter((node) => node.value !== name));
  };

  const isCorrect =
    showCorrectAnswer && logicalData.correct_expression
      ? expressionNodes.map((node) => node.value).join(" ") ===
        logicalData.correct_expression
      : null;

  return (
    <div className="space-y-6">
      {/* Question Text */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h3 className="font-semibold text-lg mb-2">
          Logical Expression Question
        </h3>
        <p className="text-gray-700 mb-3">{question.question_text}</p>
        <div className="text-sm text-gray-600">
          <strong>Expression Format:</strong> {logicalData.expression_format}
        </div>
      </div>

      {/* Variables Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-900">Variables</h3>
          <button
            onClick={addVariable}
            disabled={disabled || variables.length >= 10}
            className="flex items-center gap-1 px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Plus size={14} />
            Add
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {variables.map((variable) => (
            <div
              key={variable.name}
              className="flex items-center gap-2 bg-gray-50 rounded-lg p-2 border border-gray-200"
            >
              <button
                onClick={() => toggleVariable(variable.name)}
                disabled={disabled}
                className={`px-4 py-2 rounded font-mono font-bold transition-colors ${
                  variable.value
                    ? "bg-green-500 text-white"
                    : "bg-red-500 text-white"
                } disabled:opacity-50`}
              >
                {variable.name}: {variable.value ? "T" : "F"}
              </button>
              <div
                className="text-xs text-gray-600 max-w-[100px] truncate"
                title={variable.description}
              >
                {variable.description}
              </div>
              {variables.length > 1 && (
                <button
                  onClick={() => removeVariable(variable.name)}
                  disabled={disabled}
                  className="p-1 text-red-500 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Expression Builder */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-900">Build Expression</h3>
          <button
            onClick={clearExpression}
            disabled={disabled || expressionNodes.length === 0}
            className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Clear
          </button>
        </div>

        {/* Current Expression Display */}
        <div className="mb-4 min-h-[60px] bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 p-3 flex flex-wrap items-center gap-2">
          {expressionNodes.length === 0 ? (
            <span className="text-gray-400 italic">
              Click buttons below to build your expression...
            </span>
          ) : (
            expressionNodes.map((node) => (
              <div
                key={node.id}
                className={`flex items-center gap-1 px-3 py-1.5 rounded font-mono font-semibold ${
                  node.type === "variable"
                    ? "bg-blue-100 text-blue-800 border border-blue-300"
                    : node.type === "operator"
                    ? "bg-purple-100 text-purple-800 border border-purple-300"
                    : "bg-orange-100 text-orange-800 border border-orange-300"
                }`}
              >
                {node.value}
                <button
                  onClick={() => removeFromExpression(node.id)}
                  disabled={disabled}
                  className="ml-1 hover:bg-white hover:bg-opacity-50 rounded p-0.5 transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Expression Builder Controls */}
        <div className="space-y-3">
          <div>
            <div className="text-sm font-medium text-gray-700 mb-2">
              Variables:
            </div>
            <div className="flex flex-wrap gap-2">
              {variables.map((variable) => (
                <button
                  key={variable.name}
                  onClick={() => addToExpression("variable", variable.name)}
                  disabled={disabled}
                  className="px-4 py-2 bg-blue-500 text-white rounded font-mono font-bold hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {variable.name}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="text-sm font-medium text-gray-700 mb-2">
              Operators:
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => addToExpression("operator", "AND")}
                disabled={disabled}
                className="px-4 py-2 bg-purple-500 text-white rounded font-mono font-bold hover:bg-purple-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                AND
              </button>
              <button
                onClick={() => addToExpression("operator", "OR")}
                disabled={disabled}
                className="px-4 py-2 bg-purple-500 text-white rounded font-mono font-bold hover:bg-purple-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                OR
              </button>
              <button
                onClick={() => addToExpression("operator", "XOR")}
                disabled={disabled}
                className="px-4 py-2 bg-purple-500 text-white rounded font-mono font-bold hover:bg-purple-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                XOR
              </button>
              <button
                onClick={() => addToExpression("not", "NOT")}
                disabled={disabled}
                className="px-4 py-2 bg-orange-500 text-white rounded font-mono font-bold hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                NOT
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        </div>
      )}

      {/* Result Display */}
      {result !== null && !error && (
        <div
          className={`rounded-lg p-4 border-2 ${
            result ? "bg-green-50 border-green-300" : "bg-red-50 border-red-300"
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-gray-700 mb-1">
                Expression Result:
              </div>
              <div
                className={`text-2xl font-bold font-mono ${
                  result ? "text-green-700" : "text-red-700"
                }`}
              >
                {result ? "TRUE" : "FALSE"}
              </div>
            </div>
            {showCorrectAnswer && logicalData.correct_expression && (
              <div className="flex items-center gap-2">
                {isCorrect ? (
                  <div className="flex items-center gap-2 text-green-600">
                    <Check className="w-6 h-6" />
                    <span className="font-semibold">Correct!</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-red-600">
                    <X className="w-6 h-6" />
                    <span className="font-semibold">
                      Expected: {logicalData.correct_expression}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Truth Table */}
      {logicalData.truth_table && logicalData.truth_table.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h3 className="font-semibold text-lg mb-3">Truth Table</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  {variables.map((variable) => (
                    <th
                      key={variable.name}
                      className="text-left p-2 font-medium text-gray-700"
                    >
                      {variable.name}
                    </th>
                  ))}
                  <th className="text-left p-2 font-medium text-gray-700">
                    Result
                  </th>
                </tr>
              </thead>
              <tbody>
                {logicalData.truth_table.map((row, idx) => (
                  <tr key={idx} className="border-b border-gray-100">
                    {variables.map((variable) => (
                      <td key={variable.name} className="p-2 font-mono">
                        {String(row.inputs[variable.name] || false)}
                      </td>
                    ))}
                    <td className="p-2 font-mono font-bold text-blue-600">
                      {String(row.output)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Correct Answer Display */}
      {showCorrectAnswer && logicalData.correct_expression && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-lg mb-3 text-blue-900">
            Correct Expression
          </h3>
          <div className="bg-white rounded p-3 border border-blue-200">
            <code className="text-sm font-mono text-blue-800">
              {logicalData.correct_expression}
            </code>
          </div>
        </div>
      )}
    </div>
  );
};

export default LogicalExpressionQuestion;
