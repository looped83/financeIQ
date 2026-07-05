import { html, render, type TemplateResult } from 'lit-html';
import type { Analysis } from '../../domain/types';
import type { AppState } from '../../state/appState';
import type { Store } from '../../state/store';
import { computeRecommendations, type RecommendationLevel } from './selectors';

export function mountRecommendationsView(container: HTMLElement, store: Store<AppState>): () => void {
  const rerender = () => render(view(store.getState().analysis), container);
  rerender();
  return store.subscribe(rerender);
}

const BADGE_CLASS: Record<RecommendationLevel, string> = {
  red: 'br', green: 'bg', blue: 'bb', yellow: 'by',
};

function view(a: Analysis | null): TemplateResult {
  if (!a) return html`<p style="color:var(--text-muted)">Keine Daten geladen.</p>`;

  const recs = computeRecommendations(a);

  return html`
    <div style="margin-bottom:1rem;color:var(--text-muted);font-size:.82rem;">${recs.length} Empfehlungen — priorisiert nach Handlungsbedarf</div>
    ${recs.map((r) => html`
      <div class="insight" style="margin-bottom:.7rem">
        <div class="dot ${r.level}"></div>
        <div style="flex:1">
          <div class="ins-title" style="display:flex;align-items:center;gap:.5rem">
            ${r.title}
            <span class="badge ${BADGE_CLASS[r.level]}">${r.category || 'Empfohlen'}</span>
          </div>
          <div class="ins-desc">${r.desc}</div>
        </div>
      </div>
    `)}
  `;
}
