import { html, svg, type SVGTemplateResult, type TemplateResult } from 'lit-html';

/** Inline stroke icons (24×24 grid) — no icon font or library to download. */
const PATHS = {
  overview: svg`<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>`,
  cashflow: svg`<path d="M7 20V4M3 8l4-4 4 4M17 4v16M13 16l4 4 4-4"/>`,
  spending: svg`<path d="M21 12a9 9 0 1 1-9-9v9z"/><path d="M15 3.5A9 9 0 0 1 20.5 9H15z"/>`,
  invest: svg`<path d="M3 17l6-6 4 4 8-8"/><path d="M14 7h7v7"/>`,
  compare: svg`<path d="M8 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3M16 3h3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-3M12 2v20"/>`,
  list: svg`<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>`,
  more: svg`<path d="M5 12h.01M12 12h.01M19 12h.01" stroke-width="3"/>`,
  upload: svg`<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>`,
  chevronLeft: svg`<path d="M15 18l-6-6 6-6"/>`,
  chevronRight: svg`<path d="M9 18l6-6-6-6"/>`,
  search: svg`<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>`,
  check: svg`<path d="M5 12l5 5 9-10"/>`,
  checkCircle: svg`<circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/>`,
  alert: svg`<path d="M12 8v5M12 16.5h.01"/>`,
  alertTriangle: svg`<path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01"/>`,
  info: svg`<path d="M12 16v-5M12 7.5h.01"/>`,
  logo: svg`<path d="M6 17v-5M12 17V7M18 17v-8" stroke-width="2.6"/>`,
} satisfies Record<string, SVGTemplateResult>;

export type IconName = keyof typeof PATHS;

export function icon(name: IconName, size = 18): TemplateResult {
  return html`<svg width=${size} height=${size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${PATHS[name]}</svg>`;
}
