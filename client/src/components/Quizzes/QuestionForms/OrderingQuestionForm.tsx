import React, { useMemo } from "react";
import { 
  ListOrdered, 
  Trash2, 
  Plus, 
  AlertCircle, 
  HelpCircle,
  ArrowDownUp,
  Percent,
  GripVertical,
  Type
} from "lucide-react";
import type { OrderingData } from "../../../types/quiz.types";

interface OrderingQuestionFormProps {
  data: OrderingData & { correct_answer?: Array<{ id: string; order: number }> };
  onChange: (data: OrderingData & { correct_answer?: Array<{ id: string; order: number }> }) => void;
}

export const OrderingQuestionForm: React.FC<OrderingQuestionFormProps> = ({
  data,
  onChange,
}) => {
  // Validation - memoize for performance
  const errors = useMemo(() => {
    const errs: string[] = [];
    const orders = data.items.map((item: typeof data.items[number]) => item.order);

    if (data.items.length === 0) {
      errs.push("At least one item is required");
    }
    
    const hasEmptyText = data.items.some((item: { text: string }) => !item.text.trim());
    if (hasEmptyText) {
      errs.push("All items must have text");
    }

    const hasValidOrders = data.items.every((item: { order: number }) => item.order >= 1 && item.order <= data.items.length);
    if (!hasValidOrders && data.items.length > 0) {
      errs.push(`Order numbers must be between 1 and ${data.items.length}`);
    }

    const hasNoDuplicates = new Set(orders).size === orders.length;
    if (!hasNoDuplicates) {
      errs.push("Order numbers must be unique");
    }

    return errs;
  }, [data.items]);

  const updateData = (newData: OrderingData & { correct_answer?: Array<{ id: string; order: number }> }) => {
    // Determine validity for correct_answer inclusion
    const items = newData.items || [];
    const orders = items.map(i => i.order);
    
    const hasItems = items.length > 0;
    const allTextFilled = items.every(i => !!i.text.trim());
    const validOrderRange = items.every(i => i.order >= 1 && i.order <= items.length);
    const noDuplicateOrders = new Set(orders).size === orders.length;
    
    const isValid = hasItems && allTextFilled && validOrderRange && noDuplicateOrders;

    onChange({
      ...newData,
      correct_answer: isValid ? items.map(i => ({ id: i.id, order: i.order })) : undefined
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6 pb-6 border-b border-gray-100 dark:border-gray-700">
        <div className="p-3 bg-emerald-50 dark:bg-emerald-900/30 rounded-lg">
          <ListOrdered className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
             Ordering Sequence
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
             Set up items that must be arranged in a specific sequence.
          </p>
        </div>
      </div>

      {/* Items List Card */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <ArrowDownUp className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <h4 className="font-semibold text-gray-900 dark:text-white">
              Items to Order
            </h4>
          </div>
          <span className="text-xs font-medium px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-gray-600 dark:text-gray-300">
             {data.items.length} Sequence Steps
          </span>
        </div>

        <div className="space-y-3">
          {data.items.map((item, index) => (
            <div 
              key={item.id} 
              className="flex items-center gap-3 p-3 bg-gray-50/50 dark:bg-gray-900/10 rounded-xl border border-gray-100 dark:border-gray-700 group hover:border-emerald-200 dark:hover:border-emerald-900/50 transition-all"
            >
              <div className="text-gray-400 dark:text-gray-600 cursor-grab active:cursor-grabbing">
                 <GripVertical className="w-4 h-4" />
              </div>

              <div className="flex-1 flex items-center gap-3">
                <div className="relative flex-1">
                   <Type className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                   <input
                    type="text"
                    value={item.text}
                    onChange={(e) => {
                      const newItems = [...data.items];
                      newItems[index] = { ...item, text: e.target.value };
                      updateData({ ...data, items: newItems });
                    }}
                    placeholder={`Step ${index + 1} text...`}
                    className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm">
                   <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Pos</span>
                   <input
                    type="number"
                    value={item.order}
                    onChange={(e) => {
                      const newItems = [...data.items];
                      newItems[index] = { ...item, order: parseInt(e.target.value) || 0 };
                      updateData({ ...data, items: newItems });
                    }}
                    min="1"
                    className="w-10 text-center font-bold text-emerald-600 dark:text-emerald-400 bg-transparent focus:outline-none text-sm"
                  />
                </div>
              </div>

              {data.items.length > 2 && (
                <button
                  type="button"
                  onClick={() => {
                    const newItems = data.items.filter((_: any, i: number) => i !== index);
                    const reordered = newItems.map((it: { id: string; text: string; order: number; image?: string }, i: number) => ({ ...it, order: i + 1 }));
                    updateData({ ...data, items: reordered });
                  }}
                  className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}

          <button
            type="button"
            onClick={() => {
              const newId = Date.now().toString();
              const newOrder = data.items.length + 1;
              updateData({
                ...data,
                items: [...data.items, { id: newId, text: "", order: newOrder }]
              });
            }}
            className="w-full py-3 border-2 border-dashed border-gray-100 dark:border-gray-800 rounded-xl text-gray-500 hover:border-emerald-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/10 transition-all flex items-center justify-center gap-2 mt-4 text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            Add Sequence Step
          </button>
        </div>
      </div>

      {/* Settings Card */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Percent className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          <h4 className="font-semibold text-gray-900 dark:text-white">
            Scoring Settings
          </h4>
        </div>
        
        <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-700">
           <div className="flex items-center gap-3">
             <div className={`p-2 rounded-lg ${data.allow_partial_credit ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-200 text-gray-500'}`}>
                <HelpCircle className="w-5 h-5" />
             </div>
             <div>
               <p className="text-sm font-medium text-gray-900 dark:text-white">Allow Partial Credit</p>
               <p className="text-xs text-gray-500 dark:text-gray-400">Award points for partially correct sequences</p>
             </div>
           </div>
           
           <button
             type="button"
             onClick={() => updateData({ ...data, allow_partial_credit: !data.allow_partial_credit })}
             className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ring-1 ring-inset ring-gray-900/5 ${
               data.allow_partial_credit ? "bg-emerald-500" : "bg-gray-200 dark:bg-gray-700"
             }`}
           >
             <span
               className={`${
                 data.allow_partial_credit ? "translate-x-6" : "translate-x-1"
               } inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
             />
           </button>
        </div>
      </div>

      {/* Errors */}
      {errors.length > 0 && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-start gap-3">
           <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5" />
           <div>
             <h4 className="text-sm font-semibold text-red-900 dark:text-red-200 mb-1">
               Sequence Errors
             </h4>
             <ul className="text-sm text-red-700 dark:text-red-300 space-y-1 list-disc list-inside">
               {errors.map((err: string, i: number) => (
                 <li key={i}>{err}</li>
               ))}
             </ul>
           </div>
        </div>
      )}
    </div>
  );
};
