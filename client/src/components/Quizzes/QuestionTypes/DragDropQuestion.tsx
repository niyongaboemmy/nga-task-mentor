import React, { useState, useEffect } from "react";
import type {
  QuestionComponentProps,
  DragDropData,
  DragDropAnswer,
  AnswerDataType,
} from "../../../types/quiz.types";
import {
  GripVertical,
  CheckCircle,
  XCircle,
  RotateCcw,
  MousePointer2,
  Box,
  X,
  AlertCircle,
} from "lucide-react";
import RichTextDisplay from "../../Common/RichTextDisplay";

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
      (item) =>
        !Object.values((answer as DragDropAnswer)?.placements || {}).includes(
          item.id,
        ),
    ),
  );
  const [placements, setPlacements] = useState<Record<string, string>>(
    (answer as DragDropAnswer)?.placements || {},
  );
  const [draggedItem, setDraggedItem] = useState<{
    id: string;
    text: string;
    value: string;
  } | null>(null);
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
          dragDropData.draggable_items.filter(
            (item) => !placedItemIds.includes(item.id),
          ),
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

  const handleDragStart = (item: {
    id: string;
    text: string;
    value: string;
  }) => {
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
    Object.keys(newPlacements).forEach((zoneId) => {
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
      dragDropData.draggable_items.filter(
        (item) => !placedItemIds.includes(item.id),
      ),
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
    return dragDropData.draggable_items.find((item) => item.id === itemId);
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
      className={`flex items-center gap-2 p-3 bg-white dark:bg-gray-800 border-2 rounded-lg cursor-move transition-all ${
        disabled || showFeedback
          ? "cursor-not-allowed opacity-60"
          : "hover:shadow-md hover:border-blue-400 dark:hover:border-blue-500"
      } ${
        showStatus
          ? isCorrectItem
            ? "border-green-400 bg-green-50 dark:bg-green-900/20"
            : "border-red-400 bg-red-50 dark:bg-red-900/20"
          : "border-gray-300 dark:border-gray-700"
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
      {/* Question Prompt */}
      <div className="bg-white dark:bg-gray-900 border-2 border-gray-100 dark:border-gray-800 rounded-3xl p-8 shadow-sm">
        <h3 className="font-bold text-xl mb-4 text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <CheckCircle className="w-6 h-6 text-blue-500 fill-blue-500/10" />
          Interactive Mapping
        </h3>
        <div className="text-gray-800 dark:text-gray-200 leading-relaxed text-lg mb-6">
          <RichTextDisplay content={question.question_text || ""} />
        </div>
        <div className="p-4 bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 rounded-2xl flex items-center gap-4">
          <div className="p-3 bg-blue-100 dark:bg-blue-900/40 rounded-xl text-blue-600 dark:text-blue-400">
            <MousePointer2 className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] uppercase font-bold tracking-widest text-blue-600/60 dark:text-blue-400/60">
              Instructions
            </p>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Drag items from the repository to their correct anchors on the
              schematic.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Available Items */}
        <div className="bg-gray-50/50 dark:bg-gray-800/20 border-2 border-gray-100 dark:border-gray-800 rounded-3xl p-8 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-sm text-gray-500 dark:text-gray-400 uppercase tracking-[0.2em] flex items-center gap-2">
              <Box className="w-4 h-4 text-orange-500" />
              Item Repository
            </h3>
            <span className="text-[10px] font-bold text-gray-400 uppercase">
              {availableItems.length} Items Available
            </span>
          </div>
          <div className="flex flex-wrap gap-4">
            {availableItems.map((item) => (
              <div
                key={item.id}
                draggable={!disabled}
                onDragStart={() => handleDragStart(item)}
                className={`px-6 py-3 bg-white dark:bg-gray-800 border-2 border-gray-100 dark:border-gray-700 rounded-2xl shadow-sm text-gray-800 dark:text-gray-100 font-bold cursor-grab active:cursor-grabbing hover:border-orange-200 dark:hover:border-orange-900/40 hover:shadow-lg transition-all flex items-center gap-3 group ${
                  disabled ? "opacity-50 cursor-not-allowed" : ""
                }`}
              >
                <div className="w-2 h-2 rounded-full bg-orange-400 group-hover:scale-125 transition-transform" />
                {item.text}
              </div>
            ))}
            {availableItems.length === 0 && (
              <div className="w-full py-8 text-center text-gray-400 dark:text-gray-600 text-sm italic bg-white/50 dark:bg-black/20 rounded-2xl border-2 border-dashed border-gray-100 dark:border-gray-800">
                All items have been deployed.
              </div>
            )}
          </div>
        </div>

        {/* Drop Zones */}
        <div className="space-y-4">
          {dragDropData.drop_zones.map((zone) => {
            const zoneStatus = getZoneStatus(zone.id);
            const itemInZone = getItemInZone(zone.id);
            const isPlaced = !!itemInZone;

            return (
              <div
                key={zone.id}
                onDragOver={handleDragOver}
                onDrop={() => handleDrop(zone.id)}
                className={`p-4 rounded-xl border-2 border-dashed transition-all ${
                  isPlaced
                    ? "border-solid border-blue-400 bg-blue-50 dark:bg-blue-900/10"
                    : "border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 hover:border-blue-300 dark:hover:border-blue-700"
                } ${
                  showFeedback
                    ? zoneStatus
                      ? "border-green-400 bg-green-50 dark:bg-green-900/20"
                      : "border-red-400 bg-red-50 dark:bg-red-900/20"
                    : ""
                }`}
              >
                <div className="flex items-center justify-between mb-3 text-sm font-bold text-gray-600 dark:text-gray-400">
                  <span>{zone.label}</span>
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
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed transition-colors dark:bg-blue-600 dark:hover:bg-blue-700 dark:disabled:bg-blue-300 dark:disabled:cursor-not-allowed"
            >
              <CheckCircle className="w-4 h-4" />
              Check Answer
            </button>
            <button
              onClick={resetAnswer}
              disabled={disabled}
              className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors dark:bg-gray-600 dark:hover:bg-gray-700 dark:disabled:bg-gray-300 dark:disabled:cursor-not-allowed"
            >
              <RotateCcw className="w-4 h-4" />
              Reset
            </button>
          </>
        ) : (
          <button
            onClick={resetAnswer}
            disabled={disabled}
            className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors dark:bg-gray-600 dark:hover:bg-gray-700 dark:disabled:bg-gray-300 dark:disabled:cursor-not-allowed"
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
              ? "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20"
              : "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20"
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
              <p className="text-sm text-gray-700 dark:text-gray-300">
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
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 dark:bg-gray-900 dark:border-gray-700">
          <h3 className="font-semibold text-lg mb-3 text-blue-900 dark:text-blue-400">
            Correct Answer
          </h3>
          <div className="space-y-3">
            {dragDropData.drop_zones.map((zone) => (
              <div
                key={zone.id}
                className="bg-white rounded-2xl p-3 dark:bg-gray-800 dark:border-gray-700"
              >
                <div className="font-medium text-sm mb-2">
                  {zone.label || zone.id}
                </div>
                <div className="flex flex-wrap gap-2">
                  {zone.correct_items.map((itemId) => {
                    const item = dragDropData.draggable_items.find(
                      (i) => i.id === itemId,
                    );
                    return (
                      <span
                        key={itemId}
                        className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm dark:bg-blue-900 dark:text-blue-400"
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
