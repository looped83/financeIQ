import { html, render, type TemplateResult } from 'lit-html';
import type { Analysis } from '../../domain/types';
import { getRecurringExpenses } from '../shared/commonSelectors';
import type { AppState } from '../../state/appState';
import type { Store } from '../../state/store';
import { computeRiskLights, getOutlierKpis, getOutlierTableRows } from './selectors';

export function mountOutliersView(container: HTMLElement, store: Store<AppState>): () => void {
  const rerender = () => render(view(store.getState().analysis), container);
  rerender();
  return store.subscribe(rerender);
}

function view(a: Analysis | null): TemplateResult {
  if (!a) return html`<p style="color:var(--text-muted)">Keine Daten geladen.</p>`;

  const kpis = getOutlierKpis(a);
  const risks = computeRiskLights(a);
  const recurring = getRecurringExpenses(a, 15);
  const outliers = getOutlierTableRows(a, 35);

  return html`
    <div class="g4" style="margin-bottom:1.2rem;">
      ${kpis.map((k) => html`
        <div class="kpi ${k.cls}">
          <div class="kpi-label">${k.label}</div>
          <div class="kpi-value ${k.cls}" style="font-size:1.35rem">${k.value}</div>
          <div class="kpi-sub">${k.sub}</div>
        </div>
      `)}
    </div>
    <div class="g2" style="margin-bottom:1.2rem;">
      <div class="card">
        <div class="card-header"><span class="card-title">Risikoampel</span></div>
        <div>
          ${risks.map((r) => html`
            <div class="insight"><div class="dot ${r.color}"></div><div><div class="ins-title">${r.title}</div><div class="ins-desc">${r.desc}</div></div></div>
          `)}
        </div>
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title">Erkannte wiederkehrende Ausgaben</span></div>
        <div style="overflow-x:auto">
          <table class="dt">
            <thead><tr><th>Empfänger</th><th>Ø Betrag</th><th>Monate</th><th>Hochrechnung/Jahr</th></tr></thead>
            <tbody>${recurring.rows.map((s) => html`
              <tr><td>${s.name}</td><td class="neg">${s.perMonth}</td><td>${s.monthCount}×</td><td class="neg">${s.perYear}</td></tr>
            `)}</tbody>
          </table>
        </div>
      </div>
    </div>
    <div class="card">
      <div class="card-header"><span class="card-title">Statistische Ausreißer (&gt;2σ vom Durchschnitt)</span></div>
      <div style="overflow-x:auto">
        <table class="dt">
          <thead><tr><th>Datum</th><th>Typ</th><th>Name / Beschreibung</th><th>Betrag</th><th>Z-Score</th><th>Einstufung</th></tr></thead>
          <tbody>${outliers.map((r) => html`
            <tr>
              <td>${r.date}</td><td>${r.typeLabel}</td><td>${r.name}</td>
              <td class=${r.amountPositive ? 'pos' : 'neg'}>${r.amount}</td>
              <td>${r.zScore}</td>
              <td><span class="badge ${r.badgeCls}">${r.badgeLabel}</span></td>
            </tr>
          `)}</tbody>
        </table>
      </div>
    </div>
  `;
}
