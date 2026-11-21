
import { analyzeBews } from './bews-engine.ts';

type BewsState = Parameters<typeof analyzeBews>[0];

export interface BewsPanel {
  root: HTMLElement;
  refresh: () => void;
}

function displayPrice(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '—';
  return value.toLocaleString(undefined, {
    maximumFractionDigits: 4
  });
}

export function createBewsPanel(
  getState: () => BewsState
): BewsPanel {
  const root = document.createElement('section');

  root.style.cssText = [
    'position:fixed',
    'right:8px',
    'bottom:8px',
    'z-index:9999',
    'width:min(300px,calc(100vw - 16px))',
    'max-height:55vh',
    'overflow:auto',
    'font:12px/1.5 system-ui',
    'color:#f5f5f5',
    'background:#151923',
    'border:1px solid #687080',
    'border-radius:10px',
    'box-shadow:0 3px 15px #0008'
  ].join(';');

  const details = document.createElement('details');
  const summary = document.createElement('summary');

  summary.textContent = 'BEWS TRADE ENGINE · DIAGNOSTIC';
  summary.style.cssText =
    'padding:12px;cursor:pointer;font-weight:700;';

  const body = document.createElement('div');
  body.style.cssText = 'padding:0 12px 12px;';

  const direction = document.createElement('div');
  direction.style.cssText =
    'font-size:20px;font-weight:800;margin:6px 0;';

  const price = document.createElement('div');
  const timeframe = document.createElement('div');
  const indicators = document.createElement('div');
  const levels = document.createElement('div');
  const reason = document.createElement('p');
  const warning = document.createElement('p');

  warning.textContent =
    'TEST ONLY · Single selected timeframe. Not a validated trade signal.';

  warning.style.cssText =
    'color:#f0c674;font-size:11px;margin-top:12px;';

  reason.style.cssText = 'color:#c5ccd8;';

  body.append(
    direction,
    price,
    timeframe,
    indicators,
    levels,
    reason,
    warning
  );

  details.append(summary, body);
  root.append(details);

  const refresh = (): void => {
    const result = analyzeBews(getState());

    direction.textContent = result.direction;
    direction.style.color =
      result.direction === 'LONG' ? '#55d68b' :
      result.direction === 'SHORT' ? '#ff7777' :
      '#f0c674';

    price.textContent =
      `Market price: ${displayPrice(result.price)}`;

    timeframe.textContent =
      `Selected timeframe: ${result.timeframe}`;

    indicators.textContent =
      `RSI: ${displayPrice(result.rsi)} | ` +
      `EMA20: ${displayPrice(result.ema20)} | ` +
      `EMA50: ${displayPrice(result.ema50)}`;

    levels.textContent =
      `Entry: ${displayPrice(result.entry)}\n` +
      `Stop: ${displayPrice(result.stopLoss)}\n` +
      `T1: ${displayPrice(result.target1)}\n` +
      `T2: ${displayPrice(result.target2)}`;

    levels.style.cssText =
      'white-space:pre-line;margin-top:8px;';

    reason.textContent = result.reason;
  };

  refresh();

  return { root, refresh };
}
