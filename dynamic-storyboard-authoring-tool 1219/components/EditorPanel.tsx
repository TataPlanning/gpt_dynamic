
import React from 'react';
import { SpecItem, Language } from '../types';
import { SpecCard } from './SpecCard';
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface EditorPanelProps {
  specs: SpecItem[];
  language: Language;
  activeSpecId: string | null;
  onReorder: (specs: SpecItem[]) => void;
  onUpdateSpec: (id: string, content: string) => void;
  onUpdateTitle: (id: string, title: string) => void;
  onUpdateNumber: (id: string, newNumber: number) => void;
  onDeleteSpec: (id: string) => void;
  onSetActiveSpec: (id: string) => void;
  currentPage: number;
  onPageChange: (page: number) => void;
  onMoveToNextPage: (id: string) => void;
  onMoveToPrevPage: (id: string) => void;
  activePageId: string;  // 현재 iframe 내부 페이지 ID
}

export const EditorPanel: React.FC<EditorPanelProps> = ({
  specs,
  language,
  activeSpecId,
  onReorder,
  onUpdateSpec,
  onUpdateTitle,
  onUpdateNumber,
  onDeleteSpec,
  onSetActiveSpec,
  currentPage,
  onPageChange,
  onMoveToNextPage,
  onMoveToPrevPage,
  activePageId
}) => {
  // 1단계: 현재 activePageId에 해당하는 specs만 필터링
  const specsForCurrentPageId = specs.filter(s => (s.pageId || 'default') === activePageId);
  
  // 2단계: 그 중에서 현재 pageNumber에 해당하는 것만 필터링
  const currentSpecs = specsForCurrentPageId.filter(s => (s.pageNumber || 1) === currentPage);

  // 현재 pageId 내에서의 totalPages 계산
  const totalPages = specsForCurrentPageId.length > 0
    ? Math.max(...specsForCurrentPageId.map(s => s.pageNumber || 1))
    : 1;

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    // 현재 페이지의 specs만 대상
    const sourceId = currentSpecs[result.source.index]?.id;
    const destId = currentSpecs[result.destination.index]?.id;

    if (!sourceId || !destId) return;

    // Find global indices
    const sourceGlobalIndex = specs.findIndex(s => s.id === sourceId);
    const destGlobalIndex = specs.findIndex(s => s.id === destId);

    const newSpecs = Array.from(specs);
    const [moved] = newSpecs.splice(sourceGlobalIndex, 1);
    newSpecs.splice(destGlobalIndex, 0, moved);

    // Re-sort by pageId, then pageNumber, then re-assign sequential numbers
    const sorted = newSpecs.sort((a, b) => {
      const pageIdA = a.pageId || 'default';
      const pageIdB = b.pageId || 'default';
      if (pageIdA !== pageIdB) return pageIdA.localeCompare(pageIdB);
      return (a.pageNumber || 1) - (b.pageNumber || 1);
    });
    const reordered = sorted.map((s, i) => ({ ...s, number: i + 1 }));
    onReorder(reordered);
  };

  // Auto-scroll to active spec card
  React.useEffect(() => {
    if (activeSpecId) {
      const el = document.getElementById(`spec-card-${activeSpecId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [activeSpecId, currentPage]);

  return (
    <div className="w-[400px] bg-gray-50 border-l border-gray-200 flex flex-col h-full shadow-xl z-20">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-white">
        <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
          <span className="flex items-center justify-center w-6 h-6 rounded-md bg-orange-100 text-orange-600 text-xs">
            {specsForCurrentPageId.length}
          </span>
          Specifications
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        {specsForCurrentPageId.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-400 text-sm">
            <p>No specs added yet.</p>
            <p className="text-xs mt-2">Ctrl + Click on the viewer to add one.</p>
          </div>
        ) : currentSpecs.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-400 text-sm">
            <p>No specs on this page.</p>
            <button 
              onClick={() => onPageChange(1)}
              className="text-orange-500 hover:underline mt-2"
            >
              Go to Page 1
            </button>
          </div>
        ) : (
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="specs-list">
              {(provided) => (
                <div {...provided.droppableProps} ref={provided.innerRef}>
                  {currentSpecs.map((spec, i) => {
                    // Determine if this is first or last card on current page
                    const isFirstCard = i === 0;
                    const isLastCard = i === currentSpecs.length - 1;
                    const showPrevButton = isFirstCard && currentPage > 1;
                    const showNextButton = isLastCard; // Always show on last card

                    // 현재 pageId 내에서의 인덱스 계산
                    const indexInPageId = specsForCurrentPageId.findIndex(s => s.id === spec.id);

                    return (
                      <Draggable key={spec.id} draggableId={spec.id} index={i}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            id={`spec-card-${spec.id}`}
                            style={{ ...provided.draggableProps.style, marginBottom: '8px' }}
                          >
                            <SpecCard
                              spec={spec}
                              index={indexInPageId}
                              language={language}
                              isActive={activeSpecId === spec.id}
                              onDelete={onDeleteSpec}
                              onChange={onUpdateSpec}
                              onTitleChange={onUpdateTitle}
                              onNumberChange={onUpdateNumber}
                              onFocus={() => onSetActiveSpec(spec.id)}
                              showPrevButton={showPrevButton}
                              showNextButton={showNextButton}
                              onMoveToPrev={() => onMoveToPrevPage(spec.id)}
                              onMoveToNext={() => onMoveToNextPage(spec.id)}
                            />
                          </div>
                        )}
                      </Draggable>
                    );
                  })}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        )}
      </div>

      {/* Pagination - 현재 pageId 내에서의 페이지네이션 */}
      {totalPages > 1 && (
        <div className="p-4 bg-white border-t border-gray-200 flex items-center justify-center gap-4">
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="text-sm font-medium text-slate-600 hover:text-orange-500 disabled:opacity-30 disabled:hover:text-slate-600 disabled:cursor-not-allowed transition-colors"
          >
            &lt; Prev
          </button>

          <span className="text-xs font-semibold text-slate-600">
            Page {currentPage} of {totalPages}
          </span>

          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="text-sm font-medium text-slate-600 hover:text-orange-500 disabled:opacity-30 disabled:hover:text-slate-600 disabled:cursor-not-allowed transition-colors"
          >
            Next &gt;
          </button>
        </div>
      )}
    </div>
  );
};
