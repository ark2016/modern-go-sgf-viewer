import React, { useRef } from 'react';

interface ControlsProps {
  onSgfLoad: (sgfText: string, fileName: string) => void;
  currentMove: number; 
  totalMoves: number;  
  onNavigate: (targetMove: number | 'first' | 'prev' | 'next' | 'last' | string) => void; 
  fileName: string | null;
  isEditMode: boolean;
  onToggleEditMode: () => void;
  onDownloadSgf: () => void;
  canDownload: boolean;
}

const Controls: React.FC<ControlsProps> = ({
  onSgfLoad,
  currentMove, 
  totalMoves,  
  onNavigate,
  fileName,
  isEditMode,
  onToggleEditMode,
  onDownloadSgf,
  canDownload,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        onSgfLoad(text, file.name);
        if (fileInputRef.current) {
            fileInputRef.current.value = ""; 
        }
      };
      reader.readAsText(file);
    }
  };

  const buttonClass = "px-3 py-2 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors dark:bg-blue-600 dark:hover:bg-blue-700 dark:disabled:bg-gray-600";
  const secondaryButtonClass = "w-full px-4 py-2 rounded font-semibold transition-colors bg-indigo-500 hover:bg-indigo-600 text-white dark:bg-indigo-600 dark:hover:bg-indigo-700 disabled:bg-gray-400 dark:disabled:bg-gray-600";
  const toggleButtonClass = `w-full px-4 py-2 rounded font-semibold transition-colors ${
    isEditMode 
      ? 'bg-red-500 hover:bg-red-600 text-white dark:bg-red-600 dark:hover:bg-red-700' 
      : 'bg-green-500 hover:bg-green-600 text-white dark:bg-green-600 dark:hover:bg-green-700'
  }`;


  return (
    <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow space-y-4">
      <div>
        <label htmlFor="sgfFile" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Load SGF File:
        </label>
        <input
          id="sgfFile"
          type="file"
          ref={fileInputRef}
          accept=".sgf, .SGF"
          onChange={handleFileChange}
          className="block w-full text-sm text-gray-500 dark:text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-900 dark:file:text-blue-300 dark:hover:file:bg-blue-800 cursor-pointer"
          aria-label="Load SGF File"
          disabled={isEditMode} 
        />
        {fileName && <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Loaded: {fileName}</p>}
      </div>

      <div className="space-y-2">
        <button onClick={onToggleEditMode} className={toggleButtonClass} aria-pressed={isEditMode}>
          {isEditMode ? 'Exit Edit Mode (F2)' : 'Enter Edit Mode (F2)'}
        </button>
        <button 
            onClick={onDownloadSgf} 
            className={secondaryButtonClass} 
            disabled={!canDownload}
            aria-label="Download SGF file"
        >
          Download SGF
        </button>
      </div>


      {totalMoves > 0 && (
        <div className="space-y-2"> 
          <p className="text-center font-medium dark:text-gray-200" aria-live="polite">
            Move: {currentMove < 0 ? 'Initial' : currentMove + 1} / {totalMoves}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <button onClick={() => onNavigate('first')} disabled={currentMove < 0 && totalMoves > 0} className={buttonClass} aria-label="Go to first move">
              &laquo; First
            </button>
            <button onClick={() => onNavigate('prev')} disabled={currentMove < 0} className={buttonClass} aria-label="Go to previous move">
              &lsaquo; Prev
            </button>
            <button onClick={() => onNavigate('next')} disabled={currentMove >= totalMoves - 1} className={buttonClass} aria-label="Go to next move">
              Next &rsaquo;
            </button>
            <button onClick={() => onNavigate('last')} disabled={currentMove === totalMoves - 1 || totalMoves === 0} className={buttonClass} aria-label="Go to last move">
              Last &raquo;
            </button>
          </div>
           <label htmlFor="moveSlider" className="sr-only">Move Slider</label>
           <input
            id="moveSlider"
            type="range"
            min="-1" 
            max={totalMoves - 1} 
            value={currentMove}
            onChange={(e) => onNavigate(parseInt(e.target.value))} 
            className="w-full h-3 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 accent-blue-500"
            aria-label="Move navigation slider"
          />
          <p className="text-xs text-gray-600 dark:text-gray-400 text-center mt-1">
            Используйте клавиши ← → для перехода к предыдущему/следующему ходу,<br />
            ↑ ↓ для перехода к первому/последнему ходу
          </p>
        </div>
      )}
    </div>
  );
};

export default Controls;