import { html, nothing, type TemplateResult } from 'lit-html';
import { icon, type IconName } from './icons';

/** Small, stateless lit-html building blocks shared by every page. */

type Content = TemplateResult | string | typeof nothing;

export interface CardOptions {
  title: string;
  sub?: Content;
  actions?: Content;
  flush?: boolean;
}

export function card(o: CardOptions, body: Content): TemplateResult {
  return html`
    <section class="card ${o.flush ? 'card--flush' : ''}">
      <div class="card-head">
        <div>
          <h2 class="card-title">${o.title}</h2>
          ${o.sub ? html`<p class="card-sub">${o.sub}</p>` : nothing}
        </div>
        ${o.actions ?? nothing}
      </div>
      ${body}
    </section>
  `;
}

export type Series = 'income' | 'expense' | 'invest' | 'dividend';

export interface Kpi {
  label: string;
  value: string;
  sub?: string;
  dot?: Series;
  status?: 'good' | 'warn';
}

export function kpiTile(k: Kpi): TemplateResult {
  return html`
    <div class="kpi">
      <div class="kpi-label">${k.dot ? html`<span class="dot dot--${k.dot}"></span>` : nothing}${k.label}</div>
      <div class="kpi-value">${k.value}</div>
      ${k.sub
        ? html`<div class="kpi-sub">${k.status ? statusIcon(k.status) : nothing}${k.sub}</div>`
        : nothing}
    </div>
  `;
}

export function kpiGrid(kpis: Kpi[]): TemplateResult {
  return html`<section class="grid grid--kpi ${kpis.length === 3 ? 'grid--kpi-3' : ''}" aria-label="Kennzahlen">${kpis.map(kpiTile)}</section>`;
}

/** ✓ / ⚠ next to a judged value — never color alone. */
export function statusIcon(status: 'good' | 'warn'): TemplateResult {
  return html`<span class="status-${status}" role="img" aria-label=${status === 'good' ? 'im Zielbereich' : 'unter Ziel'}
    >${icon(status === 'good' ? 'checkCircle' : 'alertTriangle', 14)}</span>`;
}

/**
 * A sized box for a Chart.js canvas; `key` is how the page finds it after render.
 * Multi-series charts pass `series`: the legend then always sits in the same place,
 * left-aligned between card header and plot (Chart.js' own legend is not registered).
 */
export function chartBox(key: string, label: string, size: '' | 'sm' | 'lg' = '', series?: LegendItem[]): TemplateResult {
  const box = html`<div class="chart ${size ? `chart--${size}` : ''}"><canvas data-chart=${key} role="img" aria-label=${label}></canvas></div>`;
  return series?.length ? html`<div class="chart-block">${legend(series)}${box}</div>` : box;
}

export function getCanvas(root: HTMLElement, key: string): HTMLCanvasElement | null {
  return root.querySelector<HTMLCanvasElement>(`canvas[data-chart="${key}"]`);
}

export interface SegOption<T extends string> {
  value: T;
  label: string;
}

export function segmented<T extends string>(
  label: string, options: SegOption<T>[], current: T, pick: (v: T) => void,
): TemplateResult {
  return html`
    <div class="seg" role="group" aria-label=${label}>
      ${options.map((o) => html`
        <button type="button" aria-pressed=${o.value === current ? 'true' : 'false'} @click=${() => pick(o.value)}>${o.label}</button>
      `)}
    </div>
  `;
}

export interface LegendItem {
  label: string;
  color: string;
  /** Swatch shape mirrors the mark: filled box (bars, areas), solid or dashed line. */
  mark?: 'box' | 'line' | 'dash';
}

export function legend(items: LegendItem[]): TemplateResult {
  return html`<ul class="legend" aria-label="Legende">${items.map((i) => html`
    <li><span class="swatch ${i.mark && i.mark !== 'box' ? `swatch--${i.mark}` : ''}" style="--c:${i.color}"></span>${i.label}</li>`)}</ul>`;
}

export interface BarRow {
  label: string;
  value: string;
  share: string;
  /** Swatch color (identity) — omit for a plain list with a neutral bar. */
  color?: string;
  /** Bar length 0–100; omit to hide the bar. */
  pct?: number;
  /** Bar color when there is no swatch color. */
  barColor?: string;
  sub?: string;
}

export function barList(rows: BarRow[]): TemplateResult {
  const plain = rows.every((r) => !r.color);
  return html`
    <ul class="barlist ${plain ? 'barlist--plain' : ''}">
      ${rows.map((r) => html`
        <li>
          ${r.color ? html`<span class="swatch" style="--c:${r.color}"></span>` : nothing}
          <span class="row-title" title=${r.label}>${r.label}${r.sub ? html` <span class="muted">${r.sub}</span>` : nothing}</span>
          <span class="row-value">${r.value}</span>
          <span class="share">${r.share}</span>
          ${r.pct !== undefined
            ? html`<span class="bar"><span style="width:${Math.max(0, Math.min(100, r.pct))}%;--c:${r.color ?? r.barColor ?? 'var(--text-3)'}"></span></span>`
            : nothing}
        </li>
      `)}
    </ul>
  `;
}

export type InsightColor = 'green' | 'yellow' | 'red' | 'blue';

const TONE: Record<InsightColor, { cls: string; icon: IconName; label: string }> = {
  green: { cls: 'tone-good', icon: 'check', label: 'Positiv' },
  yellow: { cls: 'tone-warn', icon: 'alert', label: 'Hinweis' },
  red: { cls: 'tone-bad', icon: 'alertTriangle', label: 'Warnung' },
  blue: { cls: 'tone-info', icon: 'info', label: 'Info' },
};

export function insight(color: InsightColor, title: string, desc: string): TemplateResult {
  const t = TONE[color];
  return html`
    <div class="insight ${t.cls}">
      <span class="insight-icon" role="img" aria-label=${t.label}>${icon(t.icon, 16)}</span>
      <div>
        <div class="insight-title">${title}</div>
        <div class="insight-desc">${desc}</div>
      </div>
    </div>
  `;
}

export function emptyState(title: string, text = ''): TemplateResult {
  return html`<div class="empty"><strong>${title}</strong>${text}</div>`;
}

/** ▲/▼ after a value; `goodWhen` decides whether the direction is good (green) or bad (red). */
export function deltaMark(dir: 'up' | 'down' | null, goodWhen: 'up' | 'down' = 'up'): TemplateResult | typeof nothing {
  if (!dir) return nothing;
  const good = dir === goodWhen;
  return html`<span class="delta ${good ? 'delta--good' : 'delta--bad'}" aria-label=${dir === 'up' ? 'gestiegen' : 'gesunken'}
    >${dir === 'up' ? '▲' : '▼'}</span>`;
}
