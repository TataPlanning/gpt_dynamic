
import React from 'react';
import { Language } from '../types';
import { Languages, Download, Upload, FileJson } from 'lucide-react';
import { THEME_STYLES } from '../utils/colorUtils';

interface TopBarProps {
  language: Language;
  onLanguageChange: (lang: Language) => void;
  onExportHTML: () => void;
  onExportJSON: () => void;
  onImportJSON: (file: File) => void;
  onReset: () => void;
  hasFile: boolean;
}

export const TopBar: React.FC<TopBarProps> = ({
  language,
  onLanguageChange,
  onExportHTML,
  onExportJSON,
  onImportJSON,
  onReset,
  hasFile
}) => {
  const handleJsonUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onImportJSON(e.target.files[0]);
    }
  };

  return (
    <div className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 shadow-sm z-10 relative">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center text-white font-bold text-lg">
          S
        </div>
        <h1 className="text-lg font-bold text-slate-800">Dynamic Storyboard Authoring Tool</h1>
      </div>

      <div className="flex items-center gap-3">
        <div className={`flex items-center rounded-full p-1 border ${THEME_STYLES.gray} bg-white`}>
          <button
            onClick={() => onLanguageChange('ko')}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${language === 'ko' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500 hover:bg-gray-100'}`}
          >
            KO
          </button>
          <button
            onClick={() => onLanguageChange('en')}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${language === 'en' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500 hover:bg-gray-100'}`}
          >
            EN
          </button>
        </div>

        <div className="h-6 w-px bg-gray-300 mx-1"></div>

        <button
          onClick={onReset}
          disabled={!hasFile}
          className={`px-3 py-1.5 rounded-lg border border-gray-200 text-red-500 text-sm hover:bg-red-50 hover:border-red-200 transition-colors ${!hasFile ? 'opacity-50 pointer-events-none' : ''} font-medium`}
        >
          Reset All
        </button>

        <label className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 text-sm hover:bg-gray-50 cursor-pointer transition-colors ${!hasFile ? 'opacity-50 pointer-events-none' : ''}`}>
          <Upload size={14} />
          <span>Import JSON</span>
          <input type="file" accept=".json" onChange={handleJsonUpload} className="hidden" disabled={!hasFile} />
        </label>

        <button
          onClick={onExportJSON}
          disabled={!hasFile}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 text-sm hover:bg-gray-50 transition-colors ${!hasFile ? 'opacity-50 pointer-events-none' : ''}`}
        >
          <FileJson size={14} />
          <span>Export JSON</span>
        </button>

        <button
          onClick={onExportHTML}
          disabled={!hasFile}
          className={`flex items-center gap-2 px-4 py-1.5 rounded-lg bg-[#c6613f] text-white text-sm font-medium hover:opacity-90 shadow-sm transition-all ${!hasFile ? 'opacity-50 pointer-events-none' : ''}`}
        >
          <Download size={14} />
          <span>Save HTML</span>
        </button>
      </div>
    </div>
  );
};
