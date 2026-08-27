/* Date helpers — all local-time, ISO day keys (YYYY-MM-DD). */

export const toISO = (d: Date) => {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${day}`;
};

export const todayISO = () => toISO(new Date());

export const addDays = (iso: string, n: number) => {
  const d = fromISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
};

export const fromISO = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
};

/** Monday of the week containing `d`. */
export const mondayOf = (d: Date) => {
  const x = new Date(d);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
};

/** ISO dates Mon..Sun for the week containing `d`. */
export const weekISO = (d = new Date()) => {
  const mon = mondayOf(d);
  return Array.from({ length: 7 }, (_, i) => {
    const x = new Date(mon);
    x.setDate(mon.getDate() + i);
    return toISO(x);
  });
};

/** Consecutive-day streak ending today (or yesterday if today not yet done). */
export const streakFrom = (doneDates: Set<string>) => {
  let streak = 0;
  let cursor = todayISO();
  if (!doneDates.has(cursor)) cursor = addDays(cursor, -1); // today not done yet — count back from yesterday
  while (doneDates.has(cursor)) {
    streak++;
    cursor = addDays(cursor, -1);
  }
  return streak;
};

export const relLabel = (iso: string) => {
  const t = todayISO();
  if (iso === t) return "Today";
  if (iso === addDays(t, -1)) return "Yesterday";
  if (iso === addDays(t, 1)) return "Tomorrow";
  const diff = Math.round((fromISO(iso).getTime() - fromISO(t).getTime()) / 86400000);
  if (diff < 0 && diff > -7) return `${-diff} days ago`;
  return fromISO(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
};
