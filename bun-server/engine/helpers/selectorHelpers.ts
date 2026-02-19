/**
 * Selector utilities that explicitly avoid LinkedIn's global search box.
 * Global search markers:
 * - data-testid="typeahead-input"
 * - data-view-name="search-global-typeahead-input"
 * - placeholder="Search"
 */

const GLOBAL_SEARCH_EXCLUSIONS = [
  ':not([data-testid="typeahead-input"])',
  ':not([data-view-name*="search-global"])',
  ':not([placeholder="Search"])',
].join('');

export function excludeGlobalSearch(selector: string): string {
  return `${selector}${GLOBAL_SEARCH_EXCLUSIONS}`;
}

export function safeInputSelector(baseSelector: string): string {
  return excludeGlobalSearch(baseSelector);
}

export function safeContentEditableSelector(baseSelector: string): string {
  return excludeGlobalSearch(baseSelector);
}
