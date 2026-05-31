import React, { useState, useEffect } from "react";
import {
  GripVertical,
  CheckCircle,
  XCircle,
  RotateCcw,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import type {
  QuestionComponentProps,
  OrderingData,
  OrderingAnswer,
} from "../../../types/quiz.types";
import { Info, AlertCircle } from "lucide-react";
import RichTextDisplay from "../../Common/RichTextDisplay";

export const OrderingQuestion: React.FC<QuestionComponentProps> = ({
  question,
  answer,
  onAnswerChange,
  disabled = false,
  showCorrectAnswer = false,
  timeRemaining: _, // Timer functionality for future implementation
}) => {
  const orderingData: OrderingData = question.question_data as OrderingData;
  const [isSaving, setIsSaving] = useState(false);

  const handleManualSave = async () => {
    setIsSaving(true);
    try {
      if (onAnswerChange) {
        await onAnswerChange(
          { ordered_item_ids: items.map((i) => i.id) },
          true,
        );
      }
    } finally {
      setIsSaving(false);
    }
  };

  // Convert OrderingData items to internal format with content field
  const [items, setItems] = useState(() => {
    const dataItems = orderingData.items.map((item) => ({
      id: item.id,
      content: item.text,
      correctPosition: item.order,
    }));

    // If we have existing answer, reorder items based on ordered_item_ids
    if (answer) {
      const orderedIds =
        (answer as any).ordered_item_ids ||
        (Array.isArray(answer) ? answer : null);
      if (orderedIds && Array.isArray(orderedIds)) {
        const orderedItems = orderedIds
          .map((id) => dataItems.find((item) => item.id === id))
          .filter(
            (item): item is NonNullable<typeof item> => item !== undefined,
          );
        return orderedItems.length === dataItems.length
          ? orderedItems
          : dataItems;
      }
    }

    return dataItems;
  });

  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  useEffect(() => {
    if (answer) {
      const orderedIds =
        (answer as any).ordered_item_ids ||
        (Array.isArray(answer) ? answer : null);
      if (orderedIds && Array.isArray(orderedIds)) {
        const orderedItems = orderedIds
          .map((id) => orderingData.items.find((item) => item.id === id))
          .filter(
            (item): item is NonNullable<typeof item> => item !== undefined,
          )
          .map((item) => ({
            id: item.id,
            content: item.text,
            correctPosition: item.order,
          }));
        if (orderedItems.length === orderingData.items.length) {
          setItems(orderedItems);
        }
      }
    }
  }, [answer, orderingData.items]);

  const handleDragStart = (index: number) => {
    if (disabled) return;
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (disabled) return;
    setDragOverIndex(index);
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (disabled || draggedIndex === null) return;

    const newItems = [...items];
    const draggedItem = newItems[draggedIndex];

    newItems.splice(draggedIndex, 1);
    newItems.splice(dropIndex, 0, draggedItem);

    setItems(newItems);
    setDraggedIndex(null);
    setDragOverIndex(null);

    const orderedIds = newItems.map((item) => item.id);
    onAnswerChange({ ordered_item_ids: orderedIds } as OrderingAnswer);
  };

  const moveItem = (index: number, direction: "up" | "down") => {
    if (disabled) return;

    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= items.length) return;

    const newItems = [...items];
    [newItems[index], newItems[newIndex]] = [
      newItems[newIndex],
      newItems[index],
    ];

    setItems(newItems);
    const orderedIds = newItems.map((item) => item.id);
    onAnswerChange({ ordered_item_ids: orderedIds } as OrderingAnswer);
  };

  const resetOrder = () => {
    const resetItems = orderingData.items.map((item) => ({
      id: item.id,
      content: item.text,
      correctPosition: item.order,
    }));
    setItems(resetItems);

    const orderedIds = resetItems.map((item) => item.id);
    onAnswerChange({ ordered_item_ids: orderedIds } as OrderingAnswer);
  };

  const getCorrectItems = () => {
    return [...orderingData.items].sort((a, b) => a.order - b.order);
  };

  const isCorrectOrder = () => {
    if (!showCorrectAnswer) return false;
    const correctOrder = getCorrectItems();
    return items.every((item, index) => {
      const correctItem = correctOrder[index];
      return correctItem && item.id === correctItem.id;
    });
  };

  return (
    <div className="space-y-6">
      {/* Instruction */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 transition-colors duration-200">
        <p className="text-sm text-blue-900 dark:text-blue-300 font-medium">
          Arrange the items in the correct order
        </p>
        <p className="text-xs text-blue-700 dark:text-blue-400 mt-1">
          Drag items to reorder them, or use the arrow buttons.
        </p>
      </div>

      {/* Ordering Interface */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-4 transition-all duration-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-sm text-gray-700 dark:text-gray-300">
            {showCorrectAnswer ? "Correct Solution" : "Arrange in Order"}
          </h3>
        </div>

        <div className="space-y-2">
          {items.map((item, index) => {
            const isDragging = draggedIndex === index;
            const isDragOver = dragOverIndex === index;
            const correct = showCorrectAnswer
              ? (() => {
                  const correctItem = getCorrectItems()[index];
                  return correctItem
                    ? item.correctPosition === index + 1
                    : false;
                })()
              : null;

            return (
              <div
                key={item.id}
                draggable={!disabled && !showCorrectAnswer}
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, index)}
                className={`relative flex items-center gap-3 p-4 rounded-lg border-2 transition-all ${
                  isDragging
                    ? "opacity-50 scale-95"
                    : isDragOver
                      ? "border-blue-400 bg-blue-50 dark:bg-blue-900/20 scale-105"
                      : showCorrectAnswer
                        ? correct
                          ? "border-green-400 bg-green-50 dark:bg-green-900/20"
                          : "border-red-400 bg-red-50 dark:bg-red-900/20"
                        : "border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 hover:border-gray-400 dark:hover:border-gray-500"
                } ${
                  !disabled && !showCorrectAnswer
                    ? "cursor-move"
                    : "cursor-default text-gray-400"
                }`}
              >
                {/* Drag Handle */}
                {!showCorrectAnswer && (
                  <GripVertical className="w-5 h-5 text-gray-400 flex-shrink-0" />
                )}

                {/* Position Number */}
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 transition-colors ${
                    showCorrectAnswer
                      ? correct
                        ? "bg-green-200 dark:bg-green-900/40 text-green-800 dark:text-green-300"
                        : "bg-red-200 dark:bg-red-900/40 text-red-800 dark:text-red-300"
                      : "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300"
                  }`}
                >
                  {index + 1}
                </div>

                {/* Content */}
                <div className="flex-1 text-sm font-medium">
                  <RichTextDisplay content={item.content || ""} />
                </div>

                {/* Feedback Icons */}
                {showCorrectAnswer && (
                  <div className="flex-shrink-0">
                    {correct ? (
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    ) : (
                      <div className="flex items-center gap-2">
                        <XCircle className="w-5 h-5 text-red-600" />
                        <span className="text-xs text-red-700">
                          Should be position {item.correctPosition}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Arrow Buttons */}
                {!showCorrectAnswer && (
                  <div className="flex flex-col gap-1 flex-shrink-0">
                    <button
                      onClick={() => moveItem(index, "up")}
                      disabled={disabled || index === 0}
                      className="p-1 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      title="Move up"
                    >
                      <ArrowUp className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => moveItem(index, "down")}
                      disabled={disabled || index === items.length - 1}
                      className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      title="Move down"
                    >
                      <ArrowDown className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Action Buttons */}
      {!showCorrectAnswer && (
        <div className="flex gap-3">
          {/* <button
            onClick={handleManualSave}
            disabled={disabled || isSaving}
            className="flex items-center gap-2 px-6 py-2 bg-blue-600 dark:bg-blue-700 text-white rounded-2xl hover:bg-blue-700 dark:hover:bg-blue-600 disabled:bg-blue-300 dark:disabled:bg-gray-800 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow-md font-medium"
          >
            {isSaving ? (
              <>
                <RotateCcw className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4" />
                Save Answer
              </>
            )}
          </button>

          <button
            onClick={resetOrder}
            disabled={disabled || isSaving}
            className="flex items-center gap-2 px-6 py-2 bg-gray-600 dark:bg-gray-700 text-white rounded-2xl hover:bg-gray-700 dark:hover:bg-gray-600 disabled:bg-gray-300 dark:disabled:bg-gray-800 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow-md"
          >
            <RotateCcw className="w-4 h-4" />
            Reset Order
          </button> */}
        </div>
      )}

      {/* Feedback */}
      {showCorrectAnswer && (
        <div
          className={`border-2 rounded-2xl p-6 ${
            isCorrectOrder()
              ? "border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-900/10"
              : "border-yellow-200 dark:border-yellow-800 bg-yellow-50/50 dark:bg-yellow-900/10"
          }`}
        >
          <div className="flex items-start gap-4">
            {isCorrectOrder() ? (
              <div className="bg-green-500 text-white rounded-full p-2">
                <CheckCircle className="w-6 h-6" />
              </div>
            ) : (
              <div className="bg-yellow-500 text-white rounded-full p-2">
                <XCircle className="w-6 h-6" />
              </div>
            )}
            <div>
              <h3 className="font-bold text-xl mb-1 text-gray-900 dark:text-gray-100">
                {isCorrectOrder() ? "Perfect Order!" : "Not Quite Right"}
              </h3>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                {isCorrectOrder()
                  ? "All items are in the correct sequence! Excellent work."
                  : "Review the items marked with ✗ to see where they should go."}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Correct Answer Display */}
      {/* {showCorrectAnswer && (
        <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-2xl p-6 shadow-sm">
          <h3 className="font-bold text-lg mb-4 text-blue-900 dark:text-blue-300 flex items-center gap-2">
            <CheckCircle className="w-5 h-5" />
            Correct Sequence
          </h3>
          <div className="space-y-3">
            {getCorrectItems().map((item, index) => (
              <div
                key={item.id}
                className="flex items-center gap-3 p-4 bg-white dark:bg-gray-800 rounded-xl border border-blue-200 dark:border-blue-700 shadow-sm"
              >
                <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 flex items-center justify-center text-sm font-bold flex-shrink-0">
                  {index + 1}
                </div>
                <div className="flex-1 text-sm font-medium text-gray-900 dark:text-gray-100">
                  <RichTextDisplay content={item.text || ""} />
                </div>
                <CheckCircle className="w-5 h-5 text-blue-500 dark:text-blue-400 flex-shrink-0" />
              </div>
            ))}
          </div>
        </div>
      )} */}

      {/* Drag Hint */}
      {!showCorrectAnswer && draggedIndex !== null && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-sm text-blue-900">
            Drop the item in its correct position
          </p>
        </div>
      )}
    </div>
  );
};

export default OrderingQuestion;
