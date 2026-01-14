import React from "react";
import type { DragDropData } from "../../../types/quiz.types";

interface DragDropQuestionFormProps {
  data: DragDropData;
  onChange: (data: DragDropData) => void;
}

export const DragDropQuestionForm: React.FC<DragDropQuestionFormProps> = ({
  data,
  onChange,
}) => {
  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-normal text-gray-700 mb-2 dark:text-gray-300">
          Background Image URL (Optional)
        </label>
        <input
          type="text"
          value={data.background_image || ""}
          onChange={(e) =>
            onChange({
              ...data,
              background_image: e.target.value,
            })
          }
          placeholder="https://example.com/image.jpg"
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 dark:bg-gray-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-normal text-gray-700 mb-2 dark:text-gray-300">
          Drop Zones
        </label>
        <div className="space-y-3">
          {data.drop_zones?.map((zone, index) => (
            <div
              key={zone.id}
              className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg"
            >
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">
                    X Position
                  </label>
                  <input
                    type="number"
                    value={zone.x || 0}
                    onChange={(e) => {
                      const newZones = [...(data.drop_zones || [])];
                      newZones[index] = {
                        ...zone,
                        x: parseInt(e.target.value),
                      };
                      onChange({
                        ...data,
                        drop_zones: newZones,
                      });
                    }}
                    className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-700 dark:bg-gray-800 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">
                    Y Position
                  </label>
                  <input
                    type="number"
                    value={zone.y || 0}
                    onChange={(e) => {
                      const newZones = [...(data.drop_zones || [])];
                      newZones[index] = {
                        ...zone,
                        y: parseInt(e.target.value),
                      };
                      onChange({
                        ...data,
                        drop_zones: newZones,
                      });
                    }}
                    className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-700 dark:bg-gray-800 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">
                    Width
                  </label>
                  <input
                    type="number"
                    value={zone.width || 100}
                    onChange={(e) => {
                      const newZones = [...(data.drop_zones || [])];
                      newZones[index] = {
                        ...zone,
                        width: parseInt(e.target.value),
                      };
                      onChange({
                        ...data,
                        drop_zones: newZones,
                      });
                    }}
                    className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-700 dark:bg-gray-800 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">
                    Height
                  </label>
                  <input
                    type="number"
                    value={zone.height || 100}
                    onChange={(e) => {
                      const newZones = [...(data.drop_zones || [])];
                      newZones[index] = {
                        ...zone,
                        height: parseInt(e.target.value),
                      };
                      onChange({
                        ...data,
                        drop_zones: newZones,
                      });
                    }}
                    className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-700 dark:bg-gray-800 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs text-gray-600 mb-1">
                    Label (Optional)
                  </label>
                  <input
                    type="text"
                    value={zone.label || ""}
                    onChange={(e) => {
                      const newZones = [...(data.drop_zones || [])];
                      newZones[index] = { ...zone, label: e.target.value };
                      onChange({
                        ...data,
                        drop_zones: newZones,
                      });
                    }}
                    placeholder="Zone label"
                    className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-700 dark:bg-gray-800 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-600 mb-1">
                  Correct Items (comma-separated IDs)
                </label>
                <input
                  type="text"
                  value={zone.correct_items?.join(", ") || ""}
                  onChange={(e) => {
                    const newZones = [...(data.drop_zones || [])];
                    newZones[index] = {
                      ...zone,
                      correct_items: e.target.value
                        .split(",")
                        .map((id) => id.trim())
                        .filter((id) => id),
                    };
                    onChange({
                      ...data,
                      drop_zones: newZones,
                    });
                  }}
                  placeholder="item1, item2, item3"
                  className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-700 dark:bg-gray-800 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {data.drop_zones && data.drop_zones.length > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    const newZones = (data.drop_zones || []).filter(
                      (_, i) => i !== index
                    );
                    onChange({
                      ...data,
                      drop_zones: newZones,
                    });
                  }}
                  className="mt-2 text-red-600 hover:text-red-800 text-sm"
                >
                  Remove Zone
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={() => {
              const newZones = [
                ...(data.drop_zones || []),
                {
                  id: `zone${(data.drop_zones?.length || 0) + 1}`,
                  x: 0,
                  y: 0,
                  width: 100,
                  height: 100,
                  correct_items: [],
                },
              ];
              onChange({
                ...data,
                drop_zones: newZones,
              });
            }}
            className="text-blue-600 hover:text-blue-800 text-sm"
          >
            + Add Drop Zone
          </button>
        </div>
      </div>

      <div>
        <label className="block text-sm font-normal text-gray-700 mb-2 dark:text-gray-300">
          Draggable Items
        </label>
        <div className="space-y-3">
          {data.draggable_items?.map((item, index) => (
            <div
              key={item.id}
              className="flex gap-3 items-center p-3 border border-gray-200 dark:border-gray-700 rounded-lg"
            >
              <div className="flex-1">
                <input
                  type="text"
                  value={item.text || ""}
                  onChange={(e) => {
                    const newItems = [...(data.draggable_items || [])];
                    newItems[index] = { ...item, text: e.target.value };
                    onChange({
                      ...data,
                      draggable_items: newItems,
                    });
                  }}
                  placeholder="Item text"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 dark:bg-gray-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex-1">
                <input
                  type="text"
                  value={item.value || ""}
                  onChange={(e) => {
                    const newItems = [...(data.draggable_items || [])];
                    newItems[index] = { ...item, value: e.target.value };
                    onChange({
                      ...data,
                      draggable_items: newItems,
                    });
                  }}
                  placeholder="Item value/ID"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 dark:bg-gray-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex-1">
                <input
                  type="text"
                  value={item.image || ""}
                  onChange={(e) => {
                    const newItems = [...(data.draggable_items || [])];
                    newItems[index] = { ...item, image: e.target.value };
                    onChange({
                      ...data,
                      draggable_items: newItems,
                    });
                  }}
                  placeholder="Image URL (optional)"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 dark:bg-gray-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              {data.draggable_items && data.draggable_items.length > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    const newItems = (data.draggable_items || []).filter(
                      (_, i) => i !== index
                    );
                    onChange({
                      ...data,
                      draggable_items: newItems,
                    });
                  }}
                  className="text-red-600 hover:text-red-800 p-2"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={() => {
              const newItems = [
                ...(data.draggable_items || []),
                {
                  id: `item${(data.draggable_items?.length || 0) + 1}`,
                  text: "",
                  value: "",
                },
              ];
              onChange({
                ...data,
                draggable_items: newItems,
              });
            }}
            className="text-blue-600 hover:text-blue-800 text-sm"
          >
            + Add Draggable Item
          </button>
        </div>
      </div>
    </div>
  );
};
