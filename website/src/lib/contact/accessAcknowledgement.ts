import { createHash } from "crypto";
import type Database from "better-sqlite3";

export const ACCESS_TOPIC = "restricted_access";
export const CONTACT_EMAIL = "contact@vancomyzer.com";
export const ACK_SUBJECT = "Your Vancomyzer restricted-access enquiry";
export const ACK_TEXT = "Thank you for your interest in saved history and institutional access. These features are not currently available for new access requests. We are preparing a validation study and will follow up when we have an update. For technical questions, email contact@vancomyzer.com or sign in and use the bug-report form in the calculator’s Settings. This acknowledgement does not grant access or enrol you in a study.";

export function acknowledgementRecipient(input: { topic: string; email: string; acknowledgement: boolean }, enabled: boolean, sender: string): string | null {
  if (!enabled || input.topic !== ACCESS_TOPIC || input.acknowledgement !== true) return null;
  const email = input.email.trim().toLowerCase();
  if (!/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(email) || /[\r\n]/.test(email)) return null;
  const [local, domain] = email.split("@");
  if (email === sender.trim().toLowerCase() || domain === "vancomyzer.com" || domain === "dosys.health") return null;
  if (/(?:^|[.+_-])(?:no[._-]?reply|donotreply|mailer[._-]?daemon|postmaster|bounce|bounces|notifications?|automated|autoresponder)(?:$|[.+_-])/i.test(local)) return null;
  return email;
}

/** At most one attempt per recipient per seven days, shared by the existing persistent DB.
 * Claim before SMTP; an uncertain/failed delivery is NOT retried automatically.
 * Stores only a hash and timestamp, never message text or a raw address.
 */
export function claimAcknowledgement(db: Database.Database, email: string, now = Date.now()): boolean {
  db.exec("CREATE TABLE IF NOT EXISTS access_acknowledgements (recipient_hash TEXT PRIMARY KEY, attempted_at INTEGER NOT NULL)");
  const key = createHash("sha256").update(email.toLowerCase()).digest("hex");
  return db.transaction(() => {
    db.prepare("DELETE FROM access_acknowledgements WHERE attempted_at <= ?").run(now - 7 * 86400000);
    const daily = db.prepare("SELECT COUNT(*) AS total FROM access_acknowledgements WHERE attempted_at > ?").get(now - 86400000) as { total: number };
    if (daily.total >= 100) return false;
    return db.prepare("INSERT OR IGNORE INTO access_acknowledgements (recipient_hash, attempted_at) VALUES (?, ?)").run(key, now).changes === 1;
  })();
}

export const ACK_TRANSLATIONS = {
  en: { subject: ACK_SUBJECT, text: ACK_TEXT },
  es: { subject: "Su consulta sobre el acceso restringido a Vancomyzer", text: "Gracias por su interés en el historial guardado y el acceso institucional. Estas funciones no están disponibles actualmente para nuevas solicitudes de acceso. Estamos preparando un estudio de validación y nos pondremos en contacto cuando tengamos novedades. Para preguntas técnicas, escriba a contact@vancomyzer.com o inicie sesión y utilice el formulario de errores en los ajustes de la calculadora. Esta confirmación no concede acceso ni le inscribe en un estudio." },
  fr: { subject: "Votre demande d’accès restreint à Vancomyzer", text: "Merci de votre intérêt pour l’historique enregistré et l’accès institutionnel. Ces fonctionnalités ne sont actuellement pas disponibles pour de nouvelles demandes d’accès. Nous préparons une étude de validation et vous recontacterons lorsque nous aurons des nouvelles. Pour les questions techniques, écrivez à contact@vancomyzer.com ou connectez-vous et utilisez le formulaire de signalement dans les paramètres du calculateur. Cet accusé de réception n’accorde aucun accès et ne vous inscrit à aucune étude." },
  "pt-BR": { subject: "Sua consulta sobre acesso restrito ao Vancomyzer", text: "Agradecemos seu interesse no histórico salvo e no acesso institucional. Esses recursos não estão disponíveis atualmente para novas solicitações de acesso. Estamos preparando um estudo de validação e entraremos em contato quando houver novidades. Para dúvidas técnicas, escreva para contact@vancomyzer.com ou entre na sua conta e use o formulário de erros nas configurações da calculadora. Esta confirmação não concede acesso nem inscreve você em um estudo." },
} as const;
