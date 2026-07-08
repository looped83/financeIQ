import { fmt, fmtP, typeLabel } from '../../domain/format';
import type { Analysis } from '../../domain/types';

export type RecommendationLevel = 'green' | 'yellow' | 'red' | 'blue';

export interface Recommendation {
  level: RecommendationLevel;
  priority: number;
  category: string;
  title: string;
  desc: string;
}

/** 1:1 port of the original's `renderRecommendations(a)` — 15 recommendation rules, each
 *  pushed conditionally, then sorted ascending by priority (lower = more urgent). */
export function computeRecommendations(a: Analysis): Recommendation[] {
  const recs: Recommendation[] = [];
  const sr = a.totalInc > 0 ? (a.netBal / a.totalInc) * 100 : 0;
  const ir = a.totalInc > 0 ? (a.totalInv / a.totalInc) * 100 : 0;
  const avgMonthlyExp = Math.abs(a.totalExp) / a.mc;
  const avgMonthlyInc = a.totalInc / a.mc;

  // 1. Cashflow status
  if (a.netBal < 0) {
    const top3 = Object.entries(a.expCat).sort((x, y) => y[1] - x[1]).slice(0, 3);
    recs.push({
      level: 'red', priority: 1, category: 'Cashflow', title: 'Negativer Cashflow — sofort handeln',
      desc: `Ausgaben (${fmt(Math.abs(a.totalExp))}) übersteigen Einnahmen (${fmt(a.totalInc)}) um ${fmt(Math.abs(a.netBal))}. Größte Posten: ${top3.map(([k, v]) => `${k}: ${fmt(v)}`).join(', ')}. Sofort: Top-3-Kategorien um 10% reduzieren spart ${fmt(top3.reduce((s, [, v]) => s + v * 0.1, 0))}.`,
    });
  } else {
    recs.push({
      level: 'green', priority: 6, category: 'Cashflow', title: 'Positiver Cashflow',
      desc: `Einnahmen übersteigen Ausgaben um ${fmt(a.netBal)} (Sparquote: ${fmtP(sr)}). Überschüsse gezielt investieren.`,
    });
  }

  // 2. Savings rate
  if (sr < 10 && a.netBal >= 0) {
    recs.push({
      level: 'yellow', priority: 2, category: 'Sparen', title: 'Sparquote unter 10% — steigern',
      desc: `Aktuell ${fmtP(sr)}. Ziel: 20%+. Monatlich ${fmt(avgMonthlyInc * 0.2)} für Investitionen reservieren. Konkret: ${fmt(avgMonthlyInc * 0.2 - a.avgNet)} mehr sparen durch Fixkosten-Reduktion.`,
    });
  } else if (sr >= 10 && sr < 20) {
    recs.push({
      level: 'yellow', priority: 3, category: 'Sparen', title: `Sparquote ${fmtP(sr)} — weiter steigern`,
      desc: `Guter Anfang, aber unter dem Zielwert von 20%. Noch ${fmt(avgMonthlyInc * 0.2 - a.avgNet)}/Monat mehr sparen. Tipp: Automatischen Dauerauftrag auf Spar-/Investmentkonto einrichten.`,
    });
  } else if (sr >= 20 && sr < 35) {
    recs.push({
      level: 'green', priority: 5, category: 'Sparen', title: `Starke Sparquote: ${fmtP(sr)}`,
      desc: `Über dem 20%-Ziel. ${fmt(a.avgNet)}/Monat verfügbar für Vermögensaufbau. Nächstes Ziel: 35% für beschleunigten Vermögensaufbau.`,
    });
  } else if (sr >= 35) {
    recs.push({
      level: 'green', priority: 6, category: 'Sparen', title: `Exzellente Sparquote: ${fmtP(sr)}`,
      desc: `Weit über dem Ziel. Bei diesem Tempo in ${Math.round((25 * (1 - sr / 100)) / (sr / 100))} Jahren finanziell unabhängig (4%-Regel). Fokus auf optimale Anlageallokation.`,
    });
  }

  // 3. Investment rate
  if (ir < 15) {
    recs.push({
      level: 'yellow', priority: 2, category: 'Investieren', title: `Investitionsrate ${fmtP(ir)} — Potenzial vorhanden`,
      desc: `Zielwert: 15–25% des Einkommens. Aktuell ${fmt(a.totalInv / a.mc)}/Monat — Sparplan auf ${fmt(avgMonthlyInc * 0.2)}/Monat erhöhen. Automatische Sparpläne sind gebührenfrei und disziplinieren.`,
    });
  } else {
    recs.push({
      level: 'green', priority: 4, category: 'Investieren', title: `Gute Investitionsrate: ${fmtP(ir)}`,
      desc: `${fmt(a.totalInv)} investiert (${fmt(a.totalInv / a.mc)}/Mo). Asset-Allokation regelmäßig prüfen, Rebalancing 1–2× jährlich empfohlen.`,
    });
  }

  // 4. Dividends
  if (a.totalDiv > 0) {
    const divYield = a.totalInv > 0 ? (a.totalDiv / a.totalInv) * 100 : 0;
    const divMonthly = a.totalDiv / a.mc;
    const divCoverage = avgMonthlyExp > 0 ? (divMonthly / avgMonthlyExp) * 100 : 0;
    recs.push({
      level: 'green', priority: 3, category: 'Dividenden', title: 'Dividenden-Portfolio wächst',
      desc: `${fmt(a.totalDiv)} Dividenden aus ${Object.keys(a.byAsset).length} Positionen (${fmtP(divYield)} auf Invest). Ø ${fmt(divMonthly)}/Monat decken ${fmtP(divCoverage)} der Ausgaben. Reinvestition maximiert den Zinseszinseffekt.`,
    });
    const topDiv = Object.entries(a.byAsset).sort((x, y) => y[1].total - x[1].total)[0];
    if (topDiv && topDiv[1].total / a.totalDiv > 0.3) {
      recs.push({
        level: 'yellow', priority: 3, category: 'Dividenden', title: 'Dividenden-Klumpenrisiko',
        desc: `${topDiv[0]} macht ${((topDiv[1].total / a.totalDiv) * 100).toFixed(1)}% aller Dividenden aus. Max. 25% pro Position empfohlen. Diversifikation in andere Sektoren/Regionen senkt das Risiko.`,
      });
    }
  }

  // 5. Fees
  if (a.totalFee > 0) {
    const fr = a.totalInv > 0 ? (a.totalFee / a.totalInv) * 100 : 0;
    if (fr > 0.3) {
      recs.push({
        level: 'yellow', priority: 2, category: 'Kosten', title: `Gebühren optimieren: ${fmt(a.totalFee)} (${fmtP(fr)})`,
        desc: `Bei ${fmt(a.totalInv)} Investvolumen kosten Gebühren langfristig erheblich Rendite. Sparpläne (oft kostenlos) statt Einzelorders nutzen. Hochrechnung: ${fmt((a.totalFee / a.mc) * 12)}/Jahr an Gebühren.`,
      });
    } else {
      recs.push({
        level: 'green', priority: 5, category: 'Kosten', title: `Gebühren im Griff: ${fmt(a.totalFee)} (${fmtP(fr)})`,
        desc: 'Niedrige Gebührenquote. Weiterhin auf kosteneffiziente Instrumente (ETFs, Sparpläne) setzen.',
      });
    }
  }

  // 6. Large expenses
  const bigExp = a.exp.filter((r) => Math.abs(r._amt) > 500);
  if (bigExp.length) {
    const sorted = [...bigExp].sort((x, y) => Math.abs(y._amt) - Math.abs(x._amt));
    recs.push({
      level: 'yellow', priority: 2, category: 'Ausgaben', title: `${bigExp.length} Großausgaben >500€`,
      desc: `Gesamt: ${fmt(bigExp.reduce((s, r) => s + Math.abs(r._amt), 0))}. Top: ${sorted.slice(0, 3).map((r) => `${r._name || typeLabel(r._type)}: ${fmt(Math.abs(r._amt))}`).join(', ')}. Notfallrücklage 3–6 Monatsausgaben (${fmt(avgMonthlyExp * 4)}) empfohlen.`,
    });
  }

  // 8. Subscriptions
  if (a.subscriptions.length > 0) {
    const subSum = a.subscriptions.reduce((s, x) => s + x.amt, 0);
    const subPct = avgMonthlyExp > 0 ? (subSum / avgMonthlyExp) * 100 : 0;
    recs.push({
      level: 'yellow', priority: 3, category: 'Fixkosten', title: `${a.subscriptions.length} wiederkehrende Ausgaben — ${fmt(subSum)}/Monat`,
      desc: `Hochrechnung: ${fmt(subSum * 12)}/Jahr (${fmtP(subPct)} der Ausgaben). Top: ${a.subscriptions.slice(0, 3).map((s) => `${s.name} (${fmt(s.amt)})`).join(', ')}. Tipp: Jeden Posten auf Notwendigkeit prüfen — ungenutzte Dienste kündigen spart direkt.`,
    });
    if (subSum > avgMonthlyExp * 0.2) {
      recs.push({
        level: 'yellow', priority: 2, category: 'Fixkosten', title: 'Wiederkehrende Ausgaben über 20%',
        desc: `Fixe Zahlungen binden ${fmtP(subPct)} der monatlichen Ausgaben. Jährliche Zahlweise nutzen (oft 15–20% Rabatt). Alternativ: günstigere Anbieter oder Tarife prüfen.`,
      });
    }
  }

  // 9. Volatility
  const nets = a.mKeys.map((m) => a.months[m]?.net ?? 0);
  const nStd = Math.sqrt(nets.reduce((s, v) => s + Math.pow(v - a.avgNet, 2), 0) / nets.length);
  if (nStd > Math.abs(a.avgNet) * 1.5 && a.avgNet !== 0) {
    recs.push({
      level: 'yellow', priority: 3, category: 'Stabilität', title: 'Hohe Cashflow-Volatilität',
      desc: `Monatliche Schwankung σ=${fmt(nStd)} — deutlich über dem Mittelwert von ${fmt(a.avgNet)}. Bandbreite: ${fmt(Math.min(...nets))} bis ${fmt(Math.max(...nets))}. Liquiditätspuffer von 2–3 Monatsdurchschnitten (${fmt(avgMonthlyExp * 2.5)}) empfohlen.`,
    });
  }

  // 10. Portfolio diversification
  const assetCount = Object.keys(a.byAsset).length;
  if (assetCount >= 5) {
    recs.push({
      level: 'green', priority: 5, category: 'Portfolio', title: 'Gute Portfolio-Diversifikation',
      desc: `${assetCount} verschiedene Dividendenpositionen. Weiterhin auf Sektor- und Länderstreuung achten.`,
    });
  } else if (assetCount > 0 && assetCount < 5) {
    recs.push({
      level: 'yellow', priority: 3, category: 'Portfolio', title: `Nur ${assetCount} Dividendenpositionen — diversifizieren`,
      desc: 'Wenige Positionen erhöhen das Klumpenrisiko. Ziel: 10+ Positionen über verschiedene Sektoren und Regionen. Breit gestreute Dividenden-ETFs als Basis nutzen.',
    });
  }

  // 11. Card spending analysis
  const cardTotal = a.exp.filter((r) => r._isCard).reduce((s, r) => s + Math.abs(r._amt), 0);
  const cardRatio = Math.abs(a.totalExp) > 0 ? (cardTotal / Math.abs(a.totalExp)) * 100 : 0;
  if (cardRatio > 60) {
    recs.push({
      level: 'blue', priority: 4, category: 'Verhalten', title: `${fmtP(cardRatio)} Kartenzahlungen — bewusst ausgeben`,
      desc: `Hoher Kartenanteil kann zu unbewussten Ausgaben führen. Tipp: Wochenbudget für Karte festlegen. Ø ${fmt(cardTotal / a.mc)}/Monat über Karte — prüfen, ob bar/Überweisung für manche Kategorien besser kontrollierbar wäre.`,
    });
  }

  // 12. Emergency fund
  const monthlyNet = a.avgNet;
  if (monthlyNet > 0) {
    const target = avgMonthlyExp * 4;
    const monthsNeeded = target / monthlyNet;
    recs.push({
      level: monthlyNet > avgMonthlyExp * 0.2 ? 'green' : 'yellow', priority: 4, category: 'Rücklage',
      title: `Notfallrücklage: ${fmt(target)} ansparen`,
      desc: `Ziel: 3–6 Monatsausgaben (${fmt(avgMonthlyExp * 3)}–${fmt(avgMonthlyExp * 6)}). Bei aktuellem Überschuss (${fmt(monthlyNet)}/Mo) in ${monthsNeeded.toFixed(0)} Monaten erreichbar. Auf separatem Tagesgeldkonto parken.`,
    });
  }

  // 13. Spending trends
  if (a.mKeys.length >= 3) {
    const last3 = a.mKeys.slice(-3).map((mk) => Math.abs(a.months[mk]?.expense ?? 0));
    if (last3[2]! > last3[1]! && last3[1]! > last3[0]!) {
      const growth = last3[2]! - last3[0]!;
      recs.push({
        level: 'yellow', priority: 2, category: 'Trend', title: 'Ausgaben 3 Monate steigend',
        desc: `${fmt(last3[0]!)} → ${fmt(last3[1]!)} → ${fmt(last3[2]!)} — Anstieg um ${fmt(growth)} in 3 Monaten. Wenn dieser Trend anhält, steigen die Jahresausgaben um ${fmt(growth * 4)}. Jetzt gegensteuern.`,
      });
    }
    const last3Inc = a.mKeys.slice(-3).map((mk) => a.months[mk]?.income ?? 0);
    if (last3Inc[2]! > last3Inc[1]! && last3Inc[1]! > last3Inc[0]!) {
      recs.push({
        level: 'green', priority: 5, category: 'Trend', title: 'Einnahmen 3 Monate steigend',
        desc: `Positiver Einnahmentrend: ${last3Inc.map((v) => fmt(v)).join(' → ')}. Zusätzliche Einnahmen direkt in Investitionen oder Rücklagen lenken.`,
      });
    }
  }

  // 14. Merchant concentration
  const topMerch = Object.entries(a.merchants).sort((x, y) => y[1].total - x[1].total);
  if (topMerch.length >= 3) {
    const top3Total = topMerch.slice(0, 3).reduce((s, [, v]) => s + v.total, 0);
    const top3Pct = Math.abs(a.totalExp) > 0 ? (top3Total / Math.abs(a.totalExp)) * 100 : 0;
    if (top3Pct > 30) {
      recs.push({
        level: 'blue', priority: 4, category: 'Ausgaben', title: `Top-3-Händler: ${fmtP(top3Pct)} der Ausgaben`,
        desc: `${topMerch.slice(0, 3).map(([nm, v]) => `${nm}: ${fmt(v.total)}`).join(', ')}. Bei hoher Konzentration: Preise vergleichen, Cashback-Optionen prüfen, Alternativen evaluieren.`,
      });
    }
  }

  // 15. Weekend spending
  const weekdayExp = a.exp.filter((r) => r._date && r._date.getDay() >= 1 && r._date.getDay() <= 5).reduce((s, r) => s + Math.abs(r._amt), 0);
  const weekendExp = a.exp.filter((r) => r._date && (r._date.getDay() === 0 || r._date.getDay() === 6)).reduce((s, r) => s + Math.abs(r._amt), 0);
  if (weekendExp > 0 && weekdayExp > 0) {
    const weDays = a.mc * 8.7;
    const wdDays = a.mc * 21.7;
    const weDaily = weekendExp / weDays;
    const wdDaily = weekdayExp / wdDays;
    if (weDaily > wdDaily * 1.5) {
      recs.push({
        level: 'blue', priority: 4, category: 'Verhalten', title: `Wochenende: ${fmtP((weDaily / wdDaily) * 100 - 100)} höhere Tagesausgaben`,
        desc: `Ø ${fmt(weDaily)}/Tag am Wochenende vs. ${fmt(wdDaily)}/Tag unter der Woche. Wochenend-Budget setzen kann helfen, impulsive Ausgaben zu reduzieren.`,
      });
    }
  }

  return recs.sort((x, y) => x.priority - y.priority);
}
