import { html, nothing, render, type TemplateResult } from 'lit-html';
import { fmtD, fmtN, mLabel } from '../domain/format';
import { boundsOf, buildPresets, periodLabel, periodLabelShort, samePeriod, shiftPeriod } from '../domain/period';
import type { AppActions } from '../state/appStore';
import type { AppState } from '../state/appState';
import type { Store } from '../state/store';
import { icon } from '../ui/icons';
import { AREAS, href, type Area, type AreaId, type Route } from './routes';

/** Bottom-bar order on phones; every other area sits in the "Mehr" sheet. */
const MOBILE: AreaId[] = ['uebersicht', 'transaktionen', 'cashflow', 'ausgaben'];
const MORE = AREAS.filter((a) => !MOBILE.includes(a.id));

export interface ShellElements {
  sidebar: HTMLElement;
  header: HTMLElement;
  bottomNav: HTMLElement;
  sheet: HTMLElement;
}

export interface Shell {
  update(route: Route): void;
}

/** Renders everything around the pages: navigation, page header with the global period, mobile sheet. */
export function createShell(el: ShellElements, store: Store<AppState>, actions: AppActions, onReset: () => void): Shell {
  let route: Route | null = null;
  let sheetOpen = false;

  const setSheet = (open: boolean) => {
    sheetOpen = open;
    draw();
  };

  function draw(): void {
    if (!route) return;
    const s = store.getState();
    render(sidebar(s, route, onReset), el.sidebar);
    render(header(s, route, actions, onReset), el.header);
    render(bottomNav(route, sheetOpen, () => setSheet(!sheetOpen)), el.bottomNav);
    render(sheetOpen ? sheet(route, () => setSheet(false), onReset) : nothing, el.sheet);
    document.title = `${route.sub ? `${route.area.label} · ${route.sub.label}` : route.area.label} · FinanceIQ`;
  }

  store.subscribe(draw);
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && sheetOpen) setSheet(false);
  });

  return {
    update(next) {
      route = next;
      sheetOpen = false;
      draw();
    },
  };
}

function navLink(a: Area, route: Route): TemplateResult {
  return html`
    <a class="nav-item" href=${href(a.id)} aria-current=${a.id === route.area.id ? 'page' : 'false'}>
      ${icon(a.icon)}<span class="nav-label">${a.label}</span>
    </a>
  `;
}

function fileInfo(s: AppState): string {
  const a = s.fullAnalysis;
  if (!a) return '';
  const first = a.mKeys[0];
  return `${fmtN(a.enriched.length)} Buchungen${first ? ` · seit ${mLabel(first)}` : ''}`;
}

function sidebar(s: AppState, route: Route, onReset: () => void): TemplateResult {
  return html`
    <div class="brand"><span class="brand-mark">${icon('logo', 18)}</span>FinanceIQ</div>
    <nav aria-label="Hauptnavigation"><ul class="nav">
      ${AREAS.map((a) => html`<li>${navLink(a, route)}</li>`)}
    </ul></nav>
    <div class="file-card">
      <span>Aktuelle Datei</span>
      <span class="file-name">${s.fileName}</span>
      <span>${fileInfo(s)}</span>
      <button type="button" class="btn btn--ghost" @click=${onReset}>${icon('upload', 16)}Neue Datei laden</button>
    </div>
  `;
}

function header(s: AppState, route: Route, actions: AppActions, onReset: () => void): TemplateResult {
  const full = s.fullAnalysis;
  const shown = route.usesPeriod ? s.analysis : full;
  const last = full?.enriched[full.enriched.length - 1]?._date ?? null;
  const scope = route.usesPeriod ? '' : 'Gesamte Historie · ';
  const meta = shown ? `${scope}${fmtN(shown.enriched.length)} Buchungen · Stand ${fmtD(last)}` : '';

  return html`
    <div>
      <div class="page-header-top">
        <h1 class="page-title"><span class="brand-mark mobile-only">${icon('logo', 16)}</span>${route.area.label}</h1>
        <button type="button" class="btn btn--icon mobile-only" aria-label="Neue Datei laden" @click=${onReset}>${icon('upload')}</button>
      </div>
      <p class="page-meta">${meta}</p>
      ${route.area.subs
        ? html`<nav class="seg page-sub" aria-label="${route.area.label}: Ansicht">
            ${route.area.subs.map((sub) => html`
              <a href=${href(route.area.id, sub.id)} aria-current=${sub.id === route.sub?.id ? 'page' : 'false'}>${sub.label}</a>
            `)}
          </nav>`
        : nothing}
    </div>
    ${route.usesPeriod && full ? periodControl(s, actions) : nothing}
  `;
}

function periodControl(s: AppState, actions: AppActions): TemplateResult {
  const mKeys = s.fullAnalysis!.mKeys;
  const bounds = boundsOf(mKeys);
  const presets = buildPresets(mKeys);
  const prev = bounds && shiftPeriod(s.period, -1, bounds);
  const next = bounds && shiftPeriod(s.period, 1, bounds);
  const current = presets.find((p) => samePeriod(p.period, s.period));
  const shown = s.period ?? (bounds && { from: bounds.first, to: bounds.last });

  return html`
    <div class="page-actions">
      <div class="period">
        <button type="button" class="btn" aria-label="Vorheriger Zeitraum" ?disabled=${!prev} @click=${() => actions.setPeriod(prev!)}>
          ${icon('chevronLeft', 16)}
        </button>
        <span class="period-label" aria-live="polite">
          <span class="desktop-only">${periodLabel(shown)}</span><span class="mobile-only">${shown ? periodLabelShort(shown) : ''}</span>
        </span>
        <button type="button" class="btn" aria-label="Nächster Zeitraum" ?disabled=${!next} @click=${() => actions.setPeriod(next!)}>
          ${icon('chevronRight', 16)}
        </button>
      </div>
      <select class="select" aria-label="Zeitraum wählen"
        @change=${(e: Event) => {
          const id = (e.target as HTMLSelectElement).value;
          const preset = presets.find((p) => p.id === id);
          if (preset) actions.setPeriod(preset.period);
        }}>
        ${presets.map((p) => html`<option value=${p.id} ?selected=${p === current}>${p.label}</option>`)}
        ${current ? nothing : html`<option value="" selected disabled>Eigener Zeitraum</option>`}
      </select>
    </div>
  `;
}

function bottomNav(route: Route, sheetOpen: boolean, toggleSheet: () => void): TemplateResult {
  const inMore = MORE.some((a) => a.id === route.area.id);
  return html`
    ${MOBILE.map((id) => {
      const a = AREAS.find((x) => x.id === id)!;
      return html`<a href=${href(a.id)} aria-current=${a.id === route.area.id ? 'page' : 'false'}>${icon(a.icon, 22)}${a.short}</a>`;
    })}
    <button type="button" aria-current=${inMore ? 'page' : 'false'} aria-expanded=${sheetOpen ? 'true' : 'false'}
      aria-controls="more-sheet" @click=${toggleSheet}>${icon('more', 22)}Mehr</button>
  `;
}

function sheet(route: Route, close: () => void, onReset: () => void): TemplateResult {
  return html`
    <div class="sheet-backdrop" @click=${close}></div>
    <div class="sheet" id="more-sheet" role="dialog" aria-modal="true" aria-label="Weitere Bereiche">
      <div class="sheet-handle"></div>
      <ul class="nav">
        ${MORE.map((a) => html`<li>${navLink(a, route)}</li>`)}
        <li><button type="button" class="nav-item" @click=${onReset}>${icon('upload')}<span class="nav-label">Neue Datei laden</span></button></li>
      </ul>
    </div>
  `;
}
