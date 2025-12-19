/**
 * Export Utilities
 * HTML Export with Responsive Pin Positioning (Percentage-based)
 */

import { SpecItem } from "../types";

/**
 * Export HTML을 생성합니다.
 * 타겟 요소 기준 퍼센트로 위치 계산 + resize 이벤트 대응
 * 
 * @param originalHtml - 원본 HTML 문자열
 * @param specs - Spec 아이템 배열
 * @param iframeDoc - iframe의 Document 객체 (현재 미사용)
 * @returns Export용 HTML 문자열
 */
export const generateExportHTML = (
  originalHtml: string,
  specs: SpecItem[],
  iframeDoc: Document | null = null
): string => {
  // Export용 spec 데이터 (percentX, percentY 사용)
  const exportSpecs = specs.map(spec => ({
    id: spec.id,
    number: spec.number,
    title: spec.title,
    targetSelector: spec.targetSelector,
    content: spec.content,
    percentX: spec.percentX || 50,
    percentY: spec.percentY || 50,
    pageId: spec.pageId,
    pageNumber: spec.pageNumber
  }));

  const viewerScript = `
<script>
(function() {
  'use strict';
  
  // ========================================
  // Spec Data (Injected at Export Time)
  // ========================================
  const specs = ${JSON.stringify(exportSpecs, null, 2)};
  
  // ========================================
  // State
  // ========================================
  let currentLang = 'ko';
  let activeSpecId = null;
  let currentPageId = null;
  let resizeTimer = null;
  
  // ========================================
  // Utility Functions
  // ========================================
  
  /**
   * 요소가 보이는지 확인 (display, visibility, opacity, parents 체크)
   */
  function isElementVisible(element) {
    if (!element) return false;
    
    let current = element;
    while (current && current !== document.body) {
      const style = window.getComputedStyle(current);
      if (style.display === 'none') return false;
      if (style.visibility === 'hidden') return false;
      if (style.opacity === '0') return false;
      if (current.hidden) return false;
      current = current.parentElement;
    }
    return true;
  }
  
  /**
   * 현재 활성 페이지 ID 감지
   */
  function detectActivePageId() {
    // Strategy 1: section.page.active
    const activePage = document.querySelector('section.page.active');
    if (activePage && activePage.id) {
      return activePage.id;
    }
    
    // Strategy 2: 다른 active 패턴
    const activeElement = document.querySelector('.page.active, [data-page].active, .view.active');
    if (activeElement) {
      return activeElement.id || activeElement.getAttribute('data-page') || 'default';
    }
    
    // Strategy 3: URL hash
    if (window.location.hash) {
      return window.location.hash.slice(1);
    }
    
    return 'default';
  }
  
  // ========================================
  // Pin Rendering (Core Logic)
  // ========================================
  
  /**
   * 모든 핀을 렌더링합니다.
   * ★ 핵심: 타겟 요소 기준 퍼센트로 위치 계산
   * 요소 크기가 변해도 같은 상대 위치 유지
   */
  function renderPins() {
    // 기존 핀 모두 제거
    document.querySelectorAll('.spec-pin-overlay').forEach(el => el.remove());
    
    // 현재 페이지 ID 감지
    currentPageId = detectActivePageId();
    
    // 현재 페이지에 해당하는 spec만 필터링하고 번호순 정렬
    const visibleSpecs = specs
      .filter(spec => {
        if (!spec.pageId) return true;
        return spec.pageId === currentPageId;
      })
      .sort((a, b) => a.number - b.number);
    
    visibleSpecs.forEach((spec, index) => {
      // 타겟 요소 찾기
      let targetElement = null;
      try {
        targetElement = document.querySelector(spec.targetSelector);
      } catch (e) {
        console.warn('Invalid selector:', spec.targetSelector);
        return;
      }
      
      // 타겟을 못 찾으면 핀 표시 안 함
      if (!targetElement) {
        console.warn('Target not found for spec:', spec.id, spec.targetSelector);
        return;
      }
      
      // 타겟이 숨겨져 있으면 핀도 숨김
      if (!isElementVisible(targetElement)) {
        return;
      }
      
      // ★ 핵심: 타겟 요소 기준 퍼센트로 위치 계산
      const rect = targetElement.getBoundingClientRect();
      const scrollX = window.scrollX || window.pageXOffset;
      const scrollY = window.scrollY || window.pageYOffset;
      
      // 퍼센트를 실제 픽셀로 변환
      const pinLeft = rect.left + scrollX + (rect.width * spec.percentX / 100);
      const pinTop = rect.top + scrollY + (rect.height * spec.percentY / 100);
      
      // 핀 생성
      const pin = document.createElement('div');
      pin.className = 'spec-pin-overlay';
      pin.setAttribute('data-spec-id', spec.id);
      pin.textContent = (index + 1).toString();
      
      // 스타일 적용
      Object.assign(pin.style, {
        position: 'absolute',
        left: pinLeft + 'px',
        top: pinTop + 'px',
        transform: 'translate(-50%, -50%)',
        width: '24px',
        height: '24px',
        background: '#c6613f',
        color: 'white',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '12px',
        fontWeight: 'bold',
        border: '2px solid white',
        boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
        zIndex: '9999',
        cursor: 'pointer',
        transition: 'transform 0.15s ease, background 0.15s ease',
        userSelect: 'none'
      });
      
      // 호버 효과
      pin.addEventListener('mouseenter', () => {
        pin.style.transform = 'translate(-50%, -50%) scale(1.15)';
        pin.style.background = '#ea580c';
      });
      pin.addEventListener('mouseleave', () => {
        pin.style.transform = 'translate(-50%, -50%) scale(1)';
        pin.style.background = activeSpecId === spec.id ? '#ea580c' : '#c6613f';
      });
      
      // 클릭 이벤트
      pin.addEventListener('click', (e) => {
        e.stopPropagation();
        showSpecDetail(spec, index + 1);
      });
      
      document.body.appendChild(pin);
    });
  }
  
  // ========================================
  // Sidebar (Spec Detail View)
  // ========================================
  
  function showSpecDetail(spec, displayNumber) {
    const sidebar = document.getElementById('spec-sidebar');
    const content = document.getElementById('spec-content');
    const title = document.getElementById('spec-title');
    const titleText = document.getElementById('spec-title-text');
    
    if (!sidebar || !content || !title) return;
    
    activeSpecId = spec.id;
    
    // 제목 설정
    const displayTitle = spec.title || ('Spec #' + displayNumber);
    if (titleText) {
      titleText.textContent = displayTitle;
    } else {
      title.textContent = displayTitle;
    }
    
    // 내용 설정
    content.textContent = spec.content[currentLang] || spec.content.ko || '';
    
    // 사이드바 표시
    sidebar.classList.add('active');
    
    // 활성 핀 스타일 업데이트
    document.querySelectorAll('.spec-pin-overlay').forEach(pin => {
      if (pin.getAttribute('data-spec-id') === spec.id) {
        pin.style.background = '#ea580c';
        pin.style.boxShadow = '0 2px 12px rgba(234, 88, 12, 0.4)';
      } else {
        pin.style.background = '#c6613f';
        pin.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
      }
    });
  }
  
  function closeSidebar() {
    const sidebar = document.getElementById('spec-sidebar');
    if (sidebar) {
      sidebar.classList.remove('active');
    }
    activeSpecId = null;
    
    document.querySelectorAll('.spec-pin-overlay').forEach(pin => {
      pin.style.background = '#c6613f';
      pin.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
    });
  }
  
  function toggleLang() {
    currentLang = currentLang === 'ko' ? 'en' : 'ko';
    const langBtn = document.getElementById('lang-btn');
    if (langBtn) {
      langBtn.textContent = currentLang.toUpperCase();
    }
    
    if (activeSpecId) {
      const spec = specs.find(s => s.id === activeSpecId);
      if (spec) {
        const content = document.getElementById('spec-content');
        if (content) {
          content.textContent = spec.content[currentLang] || spec.content.ko || '';
        }
      }
    }
  }
  
  // ========================================
  // Sidebar HTML Template
  // ========================================
  
  function createSidebar() {
    const sidebarHTML = \`
      <div id="spec-sidebar" style="
        position: fixed;
        top: 0;
        right: -360px;
        width: 360px;
        height: 100%;
        background: white;
        box-shadow: -4px 0 20px rgba(0,0,0,0.1);
        transition: right 0.3s ease;
        z-index: 10001;
        display: flex;
        flex-direction: column;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      ">
        <!-- Header -->
        <div style="
          padding: 20px;
          border-bottom: 1px solid #eee;
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%);
        ">
          <h3 id="spec-title" style="margin: 0; font-weight: 600; color: #9a3412; font-size: 16px;">
            <span id="spec-title-text">Spec</span>
          </h3>
          <button onclick="window.__closeSidebar()" style="
            background: none;
            border: none;
            cursor: pointer;
            font-size: 20px;
            color: #9a3412;
            padding: 4px 8px;
            border-radius: 4px;
            transition: background 0.15s;
          " onmouseover="this.style.background='rgba(0,0,0,0.05)'" onmouseout="this.style.background='none'">✕</button>
        </div>
        
        <!-- Content -->
        <div style="padding: 24px; flex: 1; overflow-y: auto;">
          <p id="spec-content" style="
            white-space: pre-wrap;
            color: #374151;
            font-size: 14px;
            line-height: 1.7;
            margin: 0;
          "></p>
        </div>
        
        <!-- Footer -->
        <div style="
          padding: 16px 20px;
          border-top: 1px solid #eee;
          display: flex;
          justify-content: center;
          gap: 12px;
          background: #fafafa;
        ">
          <button id="lang-btn" onclick="window.__toggleLang()" style="
            padding: 8px 20px;
            border-radius: 20px;
            border: 1px solid #d1d5db;
            background: white;
            cursor: pointer;
            font-size: 13px;
            font-weight: 500;
            color: #374151;
            transition: all 0.15s;
          " onmouseover="this.style.borderColor='#c6613f';this.style.color='#c6613f'" onmouseout="this.style.borderColor='#d1d5db';this.style.color='#374151'">KO</button>
        </div>
      </div>
    \`;
    
    const container = document.createElement('div');
    container.innerHTML = sidebarHTML;
    document.body.appendChild(container.firstElementChild);
    
    // 사이드바 active 스타일
    const style = document.createElement('style');
    style.textContent = \`
      #spec-sidebar.active { right: 0 !important; }
      .spec-pin-overlay { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    \`;
    document.head.appendChild(style);
  }
  
  // Global functions
  window.__closeSidebar = closeSidebar;
  window.__toggleLang = toggleLang;
  
  // ========================================
  // Initialization
  // ========================================
  
  function init() {
    createSidebar();
    
    // 초기 렌더링
    setTimeout(renderPins, 100);
    
    // ★ CRITICAL: 창 크기 변경 시 핀 위치 재계산
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(renderPins, 10);
    });
    
    // 사이드바 외부 클릭 시 닫기
    document.addEventListener('click', (e) => {
      const sidebar = document.getElementById('spec-sidebar');
      if (sidebar && sidebar.classList.contains('active')) {
        if (!sidebar.contains(e.target) && !e.target.classList.contains('spec-pin-overlay')) {
          closeSidebar();
        }
      }
    });
    
    // DOM 변경 감지 (페이지 전환 등)
    const observer = new MutationObserver(() => {
      const newPageId = detectActivePageId();
      if (newPageId !== currentPageId) {
        currentPageId = newPageId;
        setTimeout(renderPins, 50);
      }
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style']
    });
    
    // ESC 키로 사이드바 닫기
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeSidebar();
      }
    });
  }
  
  // DOM Ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
<\/script>`;

  // HTML에 스크립트 삽입
  let result = originalHtml;
  
  if (result.includes('</body>')) {
    result = result.replace('</body>', `${viewerScript}\n</body>`);
  } else if (result.includes('</html>')) {
    result = result.replace('</html>', `${viewerScript}\n</html>`);
  } else {
    result = result + viewerScript;
  }

  return result;
};
