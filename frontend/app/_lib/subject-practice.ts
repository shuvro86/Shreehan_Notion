import type { UnseenPractice } from './unseen-practice';

export type SubjectPractice = {
 subjects: Array<{
  name: string;
  notionUrls: string[];
  documentIds: string[];
  target: number;
  state: string;
  message: string;
  questions: UnseenPractice['questions'];
 }>;
};
