import type { AnswerKey, AppPreferences, GradingResult, GradingSession, PaperLayout } from "../types";
import { db } from "./db";

const PREF_ID = "app";

export async function saveAnswerKey(key: AnswerKey): Promise<void> {
  await db.answerKeys.put(key);
}

export async function getAnswerKey(id: string): Promise<AnswerKey | undefined> {
  return db.answerKeys.get(id);
}

export async function listAnswerKeys(): Promise<AnswerKey[]> {
  return db.answerKeys.orderBy("updatedAt").reverse().toArray();
}

export async function deleteAnswerKey(id: string): Promise<void> {
  await db.answerKeys.delete(id);
  await db.layouts.where("answerKeyId").equals(id).delete();
}

export async function saveSession(session: GradingSession): Promise<void> {
  await db.sessions.put(session);
}

export async function getSession(id: string): Promise<GradingSession | undefined> {
  return db.sessions.get(id);
}

export async function listSessions(): Promise<GradingSession[]> {
  return db.sessions.orderBy("createdAt").reverse().toArray();
}

export async function saveResult(result: GradingResult): Promise<void> {
  await db.results.put(result);
  const session = await db.sessions.get(result.sessionId);
  if (session) {
    const count = await db.results.where("sessionId").equals(session.id).count();
    await db.sessions.update(session.id, { paperCount: count });
  }
}

export async function getResult(id: string): Promise<GradingResult | undefined> {
  return db.results.get(id);
}

export async function listResults(sessionId?: string): Promise<GradingResult[]> {
  if (sessionId) {
    return db.results.where("sessionId").equals(sessionId).reverse().sortBy("createdAt");
  }
  return db.results.orderBy("createdAt").reverse().toArray();
}

export async function deleteResult(id: string): Promise<void> {
  const result = await db.results.get(id);
  await db.results.delete(id);
  if (result) {
    const count = await db.results.where("sessionId").equals(result.sessionId).count();
    await db.sessions.update(result.sessionId, { paperCount: count });
  }
}

export async function saveLayout(layout: PaperLayout): Promise<void> {
  await db.layouts.put(layout);
}

export async function getLayoutForKey(answerKeyId: string): Promise<PaperLayout | undefined> {
  return db.layouts.where("answerKeyId").equals(answerKeyId).reverse().first();
}

export async function getPrefs(): Promise<AppPreferences> {
  const row = await db.prefs.get(PREF_ID);
  return row ?? { autoScan: true };
}

export async function savePrefs(prefs: AppPreferences): Promise<void> {
  await db.prefs.put({ ...prefs, id: PREF_ID });
}

export async function dashboardStats() {
  const [keys, sessions, results] = await Promise.all([
    listAnswerKeys(),
    listSessions(),
    listResults(),
  ]);
  const totalPapers = results.length;
  const averageScore =
    totalPapers === 0
      ? null
      : Math.round((results.reduce((s, r) => s + r.percentage, 0) / totalPapers) * 10) / 10;
  return { keys, sessions, results, totalPapers, averageScore };
}
