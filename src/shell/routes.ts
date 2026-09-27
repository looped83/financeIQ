import type { IconName } from '../ui/icons';

export type AreaId = 'uebersicht' | 'cashflow' | 'ausgaben' | 'investments' | 'vergleich' | 'transaktionen';

export interface SubPage {
  id: string;
  label: string;
  /** Pages that always need the whole history (forecast, comparisons) ignore the period. */
  usesPeriod: boolean;
}

export interface Area {
  id: AreaId;
  label: string;
  /** Label in the mobile bottom bar, where space is tight. */
  short: string;
  icon: IconName;
  /** Shown in the mobile bottom bar; the rest live in the "Mehr" sheet. */
  mobile: boolean;
  usesPeriod: boolean;
  subs?: SubPage[];
}

export const AREAS: Area[] = [
  { id: 'uebersicht', label: 'Übersicht', short: 'Übersicht', icon: 'overview', mobile: true, usesPeriod: true },
  {
    id: 'cashflow', label: 'Cashflow', short: 'Cashflow', icon: 'cashflow', mobile: true, usesPeriod: true,
    subs: [
      { id: 'verlauf', label: 'Verlauf', usesPeriod: true },
      { id: 'monate', label: 'Monate', usesPeriod: true },
      { id: 'prognose', label: 'Prognose', usesPeriod: false },
    ],
  },
  { id: 'ausgaben', label: 'Ausgaben', short: 'Ausgaben', icon: 'spending', mobile: true, usesPeriod: true },
  { id: 'investments', label: 'Investment', short: 'Investment', icon: 'invest', mobile: false, usesPeriod: true },
  {
    id: 'vergleich', label: 'Vergleich', short: 'Vergleich', icon: 'compare', mobile: false, usesPeriod: false,
    subs: [
      { id: 'monate', label: 'Monate', usesPeriod: false },
      { id: 'jahre', label: 'Jahre', usesPeriod: false },
    ],
  },
  { id: 'transaktionen', label: 'Buchungen', short: 'Buchungen', icon: 'list', mobile: true, usesPeriod: true },
];

export interface Route {
  area: Area;
  sub: SubPage | undefined;
  /** Stable page id, e.g. "cashflow/monate" — one lazily mounted page per key. */
  key: string;
  usesPeriod: boolean;
}

export function href(area: AreaId, sub?: string): string {
  return sub ? `#/${area}/${sub}` : `#/${area}`;
}

/** Parses "#/area/sub"; unknown areas fall back to the Übersicht, unknown subs to the area's first. */
export function resolveRoute(hash: string): Route {
  const [areaId, subId] = hash.replace(/^#\/?/, '').split('/');
  const area = AREAS.find((a) => a.id === areaId) ?? AREAS[0]!;
  const sub = area.subs ? area.subs.find((s) => s.id === subId) ?? area.subs[0] : undefined;
  return {
    area,
    sub,
    key: sub ? `${area.id}/${sub.id}` : area.id,
    usesPeriod: sub ? sub.usesPeriod : area.usesPeriod,
  };
}
