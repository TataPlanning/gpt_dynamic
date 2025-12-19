import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { TopBar } from './components/TopBar';
import { EditorPanel } from './components/EditorPanel';
import { Language, SpecItem } from './types';
import { generateExportHTML } from './utils/exportUtils';
import { generateUniqueSelector, findStableContainer } from './utils/domUtils';
import { UploadCloud, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';

const ITEMS_PER_PAGE = 5;

// --- Helper Functions for DOM Detection ---

/**
 * Detect the currently active page ID inside the iframe document.
 * Specifically looks for: section.page.active with id attribute
 */
const detectActivePageId = (doc: Document): string => {
  // Strategy 1: Look for section.page.active (이 HTML의 정확한 구조)
  const activePage = doc.querySelector('section.page.active');
  if (activePage && activePage.id) {
    return activePage.id; // 예: "page-newpromo", "page-basicpromo"
  }

  // Strategy 2: Fallback - 다른 active 패턴들
  const activeElement = doc.querySelector('.page.active, [data-page].active, .view.active, .screen.active');
  if (activeElement) {
    return activeElement.id || activeElement.getAttribute('data-page') || activeElement.className;
  }

  // Strategy 3: Check URL hash
  const win = doc.defaultView;
  if (win && win.location.hash) {
    return win.location.hash.slice(1);
  }

  // Strategy 4: Find the first visible section/page
  const pages = doc.querySelectorAll('.page, [data-page], .view, .screen, section[id]');
  for (const page of pages) {
    const style = win?.getComputedStyle(page as HTMLElement);
    if (style && style.display !== 'none' && style.visibility !== 'hidden') {
      return (page as HTMLElement).id || 'default';
    }
  }

  return 'default';
};

/**
 * Check if an element is truly visible (recursively checks parents).
 */
const isElementVisible = (element: Element | null): boolean => {
  if (!element) return false;

  const win = element.ownerDocument?.defaultView;
  if (!win) return false;

  let current: Element | null = element;
  while (current && current !== element.ownerDocument.body) {
    const style = win.getComputedStyle(current as HTMLElement);

    // Check for hidden states
    if (style.display === 'none') return false;
    if (style.visibility === 'hidden') return false;
    if (style.opacity === '0') return false;

    // Check for hidden attribute
    if ((current as HTMLElement).hidden) return false;

    current = current.parentElement;
  }

  return true;
};

// --- Internal Pin Component for Portal ---
interface PinProps {
  spec: SpecItem;
  index: number;
  isActive: boolean;
  onSelect: (id: string) => void;
  onDragEnd: (id: string, newOffsetX: number, newOffsetY: number) => void;
  iframeDoc: Document | null;
  domVersion: number;
  activePageId: string | null;
}

const DraggablePin: React.FC<PinProps> = ({
  spec,
  index,
  isActive,
  onSelect,
  onDragEnd,
  iframeDoc,
  domVersion,
  activePageId
}) => {
  const pinRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });

  // Smart visibility logic using useMemo
  const isVisible = useMemo(() => {
    // Check 1: If pin has a pageId and it doesn't match current activePageId
    if (spec.pageId && activePageId && spec.pageId !== activePageId) {
      return false;
    }

    // Check 2: Find target element and verify visibility
    if (iframeDoc && spec.targetSelector) {
      try {
        const targetElement = iframeDoc.querySelector(spec.targetSelector);
        if (targetElement) {
          // Check 3: Verify element (and its parents) is visible
          return isElementVisible(targetElement);
        }
      } catch {
        // Invalid selector, fall through to default visibility
      }
    }

    // Default: show pin if no specific checks fail
    return true;
  }, [iframeDoc, spec.targetSelector, spec.pageId, activePageId, domVersion]);

  // 타겟 요소 좌상단 기준 + 고정 오프셋으로 절대 위치 계산
  const pinPosition = useMemo(() => {
    if (!iframeDoc || !spec.targetSelector) {
      return { top: 0, left: 0 };
    }

    try {
      const targetElement = iframeDoc.querySelector(spec.targetSelector) as HTMLElement;
      if (!targetElement) {
        return { top: 0, left: 0 };
      }

      const rect = targetElement.getBoundingClientRect();
      const iframeWindow = iframeDoc.defaultView;
      const scrollX = iframeWindow?.scrollX || 0;
      const scrollY = iframeWindow?.scrollY || 0;

      // 타겟 요소 좌상단 + 고정 오프셋(px)
      const absoluteLeft = rect.left + scrollX + (spec.offsetX || 0);
      const absoluteTop = rect.top + scrollY + (spec.offsetY || 0);
      
      return { top: absoluteTop, left: absoluteLeft };
    } catch {
      return { top: 0, left: 0 };
    }
  }, [iframeDoc, spec.targetSelector, spec.offsetX, spec.offsetY, domVersion]);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.preventDefault();

    const pin = pinRef.current;
    if (!pin) return;

    isDraggingRef.current = true;

    // Get the iframe window for scroll position
    const iframeWindow = pin.ownerDocument.defaultView;
    if (!iframeWindow) return;

    // Calculate drag offset based on absolute document coordinates
    const pinRect = pin.getBoundingClientRect();
    const absoluteMouseX = e.clientX + iframeWindow.scrollX;
    const absoluteMouseY = e.clientY + iframeWindow.scrollY;
    const pinAbsoluteLeft = pinRect.left + iframeWindow.scrollX;
    const pinAbsoluteTop = pinRect.top + iframeWindow.scrollY;

    dragOffsetRef.current = {
      x: absoluteMouseX - pinAbsoluteLeft,
      y: absoluteMouseY - pinAbsoluteTop
    };

    // Add UX styles to iframe body
    const iframeDocRef = pin.ownerDocument;
    iframeDocRef.body.style.cursor = 'grabbing';
    iframeDocRef.body.style.userSelect = 'none';

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isDraggingRef.current || !pin) return;

      const win = pin.ownerDocument.defaultView;
      if (!win) return;

      // Calculate new position using absolute coordinates
      const absoluteMouseX = moveEvent.clientX + win.scrollX;
      const absoluteMouseY = moveEvent.clientY + win.scrollY;

      const newLeft = absoluteMouseX - dragOffsetRef.current.x;
      const newTop = absoluteMouseY - dragOffsetRef.current.y;

      // Update style directly (no transform)
      pin.style.left = `${newLeft}px`;
      pin.style.top = `${newTop}px`;
    };

    const handleMouseUp = () => {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;

      // Remove UX styles
      iframeDocRef.body.style.cursor = '';
      iframeDocRef.body.style.userSelect = '';

      // Read final position from DOM and convert to offset
      if (pin && iframeDocRef) {
        const finalLeft = parseFloat(pin.style.left) || 0;
        const finalTop = parseFloat(pin.style.top) || 0;
        
        // 타겟 요소 찾아서 오프셋 계산
        try {
          const targetElement = iframeDocRef.querySelector(spec.targetSelector) as HTMLElement;
          if (targetElement) {
            const rect = targetElement.getBoundingClientRect();
            const win = iframeDocRef.defaultView;
            const scrollX = win?.scrollX || 0;
            const scrollY = win?.scrollY || 0;
            
            // 새 오프셋 = 핀 절대위치 - 타겟 좌상단 절대위치
            const newOffsetX = finalLeft - (rect.left + scrollX);
            const newOffsetY = finalTop - (rect.top + scrollY);
            
            onDragEnd(spec.id, newOffsetX, newOffsetY);
          }
        } catch {
          // 실패 시 무시
        }
      }

      // Cleanup listeners
      iframeDocRef.removeEventListener('mousemove', handleMouseMove);
      iframeDocRef.removeEventListener('mouseup', handleMouseUp);
    };

    iframeDocRef.addEventListener('mousemove', handleMouseMove);
    iframeDocRef.addEventListener('mouseup', handleMouseUp);
  }, [spec.id, spec.targetSelector, onDragEnd]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isDraggingRef.current) {
      onSelect(spec.id);
    }
  }, [spec.id, onSelect]);

  // If not visible, don't render
  if (!isVisible) {
    return null;
  }

  return (
    <div
      ref={pinRef}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
      style={{
        position: 'absolute',
        top: `${pinPosition.top}px`,
        left: `${pinPosition.left}px`,
        width: '24px',
        height: '24px',
        // Use margin instead of transform for centering
        marginLeft: '-12px',
        marginTop: '-12px',
        background: isActive ? '#ea580c' : '#c6613f',
        color: 'white',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '12px',
        fontWeight: 'bold',
        border: isActive ? '2px solid #ffedd5' : '2px solid white',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
        zIndex: isActive ? 10000 : 9999,
        cursor: 'grab',
        transition: 'background-color 0.2s',
      }}
      className="spec-pin-portal"
    >
      {index + 1}
    </div>
  );
};

const App: React.FC = () => {
  const [htmlContent, setHtmlContent] = useState<string | null>(null);
  const [specs, setSpecs] = useState<SpecItem[]>([]);
  const [language, setLanguage] = useState<Language>('ko');
  const [activeSpecId, setActiveSpecId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [isDraggingFile, setIsDraggingFile] = useState(false);

  // DOM observation state
  const [domVersion, setDomVersion] = useState(0);
  const [activePageId, setActivePageId] = useState<string>('default');

  // Iframe refs & state
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeBody, setIframeBody] = useState<HTMLElement | null>(null);
  const [iframeDoc, setIframeDoc] = useState<Document | null>(null);

  // MutationObserver ref
  const observerRef = useRef<MutationObserver | null>(null);

  // Drag counter to safely handle enter/leave events through children
  const dragCounterRef = useRef(0);

  // Store all dropped files content: filename -> content
  const filesMapRef = useRef<Record<string, string>>({});

  // Store reference to addSpec handler to avoid dependency issues in effect
  const handleAddSpecRef = useRef<(data: { id: string; targetSelector: string; offsetX: number; offsetY: number }) => void>(() => { });

  // --- Spec CRUD Handlers ---
  const handleAddSpec = useCallback((data: { id: string; targetSelector: string; offsetX: number; offsetY: number }) => {
    const newSpec: SpecItem = {
      id: data.id,
      number: specs.length + 1,
      targetSelector: data.targetSelector,
      content: { ko: '', en: '' },
      offsetX: data.offsetX,
      offsetY: data.offsetY,
      pageId: activePageId, // 현재 페이지 ID 저장
      pageNumber: 1, // Start on page 1
    };
    setSpecs(prev => [...prev, newSpec]);
    setActiveSpecId(data.id);
  }, [specs, activePageId]);

  // Keep ref updated
  useEffect(() => {
    handleAddSpecRef.current = handleAddSpec;
  }, [handleAddSpec]);

  const handleUpdateSpec = useCallback((id: string, content: { ko?: string; en?: string }) => {
    setSpecs(prev => prev.map(s =>
      s.id === id ? { ...s, content: { ...s.content, ...content } } : s
    ));
  }, []);

  const handleUpdateTitle = useCallback((id: string, title: string) => {
    setSpecs(prev => prev.map(s =>
      s.id === id ? { ...s, title } : s
    ));
  }, []);

  const handleDeleteSpec = useCallback((id: string) => {
    setSpecs(prev => {
      const filtered = prev.filter(s => s.id !== id);
      return filtered.map((s, idx) => ({ ...s, number: idx + 1 }));
    });
    if (activeSpecId === id) setActiveSpecId(null);
  }, [activeSpecId]);

  const handleSelectSpec = useCallback((id: string | null) => {
    setActiveSpecId(id);
  }, []);

  // --- Page Change Handler (for EditorPanel) ---
  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  // --- Reorder Specs Handler ---
  const handleReorderSpecs = useCallback((newSpecs: SpecItem[]) => {
    // Update the spec numbers after reordering
    const reorderedSpecs = newSpecs.map((spec, index) => ({
      ...spec,
      number: index + 1
    }));
    setSpecs(reorderedSpecs);
  }, []);

  // Pin drag end handler - 고정 오프셋(px) 저장
  const handlePinDragEnd = (id: string, newOffsetX: number, newOffsetY: number) => {
    setSpecs(prev => prev.map(s =>
      s.id === id ? { ...s, offsetX: newOffsetX, offsetY: newOffsetY } : s
    ));
    handleSelectSpec(id);
  };

  // Manual pagination move handlers
  const handleMoveToNextPage = useCallback((id: string) => {
    setSpecs(prev => prev.map(s => {
      if (s.id === id) {
        const newPageNumber = (s.pageNumber || 1) + 1;
        return { ...s, pageNumber: newPageNumber };
      }
      return s;
    }));

    // Navigate to the new page
    const spec = specs.find(s => s.id === id);
    if (spec) {
      setCurrentPage((spec.pageNumber || 1) + 1);
    }
  }, [specs]);

  const handleMoveToPrevPage = useCallback((id: string) => {
    setSpecs(prev => prev.map(s => {
      if (s.id === id) {
        const newPageNumber = Math.max(1, (s.pageNumber || 1) - 1);
        return { ...s, pageNumber: newPageNumber };
      }
      return s;
    }));

    // Navigate to the new page
    const spec = specs.find(s => s.id === id);
    if (spec) {
      setCurrentPage(Math.max(1, (spec.pageNumber || 1) - 1));
    }
  }, [specs]);

  // --- Helper to attach listeners to a document with CAPTURE phase ---
  const attachDocListeners = useCallback((doc: Document) => {
    // Use capture: true to intercept events BEFORE they reach target elements

    // MouseDown handler - intercept Ctrl+Click early to prevent link navigation
    const mouseDownHandler = (e: MouseEvent) => {
      if (e.ctrlKey || e.metaKey) {
        const target = e.target as HTMLElement;
        // If NOT clicking on a pin, prevent default immediately
        if (!target.closest('.spec-pin-portal')) {
          e.preventDefault();
          e.stopPropagation();
        }
      }
    };

    // Click handler - add pin on Ctrl+Click
    const clickHandler = (e: MouseEvent) => {
      if (e.ctrlKey || e.metaKey) {
        const clickedElement = e.target as HTMLElement;

        // Skip if clicking on a pin
        if (clickedElement.closest('.spec-pin-portal')) return;

        // Prevent all default behavior and propagation
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        // 안정적인 부모 컨테이너 찾기 (레이아웃 변경에 강함)
        const stableTarget = findStableContainer(clickedElement);
        
        // 타겟 요소 기준으로 고정 오프셋(px) 계산
        const targetRect = stableTarget.getBoundingClientRect();
        const offsetX = e.clientX - targetRect.left;
        const offsetY = e.clientY - targetRect.top;

        const selector = generateUniqueSelector(stableTarget);
        handleAddSpecRef.current({
          id: crypto.randomUUID(),
          targetSelector: selector,
          offsetX: offsetX,
          offsetY: offsetY
        });
      }
      // Normal clicks (without Ctrl) are NOT prevented
    };

    // Hover effect for Ctrl+mouseover
    const mouseOverHandler = (e: MouseEvent) => {
      if (e.ctrlKey || e.metaKey) {
        const target = e.target as HTMLElement;
        if (!target.closest('.spec-pin-portal')) {
          target.classList.add('spec-target-hover');
        }
      }
    };

    const mouseOutHandler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      target.classList.remove('spec-target-hover');
    };

    // Use capture: true for all mouse events
    doc.addEventListener('mousedown', mouseDownHandler, { capture: true });
    doc.addEventListener('click', clickHandler, { capture: true });
    doc.addEventListener('mouseover', mouseOverHandler, { capture: true });
    doc.addEventListener('mouseout', mouseOutHandler, { capture: true });

    return () => {
      doc.removeEventListener('mousedown', mouseDownHandler, { capture: true });
      doc.removeEventListener('click', clickHandler, { capture: true });
      doc.removeEventListener('mouseover', mouseOverHandler, { capture: true });
      doc.removeEventListener('mouseout', mouseOutHandler, { capture: true });
    };
  }, []);

  // --- Navigation Handlers ---
  const handleIframeLoad = useCallback(() => {
    const doc = iframeRef.current?.contentDocument;
    if (doc) {
      // Inject CSS styles for pins and hover effects
      const style = doc.createElement('style');
      style.textContent = `
        body { cursor: default; }
        .spec-pin-portal { cursor: grab; }
        .spec-pin-portal:active { cursor: grabbing; }
        .spec-target-hover { outline: 2px dashed #f97316 !important; cursor: crosshair !important; }
      `;
      if (!doc.querySelector('style[data-spec-styles]')) {
        style.setAttribute('data-spec-styles', 'true');
        doc.head.appendChild(style);
      }

      setIframeBody(doc.body);
      setIframeDoc(doc);

      // Detect initial page
      setActivePageId(detectActivePageId(doc));

      // Attach event listeners
      attachDocListeners(doc);

      // Setup MutationObserver to detect DOM changes (including page switches)
      if (observerRef.current) {
        observerRef.current.disconnect();
      }

      observerRef.current = new MutationObserver(() => {
        // Increment domVersion to trigger re-renders
        setDomVersion(v => v + 1);
        // Re-detect active page
        setActivePageId(detectActivePageId(doc));
      });

      observerRef.current.observe(doc.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'style', 'hidden']
      });
    }
  }, [attachDocListeners]);

  const handleNavigate = (direction: 'back' | 'forward') => {
    try {
      const win = iframeRef.current?.contentWindow;
      if (win) {
        if (direction === 'back') win.history.back();
        else win.history.forward();
      }
    } catch {
      // ignore cross-origin errors
    }
  };

  const handleRefresh = () => {
    try {
      const win = iframeRef.current?.contentWindow;
      if (win) win.location.reload();
    } catch {
      // ignore cross-origin errors
    }
  };

  // --- Reset All ---
  const handleResetAll = () => {
    setSpecs([]);
    setActiveSpecId(null);
    setCurrentPage(1);
  };

  // Cleanup observer on unmount
  useEffect(() => {
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, []);

  // Effect to trigger re-render when iframe content changes
  useEffect(() => {
    if (htmlContent) {
      // Small delay to allow iframe to load
      const timer = setTimeout(() => {
        setDomVersion(v => v + 1);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [htmlContent]);

  // Listen for resize events in iframe to update pin positions
  useEffect(() => {
    const iframeWindow = iframeRef.current?.contentWindow;
    if (iframeWindow) {
      const handleResize = () => {
        // Trigger re-render to recalculate pin positions
        setDomVersion(v => v + 1);
      };
      
      iframeWindow.addEventListener('resize', handleResize);
      return () => {
        iframeWindow.removeEventListener('resize', handleResize);
      };
    }
  }, [iframeDoc]);

  // --- File Handling ---
  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      const key = file.name;
      filesMapRef.current[key] = content;
      // Preserve existing specs when switching files
      const currentContent = content;
      setHtmlContent(currentContent);
    };
    reader.readAsText(file);
  };

  // Reset file state but preserve specs
  const handleResetFile = useCallback(() => {
    if (htmlContent) {
      // Re-apply current HTML to refresh iframe
      const currentContent = htmlContent;
      setHtmlContent(currentContent);
    }
  }, [htmlContent]);

  // --- Export/Import Handlers ---
  const handleExportHTML = () => {
    if (!htmlContent) return;
    const iframeDocRef = iframeRef.current?.contentDocument || null;
    const finalHTML = generateExportHTML(htmlContent, specs, iframeDocRef);
    const blob = new Blob([finalHTML], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '_spec.html';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportJSON = () => {
    const data = JSON.stringify(specs, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'specs_data.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportJSON = (file: File) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        if (Array.isArray(data)) {
          // Ensure all specs have pageNumber
          const specsWithPageNumber = data.map(spec => ({
            ...spec,
            pageNumber: spec.pageNumber || 1,
            // Legacy 데이터 마이그레이션: percentX/Y나 relativeTop/Left가 있으면 offsetX/Y로 변환
            offsetX: spec.offsetX ?? spec.percentX ?? 0,
            offsetY: spec.offsetY ?? spec.percentY ?? 0
          }));
          setSpecs(specsWithPageNumber);
        }
      } catch {
        alert('Invalid JSON file');
      }
    };
    reader.readAsText(file);
  };

  // --- Drop zone handlers at top level ---
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current += 1;
    if (dragCounterRef.current === 1) {
      setIsDraggingFile(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current === 0) {
      setIsDraggingFile(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = 0;
    setIsDraggingFile(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      if (file.name.endsWith('.html')) {
        handleFile(file);
      }
    }
  };

  // Filter specs by activePageId for the EditorPanel
  const filteredSpecs = useMemo(() => {
    return specs.filter(spec => {
      // If spec has no pageId, show it on all pages (legacy support)
      if (!spec.pageId) return true;
      // Otherwise, only show on matching page
      return spec.pageId === activePageId;
    });
  }, [specs, activePageId]);

  // --- Render: Pin Portals ---
  const renderPins = () => {
    if (!iframeBody || !iframeDoc) return null;

    // Render ALL pins (visibility handled internally by DraggablePin)
    return createPortal(
      <>
        {specs.map((spec, idx) => (
          <DraggablePin
            key={spec.id}
            spec={spec}
            index={idx}
            isActive={spec.id === activeSpecId}
            onSelect={handleSelectSpec}
            onDragEnd={handlePinDragEnd}
            iframeDoc={iframeDoc}
            domVersion={domVersion}
            activePageId={activePageId}
          />
        ))}
      </>,
      iframeBody
    );
  };

  return (
    <div
      className="h-screen flex flex-col bg-gray-100"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Header */}
      <TopBar
        language={language}
        onLanguageChange={setLanguage}
        onReset={handleResetAll}
        onExportHTML={handleExportHTML}
        onExportJSON={handleExportJSON}
        onImportJSON={handleImportJSON}
        hasFile={!!htmlContent}
      />

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: iframe preview */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Mini navigation bar */}
          <div className="flex items-center gap-2 px-4 py-2 bg-white border-b">
            <button onClick={() => handleNavigate('back')} className="p-1 rounded hover:bg-gray-100">
              <ChevronLeft size={18} />
            </button>
            <button onClick={() => handleNavigate('forward')} className="p-1 rounded hover:bg-gray-100">
              <ChevronRight size={18} />
            </button>
            <button onClick={handleRefresh} className="p-1 rounded hover:bg-gray-100">
              <RotateCcw size={16} />
            </button>
            {/* Page indicator */}
            <span className="ml-auto text-xs text-gray-500">
              Page: {activePageId}
            </span>
          </div>

          {/* Iframe / Drop zone */}
          <div className="relative flex-1 overflow-hidden">
            {/* Upload Overlay - Show when no content OR when dragging file over app */}
            {(!htmlContent || isDraggingFile) && (
              <div className={`absolute inset-0 z-50 flex items-center justify-center transition-all duration-200 ${isDraggingFile ? 'bg-orange-50/90 backdrop-blur-sm' : ''} ${!htmlContent ? 'bg-gray-50' : ''}`}>
                {/* Drop Zone Box - Visual Only */}
                <div className={`w-3/4 h-3/4 max-w-5xl max-h-[800px] flex flex-col items-center justify-center rounded-3xl border-[6px] border-dashed transition-all transform duration-300 text-center pointer-events-none
                  ${isDraggingFile ? 'border-orange-400 scale-100 opacity-100' : 'border-gray-200 scale-95 opacity-50'} 
                  ${!htmlContent && !isDraggingFile ? 'border-gray-300 scale-100 opacity-100' : ''}
                `}>
                  <div className={`mb-4 flex justify-center transition-colors duration-300 ${isDraggingFile ? 'text-orange-500' : 'text-gray-300'} ${!htmlContent && !isDraggingFile ? 'text-gray-400' : ''}`}>
                    <UploadCloud size={120} strokeWidth={1.5} />
                  </div>
                  <h3 className={`text-3xl font-bold mb-4 transition-colors duration-300 ${isDraggingFile ? 'text-orange-600' : 'text-gray-400'} ${!htmlContent && !isDraggingFile ? 'text-gray-600' : ''}`}>
                    {isDraggingFile ? "Drop HTML File Here!" : "Prototype Viewer"}
                  </h3>
                  <p className={`text-xl transition-colors duration-300 ${isDraggingFile ? 'text-orange-400' : 'text-gray-300'} ${!htmlContent && !isDraggingFile ? 'text-gray-500' : ''}`}>
                    Drag & drop .html file anywhere to start
                  </p>
                </div>
              </div>
            )}

            {htmlContent && (
              <>
                <iframe
                  ref={iframeRef}
                  srcDoc={htmlContent}
                  onLoad={handleIframeLoad}
                  className="absolute inset-0 w-full h-full border-none"
                  sandbox="allow-scripts allow-same-origin allow-forms"
                />
                {/* Instruction overlay */}
                <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-slate-800/80 backdrop-blur text-white px-4 py-2 rounded-full text-xs font-medium shadow-lg pointer-events-none z-30">
                  Hold <kbd className="mx-1 px-1.5 py-0.5 bg-white/20 rounded">Ctrl</kbd> + Click element to pin
                </div>
                {renderPins()}
              </>
            )}
          </div>
        </div>

        {/* Right: Editor Panel - 비율 기반 반응형 너비 */}
        <div className="w-1/4 min-w-[250px] max-w-[380px] flex-shrink-0 border-l bg-white overflow-hidden flex flex-col">
          <EditorPanel
            specs={filteredSpecs}
            activeSpecId={activeSpecId}
            language={language}
            onSetActiveSpec={handleSelectSpec}
            onUpdateSpec={(id, content) => handleUpdateSpec(id, { [language]: content })}
            onUpdateTitle={handleUpdateTitle}
            onUpdateNumber={() => {}}
            onDeleteSpec={handleDeleteSpec}
            onReorder={handleReorderSpecs}
            onMoveToNextPage={handleMoveToNextPage}
            onMoveToPrevPage={handleMoveToPrevPage}
            currentPage={currentPage}
            onPageChange={handlePageChange}
            activePageId={activePageId}
          />
        </div>
      </div>
    </div>
  );
};

export default App;
