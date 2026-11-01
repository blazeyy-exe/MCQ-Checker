import Dexie, { type EntityTable } from "dexie";
import type { AnswerKey, AppPreferences, GradingResult, GradingSession, PaperLayout } from "../types";

class McqDatabase extends Dexie {
  answerKeys!: EntityTable<AnswerKey, "id">;
  sessions!: EntityTable<GradingSession, "id">;
  results!: EntityTable<GradingResult, "id">;
  layouts!: EntityTable<PaperLayout, "id">;
  prefs!: EntityTable<AppPreferences & { id: string }, "id">;

  constructor() {
    super("mcq-checker");
    this.version(1).stores({
      answerKeys: "id, updatedAt, name",
      sessions: "id, createdAt, answerKeyId",
      results: "id, sessionId, createdAt, answerKeyId",
      layouts: "id, answerKeyId, createdAt",
      prefs: "id",
    });
  }
}

export const db = new McqDatabase();
