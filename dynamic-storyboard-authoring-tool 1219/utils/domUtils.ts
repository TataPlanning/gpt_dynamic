/**
 * DOM Utility Functions
 * CSS Selector 생성 및 DOM 관련 유틸리티
 */

/**
 * 요소의 고유한 CSS Selector를 생성합니다.
 * 클릭한 정확한 요소를 타겟으로 사용합니다.
 * 
 * @param el - 타겟 HTML 요소
 * @returns 고유한 CSS selector 문자열
 */
export const generateUniqueSelector = (el: HTMLElement): string => {
  // 1순위: ID가 있으면 바로 사용 (가장 안정적)
  if (el.id) {
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
  const maxDepth = 10;

  while (currentEl && currentEl.tagName !== 'HTML' && currentEl.tagName !== 'BODY' && depth < maxDepth) {
    let selector = currentEl.tagName.toLowerCase();

    // ID가 있으면 여기서 중단
    if (currentEl.id) {
      const escapedId = CSS.escape(currentEl.id);
      path.unshift(`#${escapedId}`);
      break;
    }

    // 클래스 추가 (의미 있는 클래스만)
    if (currentEl.className && typeof currentEl.className === 'string') {
      const classes = currentEl.className.split(/\s+/).filter(cls => {
        if (!cls) return false;
        if (cls.match(/^[a-z]{1,3}-[a-f0-9]+$/i)) return false; // css-in-js
        if (cls.match(/^_[a-zA-Z0-9]+$/)) return false; // CSS modules
        if (cls.match(/^(hover|active|focus|selected|open|visible|hidden)$/)) return false;
        return true;
      });

      if (classes.length > 0) {
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
 * 요소가 화면에 보이는지 확인합니다 (부모 포함).
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
