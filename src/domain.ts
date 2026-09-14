export type Quote = {
  id: string;
  text: string;
  image_path: string | null;
  image_alt: string;
  version: number;
};
export type Submission = Quote & {
  status: "pending" | "approved" | "rejected" | "hidden";
  created_at: string;
  duplicate?: boolean;
};
export type Daily = {
  date: string;
  quote_id: string;
  text: string;
  image_path: string | null;
  image_alt: string;
  revision: number;
  valid_from: string;
  valid_until: string;
};
export const demoQuotes: Quote[] = [
  "Víc je víc než míň.",
  "Nikdy nikomu never.",
  "Smrt je vysvobození.",
].map((text, i) => ({
  id: `ukazka-${i + 1}`,
  text,
  image_path: null,
  image_alt: "",
  version: 1,
}));
export const statusLabel = {
  pending: "Čeká na schválení",
  approved: "Schváleno",
  rejected: "Zamítnuto",
  hidden: "Skryto",
};
export function validateText(text: string) {
  const n = [...text.trim()].length;
  return n < 1
    ? "Napiš své moudro."
    : n > 500
      ? "Moudro může mít nejvýše 500 znaků."
      : null;
}
export function pragueDate(date = new Date()) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Prague",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
export function safeTarget(raw: string, origin: string) {
  try {
    const u = new URL(raw);
    if (u.protocol === "honzikovamoudra:") {
      const path = "/" + u.host + u.pathname;
      return /^\/(moudra\/[\w-]+|denni|davky\/[\w-]+|auth\/callback)$/.test(
        path,
      )
        ? path + u.search + u.hash
        : null;
    }
    if (u.origin !== origin) return null;
    const hashTarget = u.hash.startsWith("#/")
      ? new URL(u.hash.slice(1), origin)
      : null;
    const pathname = hashTarget ? hashTarget.pathname : u.pathname;
    const search = hashTarget ? hashTarget.search : u.search + u.hash;
    return /^\/(moudra\/[^\w-]+|denni|davky\/[^\w-]+|auth\/callback)$/.test(
      pathname,
    )
      ? pathname + search
      : null;
  } catch {
    return null;
  }
}
