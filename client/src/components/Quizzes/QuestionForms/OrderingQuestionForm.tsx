import React from "react";
import type { OrderingData } from "../../../types/quiz.types";

interface OrderingQuestionFormProps {
  data: OrderingData & { correct_answer?: Array<{ id: string; order: number }> };
  onChange: (data: OrderingData & { correct_answer?: Array<{ id: string; order: number }> }) => void;
}

export const OrderingQuestionForm: React.FC<OrderingQuestionFormProps> = ({
  data,
  onChange,
}) => {
  // Validate ordering
  const orders = data.items.map(item => item.order);
  const hasValidOrders = data.items.length > 0 &&
    data.items.every(item => item.order >= 1 && item.order <= data.items.length);
  const hasNoDuplicates = new Set(orders).size === orders.length;
  const isValidCorrectAnswer = hasValidOrders && hasNoDuplicates;
  
  // Set correct_answer for payload - only if valid (the items with their correct order)
  const correct_answer = isValidCorrectAnswer 
    ? data.items.map(item => ({ id: item.id, order: item.order }))
    : undefined;

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          Items to Order
        </label>
        <div className="space-y-3">
          {data.items.map((item, index) => (
            <div key={item.id} className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 flex items-center justify-center text-xs font-bold flex-shrink-0">
                {index + 1}
              </span>
              <input
                type="text"
                value={item.text}
                onChange={(e) => {
                  const newItems = [...data.items];
                  newItems[index] = { ...item, text: e.target.value };
                  const newData = {
                    ...data,
                    items: newItems,
                  };
                  // Revalidate
                  const orders = newData.items.map(i => i.order);
                  const hasValid = newData.items.every(i => i.order >= 1 && i.order <= newData.items.length);
                  const noDupes = new Set(orders).size === orders.length;
                  const isValid = hasValid && noDupes && newData.items.length > 0;
                  onChange({
                    ...newData,
                    correct_answer: isValid ? newData.items.map(i => ({ id: i.id, order: i.order })) : undefined,
                  });
                }}
                placeholder={`Item ${index + 1}`}
                className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-2xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400 transition-colors duration-200"
                required
              />
              <input
                type="number"
                value={item.order}
                onChange={(e) => {
                  const newItems = [...data.items];
                  newItems[index] = {
                    ...item,
                    order: parseInt(e.target.value) || 0,
                  };
                  const newData = {
                    ...data,
                    items: newItems,
                  };
                  // Revalidate
                  const orders = newData.items.map(i => i.order);
                  const hasValid = newData.items.every(i => i.order >= 1 && i.order <= newData.items.length);
                  const noDupes = new Set(orders).size === orders.length;
                  const isValid = hasValid && noDupes && newData.items.length > 0;
                  onChange({
                    ...newData,
                    correct_answer: isValid ? newData.items.map(i => ({ id: i.id, order: i.order })) : undefined,
                  });
                }}
                placeholder="Order"
                min="1"
                className="w-20 px-3 py-3 border border-gray-300 dark:border-gray-600 rounded-2xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400 transition-colors duration-200 text-center"
                required
              />
              {data.items.length > 2 && (
                <button
                  type="button"
                  onClick={() => {
                    const newItems = data.items.filter((_, i) => i !== index);
                    // Reorder remaining items
                    const reorderedItems = newItems.map((item, i) => ({
                      ...item,
                      order: i + 1,
                    }));
                    const newData = {
                      ...data,
                      items: reorderedItems,
                    };
                    // Revalidate
                    const orders = newData.items.map(i => i.order);
                    const hasValid = newData.items.every(i => i.order >= 1 && i.order <= newData.items.length);
                    const noDupes = new Set(orders).size === orders.length;
                    const isValid = hasValid && noDupes && newData.items.length > 0;
                    onChange({
                      ...newData,
                      correct_answer: isValid ? newData.items.map(i => ({ id: i.id, order: i.order })) : undefined,
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
              const newId = (data.items.length + 1).toString();
              const newOrder = data.items.length + 1;
              const newItems = [
                ...data.items,
                { id: newId, text: "", order: newOrder },
              ];
              onChange({
                ...data,
                items: newItems,
              });
            }}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 dark:bg-purple-500 dark:hover:bg-purple-600 text-white text-sm font-medium rounded-full transition-colors duration-200"
          >
            + Add Item
          </button>
        </div>
      </div>
      {!isValidCorrectAnswer && data.items.length > 0 && (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">
          Please ensure all items have unique, valid order numbers (1 to {data.items.length}).
        </p>
      )}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          Partial Credit
        </label>
        <div className="flex items-center">
          <input
            type="checkbox"
            id="allow_partial_credit"
            checked={data.allow_partial_credit || false}
            onChange={(e) =>
              onChange({
                ...data,
                allow_partial_credit: e.target.checked,
              })
            }
            className="h-4 w-4 text-purple-600 bg-gray-100 border-gray-300 rounded focus:ring-purple-500 dark:focus:ring-purple-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
          />
          <label
            htmlFor="allow_partial_credit"
            className="ml-3 text-sm text-gray-700 dark:text-gray-300"
          >
            Allow partial credit for partially correct ordering
          </label>
        </div>
      </div>
    </div>
  );
};
