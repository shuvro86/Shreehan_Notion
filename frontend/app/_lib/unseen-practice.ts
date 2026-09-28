export type UnseenPractice = {
 sources: Array<{ documentId: string; sha256: string; subject: string; page: number; printedPage?: number; origin?: string }>;
 questions: Array<{ id: string; subject: string; topic: string; type: string; question: string; answer: string; options: string[]; sources: Array<{ documentId: string; page: number }> }>;
 jobs?: Array<{ documentId: string; state: string; message?: string }>;
};
