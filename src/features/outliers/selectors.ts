import { fmt, fmtD, typeLabel } from '../../domain/format';
import type { Analysis } from '../../domain/types';

export interface OutlierKpi {
  label: string;
  value: string;
  cls: string;
  sub: string;
}

export function getOutlierKpis(a: Analysis): OutlierKpi[] {
  const top = a.outliers[0];
  return [
    { label: 'Erkannte Ausreißer', value: String(a.outliers.length), cls: 'expense', sub: '>2σ Transaktionen' },
    { label: 'Stärkstes Signal', value: top ? fmt(Math.abs(top._amt)) : '—', cls: 'neutral', sub: top ? top._name || top._type : '—' },
    { label: 'Stichproben-Ø', value: fmt(a.mean), cls: 'neutral', sub: `σ = ${fmt(a.std)}` },
    { label: 'Wiederkehrend erkannt', value: String(a.subscriptions.length), cls: 'warn', sub: 'Wiederkehrende Ausgaben' },
  ];
}

export interface RiskLight {
  color: 'red' | 'yellow' | 'green';
  title: string;
  desc: string;
}

export function computeRiskLights(a: Analysis): RiskLight[] {
  const risks: RiskLight[] = [];

  if (a.netBal < 0) {
    risks.push({ color: 'red', title: 'Negativer Gesamtsaldo', desc: `Ausgaben überschreiten Einnahmen um ${fmt(Math.abs(a.netBal))}. Sofortmaßnahmen empfohlen.` });
  }
  const cardTotal = a.exp.filter((r) => r._isCard).reduce((s, r) => s + Math.abs(r._amt), 0);
  if (cardTotal > a.avgExp * a.mc * 0.4) {
    risks.push({
      color: 'yellow',
      title: 'Hoher Karten-Anteil',
      desc: `${fmt(cardTotal)} per Karte (${((cardTotal / Math.abs(a.totalExp)) * 100).toFixed(1)}% aller Ausgaben).`,
    });
  }
  if (a.totalFee > 200) {
    risks.push({ color: 'yellow', title: 'Handelsgebühren', desc: `${fmt(a.totalFee)} Gebühren — Sparplan statt Einzelorder erwägen.` });
  }
  if (a.totalDiv > 0) {
    risks.push({
      color: 'green',
      title: 'Passives Einkommen wächst',
      desc: `${fmt(a.totalDiv)} Dividenden aus ${Object.keys(a.byAsset).length} Positionen.`,
    });
  }
  if (a.totalInv > 0) {
    risks.push({ color: 'green', title: 'Regelmäßige Investitionen', desc: `${fmt(a.totalInv)} über ${a.mc} Monate — Vermögensaufbau aktiv.` });
  }

  return risks;
}

export interface OutlierTableRow {
  date: string;
  typeLabel: string;
  name: string;
  amount: string;
  amountPositive: boolean;
  zScore: string;
  badgeLabel: 'Kritisch' | 'Erhöht' | 'Auffällig';
  badgeCls: 'br' | 'by' | 'bb';
}

export function getOutlierTableRows(a: Analysis, limit = 35): OutlierTableRow[] {
  return a.outliers.slice(0, limit).map((r) => {
    const z = r._z;
    const badgeLabel = z > 4 ? 'Kritisch' : z > 3 ? 'Erhöht' : 'Auffällig';
    const badgeCls = z > 4 ? 'br' : z > 3 ? 'by' : 'bb';
    return {
      date: fmtD(r._date),
      typeLabel: typeLabel(r._type),
      name: r._name || r._desc || '—',
      amount: fmt(r._amt),
      amountPositive: r._amt >= 0,
      zScore: z.toFixed(2) + 'σ',
      badgeLabel,
      badgeCls,
    };
  });
}
