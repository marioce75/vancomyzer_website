import type { Locale } from "./catalog";
/** Exact application-owned envelope only. Captured user text stays verbatim. */
export function translateInvitationMessage(source: string, locale: Locale): string | undefined {
  if (locale === "en") return source;
  const match = /^Invited ([^\r\n]+)\. Sign-in link sent to their inbox\.$/.exec(source);
  if (!match) return undefined;
  return locale === "es"
    ? `Se invitó a ${match[1]}. Se envió un enlace de inicio de sesión a su buzón.`
    : `Invitation envoyée à ${match[1]}. Un lien de connexion a été envoyé dans sa boîte de réception.`;
}
