import { Constants } from './constants.js';

const relativeFormat = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
const dateTimeFormat = new Intl.DateTimeFormat('en', { dateStyle: 'full', timeStyle: 'long' });
const percentFormat = new Intl.NumberFormat('en', { style: 'percent', maximumFractionDigits: 2 });
const numberFormat = new Intl.NumberFormat('en');
const signedFormat = new Intl.NumberFormat('en', { signDisplay: 'exceptZero' });
const dayFormat = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', timeZone: 'UTC' });

export const timeAgo = (iso: string, now = Date.now()) => {
  const elapsed = new Date(iso).getTime() - now;
  for (const [unit, size] of Constants.RelativeTimeUnits) {
    if (Math.abs(elapsed) >= size) {
      return relativeFormat.format(Math.round(elapsed / size), unit);
    }
  }

  return 'just now';
};

export const formatDateTime = (iso: string) => dateTimeFormat.format(new Date(iso));

export const formatPercent = (ratio: number) =>
  ratio > 0 && ratio < Constants.MinPercentRatio
    ? `<${percentFormat.format(Constants.MinPercentRatio)}`
    : percentFormat.format(ratio);

export const formatNumber = (value: number) => numberFormat.format(value);

export const formatSigned = (value: number) => signedFormat.format(value);

export const formatDay = (isoDate: string) => dayFormat.format(new Date(isoDate));
