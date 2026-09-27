import { linReg } from '../../domain/stats';
import { fmt, mLabel } from '../../domain/format';
import { addMonths } from '../../domain/period';
import type { Analysis, Hint } from '../../domain/types';

export interface ForecastChartData {
  labels: string[];
  historical: (number | null)[];
  forecast: (number | null)[];
  ciUpper: (number | null)[];
  ciLower: (number | null)[];
}

export interface ForecastKpi {
  label: string;
  value: string;
  cls: 'income' | 'expense' | 'invest';
  sub: string;
}

export interface ForecastResult {
  chart: ForecastChartData;
  kpis: ForecastKpi[];
  scenarios: Hint[];
}

/** Linear-trend cashflow forecast with a 95% confidence band, `months` ahead. */
export function computeForecast(a: Analysis, months: number): ForecastResult {
  const nets = a.mKeys.map((m) => a.months[m]?.net ?? 0);
  let cum = 0;
  const cumAct = nets.map((v) => (cum += v));
  const { slope, intercept, resStd } = linReg(nets);

  const histLbls = a.mKeys.map(mLabel);
  const lastI = a.mKeys.length - 1;
  const lastMonth = a.mKeys[lastI]!;
  const lastActual = cumAct[cumAct.length - 1] ?? 0;

  const fcLbls: string[] = [];
  const fcD: number[] = [];
  const fcU: number[] = [];
  const fcL: number[] = [];
  let rc = lastActual;
  for (let i = 1; i <= months; i++) {
    fcLbls.push(mLabel(addMonths(lastMonth, i)));
    rc += slope * (lastI + i) + intercept;
    fcD.push(rc);
    const ci = resStd * Math.sqrt(i) * 1.96;
    fcU.push(rc + ci);
    fcL.push(rc - ci);
  }

  const pad = (n: number): null[] => Array(n).fill(null);
  const projEnd = fcD[fcD.length - 1] ?? lastActual;

  const kpis: ForecastKpi[] = [
    {
      label: 'Monatlicher Trend', value: fmt(slope), cls: slope >= 0 ? 'income' : 'expense',
      sub: slope >= 0 ? 'Netto pro Monat wächst' : 'Netto pro Monat sinkt',
    },
    {
      label: 'Erwarteter Zuwachs', value: fmt(projEnd - lastActual), cls: 'invest',
      sub: `in ${months} Monaten auf ${fmt(projEnd)}`,
    },
    {
      label: 'Aktueller Saldo', value: fmt(a.netBal), cls: a.netBal >= 0 ? 'income' : 'expense',
      sub: `Basis: ${a.mc} Monate Daten`,
    },
  ];

  // Scenarios are the ends of the confidence band, so text and chart always agree.
  const upper = fcU[fcU.length - 1] ?? lastActual;
  const lower = fcL[fcL.length - 1] ?? lastActual;
  const scenarios: Hint[] = [
    {
      color: 'green', title: 'Optimistisches Szenario',
      desc: `Oberes Ende des 95-%-Bands: ${fmt(upper)} nach ${months} Monaten (${fmt(upper - lastActual)} Zuwachs).`,
    },
    {
      color: 'blue', title: 'Basisszenario (Lineartrend)',
      desc: `Fortgeschriebener Trend: ${fmt(projEnd)} nach ${months} Monaten.`,
    },
    {
      color: 'yellow', title: 'Pessimistisches Szenario',
      desc: `Unteres Ende des 95-%-Bands: ${fmt(lower)} nach ${months} Monaten. Ausgaben-Puffer einplanen.`,
    },
  ];
  return {
    chart: {
      labels: [...histLbls, ...fcLbls],
      historical: [...cumAct, ...pad(months)],
      forecast: [...pad(lastI), lastActual, ...fcD],
      ciUpper: [...pad(lastI), lastActual, ...fcU],
      ciLower: [...pad(lastI), lastActual, ...fcL],
    },
    kpis,
    scenarios,
  };
}
