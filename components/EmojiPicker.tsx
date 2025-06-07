import React, { useState, useEffect, useRef } from 'react';
import { Point } from '../types';

interface EmojiPickerProps {
  isOpen: boolean;
  position: { x: number, y: number };
  onClose: () => void;
  onSelect: (emoji: string) => void;
}

// Популярные эмодзи для использования на доске Go
const popularEmojis = [
  '😀', '😁', '😂', '🤣', '😃', '😄', '😅', '😆',
  '😉', '😊', '😋', '😎', '😍', '🥰', '😘', '😗',
  '🥹', '😏', '😮', '😲', '😳', '🥺', '😢', '😭',
  '😱', '😖', '😡', '🤬', '💀', '👍', '👎', '👌',
  '🔥', '💥', '⭐', '💫', '🌟', '💢', '❓', '❗',
  '‼️', '⁉️', '👀', '🧠', '🤔', '🤨', '🧐', '🤦',
];

// Эмодзи, которые часто используются в игре Го
const goEmojis = [
  '🔴', '⚪', '⚫', '◻️', '◼️', '◽', '◾', '▫️', 
  '▪️', '🔺', '🔻', '🔷', '🔶', '🔸', '🔹', '🟢',
  '🟠', '🟣', '🟤', '🟥', '🟧', '🟨', '🟩', '🟦',
  '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '✅', '❌', '➕',
];

const EmojiPicker: React.FC<EmojiPickerProps> = ({ isOpen, position, onClose, onSelect }) => {
  const pickerRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<'popular' | 'go'>('popular');
  
  // Закрытие пикера при клике вне его
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div 
      ref={pickerRef}
      style={{
        position: 'absolute',
        left: `${position.x}px`,
        top: `${position.y}px`,
        transform: 'translate(-50%, -50%)',
        zIndex: 1000,
      }}
      className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-3 border border-gray-300 dark:border-gray-600"
    >
      <div className="flex justify-between items-center mb-2 border-b pb-2 dark:border-gray-700">
        <div className="flex space-x-2">
          <button
            className={`px-2 py-1 rounded text-sm ${activeTab === 'popular' ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200'}`}
            onClick={() => setActiveTab('popular')}
          >
            Популярные
          </button>
          <button
            className={`px-2 py-1 rounded text-sm ${activeTab === 'go' ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200'}`}
            onClick={() => setActiveTab('go')}
          >
            Фигуры
          </button>
        </div>
        <button 
          onClick={onClose}
          className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          aria-label="Close"
        >
          ✕
        </button>
      </div>
      
      <div className="grid grid-cols-8 gap-1">
        {(activeTab === 'popular' ? popularEmojis : goEmojis).map((emoji, index) => (
          <button
            key={index}
            onClick={() => onSelect(emoji)}
            className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 rounded cursor-pointer text-xl"
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
};

export default EmojiPicker; 