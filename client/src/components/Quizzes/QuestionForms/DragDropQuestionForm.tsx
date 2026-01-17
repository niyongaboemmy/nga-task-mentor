import React, { useMemo } from "react";
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
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Background Image URL (Optional)
        </label>
        <input
          type="text"
          value={safeData.background_image}
          onChange={(e) =>
            updateData({ ...safeData, background_image: e.target.value })
          }
          placeholder="https://example.com/image.jpg"
          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-2xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Draggable Items Section */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Draggable Items
          </label>
          <div className="space-y-3">
            {safeData.draggable_items.map((item, index) => (
              <div
                key={index}
                className="p-4 border border-gray-200 dark:border-gray-600 rounded-2xl bg-gray-50 dark:bg-gray-800/50"
              >
                <div className="space-y-3">
                  <input
                    type="text"
                    value={item.id}
                    onChange={(e) => {
                      const newItems = [...safeData.draggable_items];
                      newItems[index] = { ...item, id: e.target.value };
                      updateData({ ...safeData, draggable_items: newItems });
                    }}
                    placeholder="ID (unique)"
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800"
                  />
                  <input
                    type="text"
                    value={item.text}
                    onChange={(e) => {
                      const newItems = [...safeData.draggable_items];
                      newItems[index] = { ...item, text: e.target.value };
                      updateData({ ...safeData, draggable_items: newItems });
                    }}
                    placeholder="Text content"
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800"
                  />
                  <input
                    type="text"
                    value={item.image || ""}
                    onChange={(e) => {
                      const newItems = [...safeData.draggable_items];
                      newItems[index] = { ...item, image: e.target.value };
                      updateData({ ...safeData, draggable_items: newItems });
                    }}
                    placeholder="Image URL (optional)"
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const newItems = safeData.draggable_items.filter(
                        (_, i) => i !== index
                      );
                      updateData({ ...safeData, draggable_items: newItems });
                    }}
                    className="text-red-600 text-xs font-medium hover:underline"
                  >
                    Remove Item
                  </button>
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
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-full"
            >
              + Add Item
            </button>
          </div>
        </div>

        {/* Drop Zones Section */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Drop Zones
          </label>
          <div className="space-y-3">
            {safeData.drop_zones.map((zone, index) => (
              <div
                key={index}
                className="p-4 border border-gray-200 dark:border-gray-600 rounded-2xl bg-gray-50 dark:bg-gray-800/50"
              >
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={zone.id}
                      onChange={(e) => {
                        const newZones = [...safeData.drop_zones];
                        newZones[index] = { ...zone, id: e.target.value };
                        updateData({ ...safeData, drop_zones: newZones });
                      }}
                      placeholder="Zone ID"
                      className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800"
                    />
                    <input
                      type="text"
                      value={zone.label || ""}
                      onChange={(e) => {
                        const newZones = [...safeData.drop_zones];
                        newZones[index] = { ...zone, label: e.target.value };
                        updateData({ ...safeData, drop_zones: newZones });
                      }}
                      placeholder="Label (optional)"
                      className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      placeholder="X"
                      value={zone.x}
                      onChange={(e) => {
                        const newZones = [...safeData.drop_zones];
                        newZones[index] = {
                          ...zone,
                          x: parseInt(e.target.value) || 0,
                        };
                        updateData({ ...safeData, drop_zones: newZones });
                      }}
                      className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
                    />
                    <input
                      type="number"
                      placeholder="Y"
                      value={zone.y}
                      onChange={(e) => {
                        const newZones = [...safeData.drop_zones];
                        newZones[index] = {
                          ...zone,
                          y: parseInt(e.target.value) || 0,
                        };
                        updateData({ ...safeData, drop_zones: newZones });
                      }}
                      className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
                    />
                    <input
                      type="number"
                      placeholder="Width"
                      value={zone.width}
                      onChange={(e) => {
                        const newZones = [...safeData.drop_zones];
                        newZones[index] = {
                          ...zone,
                          width: parseInt(e.target.value) || 100,
                        };
                        updateData({ ...safeData, drop_zones: newZones });
                      }}
                      className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
                    />
                    <input
                      type="number"
                      placeholder="Height"
                      value={zone.height}
                      onChange={(e) => {
                        const newZones = [...safeData.drop_zones];
                        newZones[index] = {
                          ...zone,
                          height: parseInt(e.target.value) || 100,
                        };
                        updateData({ ...safeData, drop_zones: newZones });
                      }}
                      className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                      Correct Items
                    </label>
                    <div className="flex flex-wrap gap-2">
                       {safeData.draggable_items.length === 0 && (
                          <span className="text-xs text-gray-400 italic">No items available</span>
                       )}
                       {safeData.draggable_items.map(item => (
                         <label key={item.id} className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600">
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
                             className="rounded border-gray-300 text-blue-600"
                           />
                           {item.text || item.id}
                         </label>
                       ))}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const newZones = safeData.drop_zones.filter(
                        (_, i) => i !== index
                      );
                      updateData({ ...safeData, drop_zones: newZones });
                    }}
                    className="text-red-600 text-xs font-medium hover:underline"
                  >
                    Remove Zone
                  </button>
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
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-full"
            >
              + Add Zone
            </button>
          </div>
        </div>
      </div>

      {errors.length > 0 && (
        <div className="p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-2xl">
           <h4 className="text-sm font-medium text-red-800 dark:text-red-300 mb-2">Validation Errors</h4>
           <ul className="list-disc list-inside text-sm text-red-600 dark:text-red-400">
             {errors.map((err, i) => (
               <li key={i}>{err}</li>
             ))}
           </ul>
        </div>
      )}
    </div>
  );
};
