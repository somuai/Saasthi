import { formatISO, parseISO, format } from "date-fns";
import { translateHindiText, getCurrentLocale } from "./localization";

/** Calendar date string yyyy-MM-dd in local timezone */
export function todayYmd() {
  return formatISO(new Date(), { representation: "date" });
}

export function formatIndianDate(ymd) {
  if (!ymd) return "";
  try {
    const d = typeof ymd === "string" ? parseISO(ymd.slice(0, 10)) : ymd;
    return format(d, "dd MMM yyyy");
  } catch {
    return String(ymd);
  }
}

export function timeAgo(isoString, locale) {
  if (!isoString) return "—";
  const loc = locale || getCurrentLocale();
  const t = (hi) => (loc === "en" ? hi : translateHindiText(hi, loc));
  const then = new Date(isoString).getTime();
  const mins = Math.floor((Date.now() - then) / 60000);
  if (mins < 1) return t("अभी / Just now");
  if (mins < 60) return `${mins} ${t("मिनट पहले")} / ${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} ${t("घंटे पहले")} / ${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days} ${t("दिन पहले")} / ${days}d ago`;
}

export function firstDayOfMonthYmd(d = new Date()) {
  const x = new Date(d.getFullYear(), d.getMonth(), 1);
  return formatISO(x, { representation: "date" });
}

export function lastDayOfMonthYmd(d = new Date()) {
  const x = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return formatISO(x, { representation: "date" });
}
