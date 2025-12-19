
import React from 'react';
import { SpecItem, Language } from '../types';
import { Trash2, GripVertical, ChevronLeft, ChevronRight } from 'lucide-react';
import { THEME_STYLES } from '../utils/colorUtils';

interface SpecCardProps {
  spec: SpecItem;
  index: number; // 0-based index for logic, display as index+1
  language: Language;
  isActive: boolean;
  onDelete: (id: string) => void;
  onChange: (id: string, content: string) => void;
  onTitleChange: (id: string, title: string) => void;
  onNumberChange: (id: string, number: number) => void;
  onFocus: () => void;
  // Drag props
  dragHandleProps?: any;
  draggableProps?: any;
  innerRef?: any;
  // New props for manual pagination
  showNextButton?: boolean;
  showPrevButton?: boolean;
  onMoveToNext?: () => void;
  onMoveToPrev?: () => void;
}

// URL을 하이퍼링크로 변환하는 헬퍼 함수
const renderTextWithLinks = (text: string) => {
  if (!text) return null;
  
  // URL 패턴 정규식 (http, https, www로 시작하는 URL)
  const urlPattern = /(https?:\/\/[^\s]+)|(www\.[^\s]+)/g;
  
  const parts = text.split(urlPattern);
  
  return parts.map((part, index) => {
    if (!part) return null;
    
    // URL인지 확인
    if (part.match(/^https?:\/\//) || part.match(/^www\./)) {
      const href = part.startsWith('www.') ? `https://${part}` : part;
      return (
        <a
          key={index}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-500 hover:text-blue-700 underline break-all"
          onClick={(e) => e.stopPropagation()}
        >
          {part}
        </a>
      );
    }
    
    return <span key={index}>{part}</span>;
  });
};

export const SpecCard: React.FC<SpecCardProps> = ({
  spec,
  index,
  language,
  isActive,
  onDelete,
  onChange,
  onTitleChange,
  onNumberChange,
  onFocus,
  dragHandleProps,
  draggableProps,
  innerRef,
  showNextButton,
  showPrevButton,
  onMoveToNext,
  onMoveToPrev
}) => {
  // Auto-resize textarea ref
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const [isEditing, setIsEditing] = React.useState(false);

  React.useLayoutEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [spec.content[language]]);

  const content = spec.content[language] || '';

  return (
    <div
      className={`group relative rounded-lg border-2 transition-all duration-200 ${isActive
        ? 'border-orange-400 bg-white shadow-md'
        : 'border-gray-200 bg-white shadow-sm hover:shadow-md'
        }`}
      onClick={onFocus}
    >
      {/* Header - Compact */}
      <div className="flex items-center justify-between px-2 py-1.5 border-b border-gray-100">
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <div className="cursor-grab text-gray-300 hover:text-orange-500 active:cursor-grabbing flex-shrink-0">
            <GripVertical size={16} />
          </div>

          <input
            type="number"
            className="flex-shrink-0 w-6 h-6 rounded-md bg-[#c6613f] text-white text-xs font-bold shadow-sm text-center focus:outline-none focus:ring-1 focus:ring-orange-400 border-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            value={index + 1}
            onChange={(e) => {
              const val = parseInt(e.target.value);
              if (!isNaN(val)) onNumberChange(spec.id, val);
            }}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          />

          {/* Editable Title Input */}
          <input
            type="text"
            className="text-xs font-medium text-gray-700 bg-transparent border-none focus:ring-0 focus:outline-none w-full truncate placeholder-gray-300"
            value={spec.title || ''}
            placeholder={spec.targetSelector.split('>').pop() || 'Element'}
            onChange={(e) => onTitleChange(spec.id, e.target.value)}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          />
        </div>

        <div className="flex items-center gap-1">
          {/* Prev Button - Only show on first card of page if not page 1 */}
          {showPrevButton && onMoveToPrev && (
            <button
              onClick={(e) => { e.stopPropagation(); onMoveToPrev(); }}
              className="text-gray-400 hover:text-orange-500 transition-colors p-1 rounded-md hover:bg-orange-50 flex-shrink-0"
              title="Move to previous page"
            >
              <ChevronLeft size={14} />
            </button>
          )}

          {/* Language Badge */}
          <span className="text-[10px] text-orange-400 font-bold px-1.5 py-0.5" style={{ minWidth: '24px', textAlign: 'center' }}>
            {language.toUpperCase()}
          </span>

          {/* Delete Button */}
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(spec.id); }}
            className="text-gray-300 hover:text-red-500 transition-colors p-1 rounded-md hover:bg-red-50 flex-shrink-0"
          >
            <Trash2 size={14} />
          </button>

          {/* Next Button - Show on last card of page (always) */}
          {showNextButton && onMoveToNext && (
            <button
              onClick={(e) => { e.stopPropagation(); onMoveToNext(); }}
              className="text-gray-400 hover:text-orange-500 transition-colors p-1 rounded-md hover:bg-orange-50 flex-shrink-0"
              title="Move to next page"
            >
              <ChevronRight size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Body - Compact with URL detection */}
      <div className="px-1.5 pb-0.5">
        {isEditing ? (
          <textarea
            ref={textareaRef}
            className="w-full text-sm text-slate-700 bg-white border border-gray-200 rounded-md p-2 focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400 resize-none overflow-hidden"
            placeholder={language === 'ko' ? "내용을 입력하세요..." : "Enter description..."}
            value={content}
            onChange={(e) => onChange(spec.id, e.target.value)}
            onBlur={() => setIsEditing(false)}
            autoFocus
            rows={1}
            style={{ minHeight: '60px' }}
          />
        ) : (
          <div
            className="w-full text-sm text-slate-700 bg-white border border-gray-200 rounded-md p-2 cursor-text whitespace-pre-wrap break-words"
            style={{ minHeight: '60px' }}
            onClick={(e) => {
              e.stopPropagation();
              setIsEditing(true);
            }}
          >
            {content ? (
              renderTextWithLinks(content)
            ) : (
              <span className="text-gray-400">
                {language === 'ko' ? "내용을 입력하세요..." : "Enter description..."}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
