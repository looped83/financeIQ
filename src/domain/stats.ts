export interface LinRegResult {
  slope: number;
  intercept: number;
  resStd: number;
}

/** Ordinary least-squares linear regression of `ys` against their index (0, 1, 2, ...). */
export function linReg(ys: number[]): LinRegResult {
  const n = ys.length;
  const xs = ys.map((_, i) => i);
  const sX = xs.reduce((s, v) => s + v, 0);
  const sY = ys.reduce((s, v) => s + v, 0);
  const sXY = xs.reduce((s, v, i) => s + v * ys[i]!, 0);
  const sXX = xs.reduce((s, v) => s + v * v, 0);
  const slope = (n * sXY - sX * sY) / (n * sXX - sX * sX);
  const intercept = (sY - slope * sX) / n;
  const resStd = Math.sqrt(
    ys.map((y, i) => Math.pow(y - (slope * i + intercept), 2)).reduce((s, v) => s + v, 0) / n,
  );
  return { slope, intercept, resStd };
}
