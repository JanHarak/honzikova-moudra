import { createClient } from "@supabase/supabase-js";
import type { Quote, Daily, Submission } from "./domain";
import { demoQuotes, pragueDate } from "./domain";
const url = import.meta.env.VITE_SUPABASE_URL,
  key = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const db =
  url && key
    ? createClient(url, key, {
        auth: { flowType: "pkce", detectSessionInUrl: true },
      })
    : null;
export const demo = !db;
export function mediaUrl(path: string | null) {
  return path && url
    ? `${url}/functions/v1/hm-media?path=${encodeURIComponent(path)}`
    : path;
}
function withMedia<T extends { image_path: string | null }>(item: T): T {
  return { ...item, image_path: mediaUrl(item.image_path) };
}
export async function rpc<T>(
  name: string,
  args: Record<string, unknown> = {},
): Promise<T> {
  if (!db) throw Error("Ukázkový režim: Supabase není připojeno.");
  const { data, error } = await db.rpc(name, args);
  if (error) throw error;
  return data as T;
}
const cacheKey = "hm-public-v1";
export async function loadPublic(): Promise<{
  quotes: Quote[];
  daily: Daily[];
  offline: boolean;
}> {
  if (!db)
    return {
      quotes: demoQuotes,
      daily: [
        {
          date: pragueDate(),
          quote_id: demoQuotes[0].id,
          text: demoQuotes[0].text,
          image_path: null,
          image_alt: "",
          revision: 1,
          valid_from: "",
          valid_until: "",
        },
      ],
      offline: false,
    };
  try {
    let quotes: Quote[] = [];
    let cursor: string | null = null;
    for (;;) {
      const page: Quote[] = await rpc<Quote[]>("hm_list_published_quotes", {
        p_cursor: cursor,
        p_limit: 100,
      });
      quotes.push(...page);
      if (page.length < 100) break;
      cursor = page.at(-1)!.id;
    }
    const daily = await rpc<Daily[]>("hm_get_daily_plan", {
      p_from: pragueDate(),
      p_days: 7,
    });
    const publicData = {
      quotes: quotes.map(withMedia),
      daily: daily.map(withMedia),
    };
    try {
      localStorage.setItem(
        cacheKey,
        JSON.stringify({ ...publicData, savedAt: Date.now() }),
      );
    } catch {}
    return { ...publicData, offline: false };
  } catch (error) {
    if (!navigator.onLine) {
      try {
        const cache = JSON.parse(localStorage.getItem(cacheKey) || "null");
        if (cache && Date.now() - cache.savedAt < 7 * 86400000)
          return { ...cache, offline: true };
      } catch {}
    }
    throw error;
  }
}
export const ownSubmissions = () => rpc<Submission[]>("hm_list_own_submissions");
export function errorMessage(e: unknown) {
  const s =
    typeof e === "object" && e && "message" in e
      ? String(e.message)
      : String(e);
  const known: Record<string, string> = {
    EMAIL_REQUIRED: "Nejdřív ověř svůj e-mail.",
    AUTH_REQUIRED: "Přihlas se znovu. Rozepsaný text zůstává zachován.",
    RATE_LIMIT: "Nejvýše 5 návrhů za hodinu. Zkus to později.",
    VERSION_CONFLICT: "Záznam mezitím změnil jiný administrátor. Obnov seznam.",
    FORBIDDEN: "K této akci nemáš oprávnění.",
    INVALID_TEXT: "Moudro musí mít 1–500 znaků.",
    IMAGE_ALT_REQUIRED: "Před schválením obrázku doplň alternativní popis.",
    REQUEST_CONFLICT: "Tento požadavek již patří jinému textu.",
  };
  return (
    Object.entries(known).find(([k]) => s.includes(k))?.[1] ||
    "Akci se nepodařilo dokončit. Zkontroluj připojení a zkus to znovu."
  );
}
