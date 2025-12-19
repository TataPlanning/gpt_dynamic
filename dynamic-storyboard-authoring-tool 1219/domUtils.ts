/**
 * DOM Utility Functions
 * 안정적인 CSS Selector 생성 및 DOM 관련 유틸리티
 */

/**
 * 안정적인 컨테이너 역할을 하는 클래스 패턴
 * 이 클래스를 가진 요소는 레이아웃 변경에도 위치가 안정적
 */
const STABLE_CONTAINER_PATTERNS = [
  /card/i,
  /container/i,
  /wrapper/i,
  /item/i,
  /box/i,
  /block/i,
  /section/i,
  /panel/i,
  /tile/i,
  /cell/i,
  /promo-type/i,  // 이 프로젝트 특화
];

/**
 * 요소가 안정적인 컨테이너인지 확인
 */
const isStableContainer = (el: HTMLElement): boolean => {
  // ID가 있으면 안정적
  if (el.id) return true;
  
  // data 속성이 있으면 안정적
  if (el.hasAttribute('data-testid') || el.hasAttribute('data-id')) return true;
  
  // 클래스 패턴 확인
  const className = el.className;
  if (typeof className === 'string') {
    for (const pattern of STABLE_CONTAINER_PATTERNS) {
      if (pattern.test(className)) return true;
    }
  }
  
  return false;
};

/**
 * 클릭한 요소에서 가장 가까운 안정적인 부모 컨테이너를 찾습니다.
 * 
 * @param el - 클릭한 요소
 * @param maxDepth - 최대 탐색 깊이
 * @returns 안정적인 컨테이너 요소
 */
export const findStableContainer = (el: HTMLElement, maxDepth: number = 10): HTMLElement => {
  let current: HTMLElement | null = el;
  let depth = 0;
  let lastValidContainer: HTMLElement = el;
  
  while (current && current.tagName !== 'BODY' && current.tagName !== 'HTML' && depth < maxDepth) {
    // 안정적인 컨테이너를 찾으면 반환
    if (isStableContainer(current)) {
      return current;
    }
    
    // div, article, section 등 블록 요소는 후보로 저장
    const tagName = current.tagName.toLowerCase();
    if (['div', 'article', 'section', 'li', 'a'].includes(tagName)) {
      lastValidContainer = current;
    }
    
    current = current.parentElement;
    depth++;
  }
  
  // 안정적인 컨테이너를 못 찾으면 마지막 유효한 블록 요소 반환
  return lastValidContainer;
};

/**
 * 요소의 고유한 CSS Selector를 생성합니다.
 * 우선순위: ID > data-* 속성 > 클래스 + nth-of-type 조합
 * 
 * @param el - 타겟 HTML 요소
 * @returns 고유한 CSS selector 문자열
 */
export const generateUniqueSelector = (el: HTMLElement): string => {
  // 1순위: ID가 있으면 바로 사용 (가장 안정적)
  if (el.id) {
    // ID에 특수문자가 있으면 escape 처리
    const escapedId = CSS.escape(el.id);
    return `#${escapedId}`;
  }

  // 2순위: data-testid, data-id 등 고유 식별자 속성
  const dataAttrs = ['data-testid', 'data-id', 'data-spec-id', 'data-key'];
  for (const attr of dataAttrs) {
    const value = el.getAttribute(attr);
    if (value) {
      return `[${attr}="${CSS.escape(value)}"]`;
    }
  }

  // 3순위: 경로 기반 selector 생성
  const path: string[] = [];
  let currentEl: HTMLElement | null = el;
  let depth = 0;
  const maxDepth = 10; // 너무 깊은 경로 방지

  while (currentEl && currentEl.tagName !== 'HTML' && currentEl.tagName !== 'BODY' && depth < maxDepth) {
    let selector = currentEl.tagName.toLowerCase();

    // ID가 있으면 여기서 중단 (고유함)
    if (currentEl.id) {
      const escapedId = CSS.escape(currentEl.id);
      path.unshift(`#${escapedId}`);
      break;
    }

    // 클래스 추가 (의미 있는 클래스만, 동적 클래스 제외)
    if (currentEl.className && typeof currentEl.className === 'string') {
      const classes = currentEl.className.split(/\s+/).filter(cls => {
        // 동적으로 생성되는 클래스 패턴 제외
        if (!cls) return false;
        if (cls.match(/^[a-z]{1,3}-[a-f0-9]+$/i)) return false; // css-in-js 해시
        if (cls.match(/^_[a-zA-Z0-9]+$/)) return false; // CSS modules 해시
        if (cls.match(/^(hover|active|focus|selected|open|visible|hidden)$/)) return false; // 상태 클래스
        return true;
      });

      if (classes.length > 0) {
        // 첫 번째 유효한 클래스만 사용 (너무 길어지는 것 방지)
        selector += `.${CSS.escape(classes[0])}`;
      }
    }

    // nth-of-type으로 형제 간 구분
    let nth = 1;
    let sibling = currentEl.previousElementSibling;
    while (sibling) {
      if (sibling.tagName === currentEl.tagName) nth++;
      sibling = sibling.previousElementSibling;
    }
    
    // 같은 태그의 형제가 여러 개일 때만 nth-of-type 추가
    let nextSibling = currentEl.nextElementSibling;
    let hasSameTagSibling = nth > 1;
    while (nextSibling && !hasSameTagSibling) {
      if (nextSibling.tagName === currentEl.tagName) hasSameTagSibling = true;
      nextSibling = nextSibling.nextElementSibling;
    }
    
    if (hasSameTagSibling) {
      selector += `:nth-of-type(${nth})`;
    }

    path.unshift(selector);
    currentEl = currentEl.parentElement;
    depth++;
  }

  return path.join(' > ');
};

/**
 * Selector가 유효한지 검증합니다.
 * 
 * @param doc - Document 객체
 * @param selector - 검증할 CSS selector
 * @returns 유효하면 true
 */
export const isValidSelector = (doc: Document, selector: string): boolean => {
  try {
    const element = doc.querySelector(selector);
    return element !== null;
  } catch {
    return false;
  }
};

/**
 * 요소가 화면에 보이는지 확인합니다 (부모 포함).
 * 
 * @param element - 확인할 요소
 * @returns 보이면 true
 */
export const isElementVisible = (element: Element | null): boolean => {
  if (!element) return false;

  const win = element.ownerDocument?.defaultView;
  if (!win) return false;

  let current: Element | null = element;
  while (current && current !== element.ownerDocument.body) {
    const style = win.getComputedStyle(current as HTMLElement);

    if (style.display === 'none') return false;
    if (style.visibility === 'hidden') return false;
    if (style.opacity === '0') return false;
    if ((current as HTMLElement).hidden) return false;

    current = current.parentElement;
  }

  return true;
};

/**
 * 요소의 절대 위치를 가져옵니다 (스크롤 포함).
 * 
 * @param element - 타겟 요소
 * @returns { top, left, width, height }
 */
export const getAbsolutePosition = (element: HTMLElement): { top: number; left: number; width: number; height: number } => {
  const rect = element.getBoundingClientRect();
  const win = element.ownerDocument.defaultView;
  const scrollX = win?.scrollX || 0;
  const scrollY = win?.scrollY || 0;

  return {
    top: rect.top + scrollY,
    left: rect.left + scrollX,
    width: rect.width,
    height: rect.height
  };
};
