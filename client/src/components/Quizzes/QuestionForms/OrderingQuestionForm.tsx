import React from "react";
import type { OrderingData } from "../../../types/quiz.types";

interface OrderingQuestionFormProps {
  data: OrderingData;
  onChange: (data: OrderingData) => void;
}

export const OrderingQuestionForm: React.FC<OrderingQuestionFormProps> = ({
  data,
  onChange,
}) => {
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
                  onChange({
                    ...data,
                    items: newItems,
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
                  onChange({
                    ...data,
                    items: newItems,
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
                    onChange({
                      ...data,
                      items: reorderedItems,
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
