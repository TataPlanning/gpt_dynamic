/**
 * Type Definitions for Dynamic Storyboard Authoring Tool
 */

export type Language = 'ko' | 'en';

export interface SpecContent {
  ko: string;
  en: string;
}

export interface SpecItem {
  id: string;
  number: number;
  title?: string; // User-defined title (editable)
  targetSelector: string; // Unique CSS path to element
  content: SpecContent;
  
  // Position as percentage within target element
  // This ensures the pin stays at the same relative position
  // even when the element size changes (e.g., text wrapping)
  percentX: number;  // 0-100, percentage from target's left edge
  percentY: number;  // 0-100, percentage from target's top edge
  
  fileName?: string; // Associated source file
  pageId?: string; // Page ID where the pin was created (for multi-page HTML)
  pageNumber: number; // Manual pagination - page number (1-based)
}

export interface SpecExportData {
  specs: SpecItem[];
  originalHtml: string;
}
