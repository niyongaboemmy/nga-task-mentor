import React, { useState, useEffect } from "react";
import type {
  QuestionComponentProps,
  DragDropData,
  DragDropAnswer,
  AnswerDataType
} from "../../../types/quiz.types";
import { GripVertical, CheckCircle, XCircle, RotateCcw } from "lucide-react";

// Extended answer type for component state management
interface DragDropAnswerWithState extends DragDropAnswer {
  showFeedback?: boolean;
  isCorrect?: boolean;
}

export const DragDropQuestion: React.FC<QuestionComponentProps> = ({
  question,
  answer,
  onAnswerChange,
  disabled = false,
  showCorrectAnswer = false,
  timeRemaining: _, // Timer functionality for future implementation
}) => {
  const dragDropData: DragDropData = question.question_data as DragDropData;

  const [availableItems, setAvailableItems] = useState(
    dragDropData.draggable_items.filter(
      item => !Object.values((answer as DragDropAnswer)?.placements || {}).includes(item.id)
    )
  );
  const [placements, setPlacements] = useState<Record<string, string>>(
    (answer as DragDropAnswer)?.placements || {}
  );
  const [draggedItem, setDraggedItem] = useState<{ id: string; text: string; value: string } | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);

  useEffect(() => {
    if (answer) {
      const dragDropAnswer = answer as DragDropAnswerWithState;
      if (dragDropAnswer?.placements) {
        setPlacements(dragDropAnswer.placements);
        // Update available items based on current placements
        const placedItemIds = Object.values(dragDropAnswer.placements);
        setAvailableItems(
          dragDropData.draggable_items.filter(item => !placedItemIds.includes(item.id))
        );
        setShowFeedback(dragDropAnswer.showFeedback || false);
        setIsCorrect(dragDropAnswer.isCorrect || false);
      }
    } else {
      // Initialize with all items available
      setAvailableItems([...dragDropData.draggable_items]);
      setPlacements({});
      setShowFeedback(false);
      setIsCorrect(false);
    }
  }, [answer, dragDropData.draggable_items]);

  const handleDragStart = (item: { id: string; text: string; value: string }) => {
    if (disabled || showFeedback) return;
    setDraggedItem(item);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (targetZoneId: string) => {
    if (!draggedItem || disabled || showFeedback) return;

    const newPlacements = { ...placements };

    // Remove from previous zone if exists
    Object.keys(newPlacements).forEach(zoneId => {
      if (newPlacements[zoneId] === draggedItem.id) {
        delete newPlacements[zoneId];
      }
    });

    // Place in new zone
    newPlacements[targetZoneId] = draggedItem.id;

    setPlacements(newPlacements);

    // Update available items
    const placedItemIds = Object.values(newPlacements);
    setAvailableItems(
      dragDropData.draggable_items.filter(item => !placedItemIds.includes(item.id))
    );

    setDraggedItem(null);

    const dragDropAnswer: DragDropAnswer = {
      placements: newPlacements,
    };

    onAnswerChange(dragDropAnswer as AnswerDataType);
  };

  const checkAnswer = () => {
    let correct = true;

    for (const zone of dragDropData.drop_zones) {
      const placedItemId = placements[zone.id];

      if (!placedItemId || !zone.correct_items.includes(placedItemId)) {
        correct = false;
        break;
      }
    }

    // Check if all zones have items placed
    if (Object.keys(placements).length !== dragDropData.drop_zones.length) {
      correct = false;
    }

    setIsCorrect(correct);
    setShowFeedback(true);

    const dragDropAnswer: DragDropAnswerWithState = {
      placements,
      showFeedback: true,
      isCorrect: correct,
    };

    onAnswerChange(dragDropAnswer as AnswerDataType);
  };

  const resetAnswer = () => {
    setPlacements({});
    setAvailableItems([...dragDropData.draggable_items]);
    setShowFeedback(false);
    setIsCorrect(false);

    const dragDropAnswer: DragDropAnswer = {
      placements: {},
    };

    onAnswerChange(dragDropAnswer as AnswerDataType);
  };

  const getZoneStatus = (zoneId: string) => {
    if (!showFeedback) return null;
    const zone = dragDropData.drop_zones.find((z) => z.id === zoneId);
    if (!zone) return null;

    const placedItemId = placements[zoneId];
    return placedItemId && zone.correct_items.includes(placedItemId);
  };

  const getItemInZone = (zoneId: string) => {
    const itemId = placements[zoneId];
    if (!itemId) return null;
    return dragDropData.draggable_items.find(item => item.id === itemId);
  };

  const DraggableItem = ({
    item,
    showStatus,
    isCorrectItem,
  }: {
    item: { id: string; text: string; image?: string; value: string };
    showStatus?: boolean;
    isCorrectItem?: boolean;
  }) => (
    <div
      draggable={!disabled && !showFeedback}
      onDragStart={() => handleDragStart(item)}
      className={`flex items-center gap-2 p-3 bg-white border-2 rounded-lg cursor-move transition-all ${
        disabled || showFeedback
          ? "cursor-not-allowed opacity-75"
          : "hover:shadow-md hover:border-blue-400"
      } ${
        showStatus
          ? isCorrectItem
            ? "border-green-400 bg-green-50"
            : "border-red-400 bg-red-50"
          : "border-gray-300"
      }`}
    >
      <GripVertical className="w-4 h-4 text-gray-400 flex-shrink-0" />
      <span className="text-sm flex-1">{item.text}</span>
      {showStatus && (
        <>
          {isCorrectItem ? (
            <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
          ) : (
            <XCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
          )}
        </>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Problem Statement */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h3 className="font-semibold text-lg mb-2">Question</h3>
        <div className="text-gray-700 whitespace-pre-wrap">
          {question.question_text}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Available Items */}
        <div>
          <div className="bg-white border-2 border-gray-300 rounded-lg p-4 min-h-[200px]">
            <h3 className="font-semibold text-sm mb-3 text-gray-700">
              Available Items ({availableItems.length})
            </h3>
            <div
              className="space-y-2"
              onDragOver={handleDragOver}
              onDrop={() => handleDrop("available")}
            >
              {availableItems.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm">
                  All items placed
                </div>
              ) : (
                availableItems.map((item) => (
                  <DraggableItem key={item.id} item={item} />
                ))
              )}
            </div>
          </div>
        </div>

        {/* Drop Zones */}
        <div className="space-y-4">
          {dragDropData.drop_zones.map((zone) => {
            const zoneStatus = getZoneStatus(zone.id);
            const itemInZone = getItemInZone(zone.id);

            return (
              <div
                key={zone.id}
                className={`border-2 rounded-lg p-4 min-h-[120px] transition-colors relative ${
                  showFeedback
                    ? zoneStatus
                      ? "border-green-400 bg-green-50"
                      : "border-red-400 bg-red-50"
                    : "border-gray-300 bg-white"
                }`}
                onDragOver={handleDragOver}
                onDrop={() => handleDrop(zone.id)}
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-sm text-gray-700">
                    {zone.label || zone.id}
                  </h3>
                  {showFeedback && (
                    <>
                      {zoneStatus ? (
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-600" />
                      )}
                    </>
                  )}
                </div>
                <div className="space-y-2">
                  {!itemInZone ? (
                    <div className="text-center py-6 text-gray-400 text-sm border-2 border-dashed border-gray-200 rounded">
                      Drop items here
                    </div>
                  ) : (
                    <DraggableItem
                      item={itemInZone}
                      showStatus={showFeedback}
                      isCorrectItem={zoneStatus || false}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        {!showFeedback ? (
          <>
            <button
              onClick={checkAnswer}
              disabled={disabled || Object.keys(placements).length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed transition-colors"
            >
              <CheckCircle className="w-4 h-4" />
              Check Answer
            </button>
            <button
              onClick={resetAnswer}
              disabled={disabled}
              className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Reset
            </button>
          </>
        ) : (
          <button
            onClick={resetAnswer}
            disabled={disabled}
            className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Try Again
          </button>
        )}
      </div>

      {/* Feedback */}
      {showFeedback && (
        <div
          className={`border rounded-lg p-4 ${
            isCorrect
              ? "border-green-200 bg-green-50"
              : "border-red-200 bg-red-50"
          }`}
        >
          <div className="flex items-start gap-3">
            {isCorrect ? (
              <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0" />
            ) : (
              <XCircle className="w-6 h-6 text-red-600 flex-shrink-0" />
            )}
            <div>
              <h3 className="font-semibold text-lg mb-1">
                {isCorrect ? "Correct!" : "Not Quite Right"}
              </h3>
              <p className="text-sm text-gray-700">
                {isCorrect
                  ? "All items are placed correctly."
                  : "Some items are in the wrong zones. Review the highlighted areas and try again."}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Correct Answer Display */}
      {showCorrectAnswer && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-lg mb-3 text-blue-900">
            Correct Answer
          </h3>
          <div className="space-y-3">
            {dragDropData.drop_zones.map((zone) => (
              <div key={zone.id} className="bg-white rounded p-3">
                <div className="font-medium text-sm mb-2">
                  {zone.label || zone.id}
                </div>
                <div className="flex flex-wrap gap-2">
                  {zone.correct_items.map((itemId) => {
                    const item = dragDropData.draggable_items.find(
                      (i) => i.id === itemId
                    );
                    return (
                      <span
                        key={itemId}
                        className="px-3 py-1 bg-blue-100 text-blue-800 rounded text-sm"
                      >
                        {item?.text}
                      </span>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default DragDropQuestion;
