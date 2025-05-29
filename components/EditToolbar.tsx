
import React from 'react';
import { EditTool } from '../types';

interface EditToolbarProps {
  activeTool: EditTool | null;
  onToolSelect: (tool: EditTool | null) => void;
}

export const toolDisplayInfo: Record<string, { label: string; icon?: string, hotkey?: string }> = { // Added export
  [EditTool.VIEW_MODE]: { label: "View Mode" }, 
  [EditTool.EDIT_MODE_SELECT]: { label: "Select", icon: "☝️" },
  [EditTool.PLACE_BLACK]: { label: "Black", icon: "⚫" },
  [EditTool.PLACE_WHITE]: { label: "White", icon: "⚪" },
  [EditTool.REMOVE_STONE]: { label: "Erase", icon: "❌" },
  [EditTool.ADD_TRIANGLE]: { label: "Triangle", icon: "△", hotkey: "F4" },
  [EditTool.ADD_SQUARE]: { label: "Square", icon: "□", hotkey: "F5" },
  [EditTool.ADD_CIRCLE]: { label: "Circle", icon: "○", hotkey: "F6" },
  [EditTool.ADD_MARK_X]: { label: "Mark (X)", icon: "✕", hotkey: "F7" },
  [EditTool.ADD_LABEL]: { label: "Label (A/1)", icon: "Aa", hotkey: "F8" },
};


const EditToolbar: React.FC<EditToolbarProps> = ({ activeTool, onToolSelect }) => {
  const handleToolClick = (tool: EditTool) => {
    if (activeTool === tool) {
      onToolSelect(EditTool.EDIT_MODE_SELECT); 
    } else {
      onToolSelect(tool);
    }
  };
  
  const tools: EditTool[] = [
    EditTool.PLACE_BLACK, EditTool.PLACE_WHITE, EditTool.REMOVE_STONE,
    EditTool.ADD_TRIANGLE, EditTool.ADD_SQUARE, EditTool.ADD_CIRCLE,
    EditTool.ADD_MARK_X, EditTool.ADD_LABEL,
  ];

  return (
    <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow space-y-3">
      <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200 border-b pb-2 mb-2 dark:border-gray-700">
        Edit Tools (Active: {activeTool && toolDisplayInfo[activeTool] ? toolDisplayInfo[activeTool].label : "Select"})
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3 gap-2">
        {tools.map((toolKey) => {
          const toolInfo = toolDisplayInfo[toolKey];
          if (!toolInfo) return null;

          const isActive = activeTool === toolKey;
          return (
            <button
              key={toolKey}
              onClick={() => handleToolClick(toolKey)}
              title={`${toolInfo.label}${toolInfo.hotkey ? ` (${toolInfo.hotkey})` : ''}`}
              aria-pressed={isActive}
              className={`p-2 rounded-md flex flex-col items-center justify-center text-sm transition-colors
                          ${isActive 
                            ? 'bg-blue-500 text-white dark:bg-blue-600' 
                            : 'bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200'}
                          focus:outline-none focus:ring-2 focus:ring-blue-400`}
            >
              {toolInfo.icon && <span className="text-xl mb-1" role="img" aria-label={toolInfo.label}>{toolInfo.icon}</span>}
              <span>{toolInfo.label}</span>
              {toolInfo.hotkey && <span className="text-xs opacity-70">({toolInfo.hotkey})</span>}
            </button>
          );
        })}
      </div>
       <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
        Press F2 to exit Edit Mode. Default tool is "Select".
      </p>
    </div>
  );
};

export default EditToolbar;
