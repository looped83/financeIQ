import { linReg } from '../../domain/stats';
import { fmt, mLabel } from '../../domain/format';
import type { Analysis } from '../../domain/types';

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

export interface ForecastScenario {
  color: 'green' | 'blue' | 'yellow';
  title: string;
  desc: string;
}

export interface ForecastResult {
  chart: ForecastChartData;
  kpis: ForecastKpi[];
  scenarios: ForecastScenario[];
}

/** Linear-trend cashflow forecast with a 95% confidence band, `months` ahead. */
export function computeForecast(a: Analysis, months: number): ForecastResult {
  const nets = a.mKeys.map((m) => a.months[m]?.net ?? 0);
  let cum = 0;
  const cumAct = nets.map((v) => (cum += v));
  const { slope, intercept, resStd } = linReg(nets);

  const histLbls = a.mKeys.map(mLabel);
  const lastI = a.mKeys.length - 1;
  const lastDate = new Date(a.mKeys[lastI] + '-01');
  const lastActual = cumAct[cumAct.length - 1] ?? 0;

  const fcLbls: string[] = [];
  const fcD: number[] = [];
  const fcU: number[] = [];
  const fcL: number[] = [];
  let rc = lastActual;
  for (let i = 1; i <= months; i++) {
    const nd = new Date(lastDate);
    nd.setMonth(nd.getMonth() + i);
    fcLbls.push(nd.toLocaleDateString('de-DE', { month: 'short', year: '2-digit' }));
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
      sub: slope >= 0 ? 'Wachsend ↑' : 'Abnehmend ↓',
    },
    {
      label: `Proj. Zuwachs (${months}M)`, value: fmt(projEnd - a.netBal), cls: 'invest',
      sub: `Prognosewert: ${fmt(projEnd)}`,
    },
    {
      label: 'Aktueller Saldo', value: fmt(a.netBal), cls: a.netBal >= 0 ? 'income' : 'expense',
      sub: `Basis: ${a.mc} Monate Daten`,
    },
  ];

  const optSlope = slope + resStd * 0.5;
  const pesSlope = slope - resStd * 0.5;
  let optCum = lastActual;
  let pesCum = lastActual;
  for (let i = 1; i <= months; i++) {
    optCum += optSlope * (lastI + i) + intercept;
    pesCum += pesSlope * (lastI + i) + intercept;
  }

  const scenarios: ForecastScenario[] = [
    {
      color: 'green', title: 'Optimistisches Szenario',
      desc: `Bei +0.5σ Wachstum: <strong>${fmt(optCum)}</strong> nach ${months} Monaten (+${fmt(optCum - a.netBal)} zum Ist).`,
    },
    {
      color: 'blue', title: 'Basisszenario (Lineartrend)',
      desc: `Auf Basis historischer Daten: <strong>${fmt(projEnd)}</strong> nach ${months} Monaten.`,
    },
    {
      color: 'yellow', title: 'Pessimistisches Szenario',
      desc: `Bei -0.5σ: <strong>${fmt(pesCum)}</strong> nach ${months} Monaten. Ausgaben-Puffer einplanen.`,
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
