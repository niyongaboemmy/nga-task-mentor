import React, { useMemo } from "react";
import { 
  GripHorizontal, 
  MousePointer2, 
  Image as ImageIcon, 
  Plus, 
  Trash2, 
  AlertCircle, 
  CheckCircle,
  Move
} from "lucide-react";
import type { DragDropData } from "../../../types/quiz.types";

interface DragDropQuestionFormProps {
  data: DragDropData;
  onChange: (data: any) => void;
}

export const DragDropQuestionForm: React.FC<DragDropQuestionFormProps> = ({
  data,
  onChange,
}) => {
  // Ensure default data
  const safeData = {
    background_image: data.background_image || "",
    drop_zones: data.drop_zones || [],
    draggable_items: data.draggable_items || [],
  };

  // Validation Logic
  const errors = useMemo(() => {
    const errs: string[] = [];
    const zoneIds = new Set<string>();
    const itemIds = new Set<string>();

    // Duplicate ID checks
    safeData.drop_zones.forEach((z) => {
      if (zoneIds.has(z.id)) errs.push(`Duplicate Zone ID: ${z.id}`);
      zoneIds.add(z.id);
      if (z.x < 0 || z.y < 0 || z.width <= 0 || z.height <= 0) {
        errs.push(`Zone ${z.id || z.label} has invalid dimensions/position`);
      }
    });

    safeData.draggable_items.forEach((i) => {
      if (itemIds.has(i.id)) errs.push(`Duplicate Item ID: ${i.id}`);
      itemIds.add(i.id);
    });

    // Valid ref check
    safeData.drop_zones.forEach((z) => {
      z.correct_items.forEach((id) => {
        if (!itemIds.has(id)) {
          errs.push(`Zone ${z.id} references non-existent item: ${id}`);
        }
      });
    });

    return errs;
  }, [safeData]);

  // Construct correct_answer for payload
  const correct_answer = safeData.drop_zones.reduce((acc, zone) => {
    acc[zone.id] = zone.correct_items;
    return acc;
  }, {} as Record<string, string[]>);

  const updateData = (newData: DragDropData) => {
    // We pass the derived safeData + correct_answer to ensure payload completeness
    onChange({
      ...newData,
      correct_answer,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6 pb-6 border-b border-gray-100 dark:border-gray-700">
        <div className="p-3 bg-pink-50 dark:bg-pink-900/30 rounded-lg">
          <MousePointer2 className="w-6 h-6 text-pink-600 dark:text-pink-400" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
             Drag & Drop Setup
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Create interactive drag and drop exercises with custom drop zones.
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <ImageIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          <h4 className="font-semibold text-gray-900 dark:text-white">
            Background Image
          </h4>
        </div>
        <div className="flex gap-4">
          <div className="flex-1">
             <input
               type="text"
               value={safeData.background_image}
               onChange={(e) =>
                 updateData({ ...safeData, background_image: e.target.value })
               }
               placeholder="https://example.com/image.jpg"
               className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900/50 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-all text-sm"
             />
             <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
               Provide a clear background image for students to drop items onto.
             </p>
          </div>
          {safeData.background_image && (
            <div className="w-24 h-24 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 overflow-hidden relative group">
               <img 
                 src={safeData.background_image} 
                 alt="Preview" 
                 className="w-full h-full object-cover"
                 onError={(e) => (e.currentTarget.style.display = 'none')}
               />
               <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs">
                 Preview
               </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Draggable Items Section */}
        {/* Draggable Items Section */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <GripHorizontal className="w-5 h-5 text-blue-500 dark:text-blue-400" />
              <h4 className="font-semibold text-gray-900 dark:text-white">
                Draggable Items
              </h4>
            </div>
            <span className="text-xs font-medium px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-gray-600 dark:text-gray-300">
               {safeData.draggable_items.length} Items
            </span>
          </div>

          <div className="space-y-3">
            {safeData.draggable_items.map((item, index) => (
              <div
                key={index}
                className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800/50 hover:border-blue-300 dark:hover:border-blue-700 transition-all group"
              >
                <div className="space-y-3">
                  <div className="flex gap-2">
                     <div className="flex-1">
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                          ID (Must be unique)
                        </label>
                        <input
                          type="text"
                          value={item.id}
                          onChange={(e) => {
                            const newItems = [...safeData.draggable_items];
                            newItems[index] = { ...item, id: e.target.value };
                            updateData({ ...safeData, draggable_items: newItems });
                          }}
                          placeholder="item-1"
                          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 focus:ring-1 focus:ring-blue-500 outline-none"
                        />
                     </div>
                     <div className="flex-1">
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                          Display Text
                        </label>
                        <input
                          type="text"
                          value={item.text}
                          onChange={(e) => {
                            const newItems = [...safeData.draggable_items];
                            newItems[index] = { ...item, text: e.target.value };
                            updateData({ ...safeData, draggable_items: newItems });
                          }}
                          placeholder="Item Label"
                          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 focus:ring-1 focus:ring-blue-500 outline-none"
                        />
                     </div>
                  </div>

                  <div>
                     <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                       Image URL (Optional)
                     </label>
                     <div className="flex gap-2">
                       <input
                         type="text"
                         value={item.image || ""}
                         onChange={(e) => {
                           const newItems = [...safeData.draggable_items];
                           newItems[index] = { ...item, image: e.target.value };
                           updateData({ ...safeData, draggable_items: newItems });
                         }}
                         placeholder="https://..."
                         className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 focus:ring-1 focus:ring-blue-500 outline-none"
                       />
                       {/* Preview icon if image exists */}
                       {item.image && (
                         <div className="w-9 h-9 rounded border border-gray-200 dark:border-gray-700 overflow-hidden bg-gray-100 dark:bg-gray-900">
                            <img src={item.image} alt="" className="w-full h-full object-cover" onError={(e) => e.currentTarget.style.display = 'none'} />
                         </div>
                       )}
                     </div>
                  </div>

                  <div className="flex justify-end pt-2 border-t border-gray-200 dark:border-gray-700/50">
                    <button
                      type="button"
                      onClick={() => {
                        const newItems = safeData.draggable_items.filter(
                          (_, i) => i !== index
                        );
                        updateData({ ...safeData, draggable_items: newItems });
                      }}
                      className="text-gray-400 hover:text-red-500 text-xs font-medium flex items-center gap-1 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Remove
                    </button>
                  </div>
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={() => {
                const newId = `item-${Date.now()}`;
                updateData({
                  ...safeData,
                  draggable_items: [
                    ...safeData.draggable_items,
                    { id: newId, text: "", value: newId },
                  ],
                });
              }}
              className="w-full py-3 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-500 hover:border-blue-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all flex items-center justify-center gap-2 group"
            >
              <div className="p-1 rounded-full bg-gray-100 dark:bg-gray-700 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/50 transition-colors">
                 <Plus className="w-4 h-4" />
              </div>
              <span className="font-medium text-sm">Add Item</span>
            </button>
          </div>
        </div>

        {/* Drop Zones Section */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Move className="w-5 h-5 text-purple-500 dark:text-purple-400" />
              <h4 className="font-semibold text-gray-900 dark:text-white">
                Drop Zones
              </h4>
            </div>
            <span className="text-xs font-medium px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-gray-600 dark:text-gray-300">
               {safeData.drop_zones.length} Zones
            </span>
          </div>

          <div className="space-y-3">
            {safeData.drop_zones.map((zone, index) => (
              <div
                key={index}
                className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800/50 hover:border-purple-300 dark:hover:border-purple-700 transition-all group"
              >
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                         Zone ID
                      </label>
                      <input
                        type="text"
                        value={zone.id}
                        onChange={(e) => {
                          const newZones = [...safeData.drop_zones];
                          newZones[index] = { ...zone, id: e.target.value };
                          updateData({ ...safeData, drop_zones: newZones });
                        }}
                        placeholder="zone-1"
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 focus:ring-1 focus:ring-purple-500 outline-none"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                         Label
                      </label>
                      <input
                        type="text"
                        value={zone.label || ""}
                        onChange={(e) => {
                          const newZones = [...safeData.drop_zones];
                          newZones[index] = { ...zone, label: e.target.value };
                          updateData({ ...safeData, drop_zones: newZones });
                        }}
                        placeholder="Target Area"
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 focus:ring-1 focus:ring-purple-500 outline-none"
                      />
                    </div>
                  </div>

                  <div>
                     <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                        Coordinates & Dimensions (Percentage %)
                     </label>
                     <div className="grid grid-cols-4 gap-2">
                       <div className="relative">
                         <span className="absolute left-2 top-2 text-xs text-gray-400">X</span>
                         <input
                           type="number"
                           value={zone.x}
                           onChange={(e) => {
                             const newZones = [...safeData.drop_zones];
                             newZones[index] = { ...zone, x: parseInt(e.target.value) || 0 };
                             updateData({ ...safeData, drop_zones: newZones });
                           }}
                           className="w-full pl-5 pr-1 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 focus:ring-1 focus:ring-purple-500 outline-none"
                         />
                       </div>
                       <div className="relative">
                         <span className="absolute left-2 top-2 text-xs text-gray-400">Y</span>
                         <input
                           type="number"
                           value={zone.y}
                           onChange={(e) => {
                             const newZones = [...safeData.drop_zones];
                             newZones[index] = { ...zone, y: parseInt(e.target.value) || 0 };
                             updateData({ ...safeData, drop_zones: newZones });
                           }}
                           className="w-full pl-5 pr-1 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 focus:ring-1 focus:ring-purple-500 outline-none"
                         />
                       </div>
                       <div className="relative">
                         <span className="absolute left-2 top-2 text-xs text-gray-400">W</span>
                         <input
                           type="number"
                           value={zone.width}
                           onChange={(e) => {
                             const newZones = [...safeData.drop_zones];
                             newZones[index] = { ...zone, width: parseInt(e.target.value) || 100 };
                             updateData({ ...safeData, drop_zones: newZones });
                           }}
                           className="w-full pl-6 pr-1 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 focus:ring-1 focus:ring-purple-500 outline-none"
                         />
                       </div>
                       <div className="relative">
                         <span className="absolute left-2 top-2 text-xs text-gray-400">H</span>
                         <input
                           type="number"
                           value={zone.height}
                           onChange={(e) => {
                             const newZones = [...safeData.drop_zones];
                             newZones[index] = { ...zone, height: parseInt(e.target.value) || 100 };
                             updateData({ ...safeData, drop_zones: newZones });
                           }}
                           className="w-full pl-6 pr-1 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 focus:ring-1 focus:ring-purple-500 outline-none"
                         />
                       </div>
                     </div>
                  </div>

                  <div className="bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg border border-gray-100 dark:border-gray-700/50">
                    <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-2 flex items-center gap-1">
                      <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                      Correct Items (Select all that apply)
                    </label>
                    <div className="flex flex-wrap gap-2">
                       {safeData.draggable_items.length === 0 && (
                          <span className="text-xs text-gray-400 italic">Add draggable items first</span>
                       )}
                       {safeData.draggable_items.map(item => (
                         <label key={item.id} className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md cursor-pointer transition-colors border ${zone.correct_items.includes(item.id) ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'}`}>
                           <input
                             type="checkbox"
                             checked={zone.correct_items.includes(item.id)}
                             onChange={(e) => {
                               const newZones = [...safeData.drop_zones];
                               const currentCorrect = [...zone.correct_items];
                               if (e.target.checked) {
                                  newZones[index] = { ...zone, correct_items: [...currentCorrect, item.id] };
                               } else {
                                  newZones[index] = { ...zone, correct_items: currentCorrect.filter(id => id !== item.id) };
                               }
                               updateData({ ...safeData, drop_zones: newZones });
                             }}
                             className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                           />
                           <span className="truncate max-w-[100px]">{item.text || item.id}</span>
                         </label>
                       ))}
                    </div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        const newZones = safeData.drop_zones.filter(
                          (_, i) => i !== index
                        );
                        updateData({ ...safeData, drop_zones: newZones });
                      }}
                       className="text-gray-400 hover:text-red-500 text-xs font-medium flex items-center gap-1 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Remove Zone
                    </button>
                  </div>
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={() => {
                const newId = `zone-${Date.now()}`;
                updateData({
                  ...safeData,
                  drop_zones: [
                    ...safeData.drop_zones,
                    {
                      id: newId,
                      x: 0,
                      y: 0,
                      width: 100,
                      height: 100,
                      correct_items: [],
                    },
                  ],
                });
              }}
              className="w-full py-3 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-500 hover:border-purple-500 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all flex items-center justify-center gap-2 group"
            >
               <div className="p-1 rounded-full bg-gray-100 dark:bg-gray-700 group-hover:bg-purple-100 dark:group-hover:bg-purple-900/50 transition-colors">
                 <Plus className="w-4 h-4" />
              </div>
              <span className="font-medium text-sm">Add Drop Zone</span>
            </button>
          </div>
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
