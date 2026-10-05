import "server-only";
import { cookies } from "next/headers";
import { localeCookie, parseLocale } from "./catalog";
export async function requestLocale() {
  return parseLocale((await cookies()).get(localeCookie)?.value);
}
