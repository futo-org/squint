import { Constants } from './constants.js';

export type TrendPoint = { date: string; value: number };

const toDate = (time: number) => new Date(time).toISOString().slice(0, Constants.IsoDateLength);

export const getTrend = (history: Array<{ date: string; screenshotCount: number }>, today: Date): TrendPoint[] => {
  const counts = new Map(history.map(({ date, screenshotCount }) => [date, screenshotCount]));
  const [first] = history;
  if (!first) {
    return [];
  }

  const points: TrendPoint[] = [];
  let value = first.screenshotCount;
  for (let time = Date.parse(first.date); toDate(time) <= toDate(today.getTime()); time += Constants.DayMs) {
    const date = toDate(time);
    value = counts.get(date) ?? value;
    points.push({ date, value });
  }

  return points;
};

export const getChange = (points: TrendPoint[]) => (points.at(-1)?.value ?? 0) - (points[0]?.value ?? 0);
