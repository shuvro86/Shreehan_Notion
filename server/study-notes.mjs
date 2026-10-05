import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const reviewed = JSON.parse(readFileSync(new URL('../data/study-notes-reviewed.json', import.meta.url), 'utf8'));
export const reviewedStudyVersion = createHash('sha256').update(JSON.stringify(reviewed)).digest('hex').slice(0,16);
export const hasReviewedSource = sha256 => reviewed.some(entry => entry.sha256 === sha256);
// Local-only preparation: no Study Notes text is sent to an external model.
// Preserve explicit school answers; create cloze exercises only from those answers.
const clean = value => value.replace(/\s+/g, ' ').trim();
export function noteQuestions(chunks) {
  const items = [];
  for (const {doc, chunk} of chunks) {
    const bank = reviewed.find(entry => entry.documentId === doc.id && entry.sha256 === doc.sha256);
    for (const item of bank?.questions || []) {
      if (item.page !== chunk.page) continue;
      const evidence = [item.evidence, ...(item.evidenceAlternatives || [])].find(value => clean(chunk.text).includes(clean(value)));
      if (evidence) items.push({...item, evidence, sources:[{documentId:doc.id,page:item.page}],topic:doc.title});
    }
  }
  for (const {doc, chunk} of chunks) {
    const text = chunk.text;
    if (/^bangla(?:\s|$)/i.test(doc.subject) && (text.match(/[\u0980-\u09ff]/g) || []).length < text.length / 5) continue;
    for (const match of text.matchAll(/(?:^|\n)\s*(?:[a-z][.)]|\d+[.)])\s*(.+?)\s+\(?(True|False|T|F)\)?\s*(?=\n|$)/g)) {
      const answer = ['True','T'].includes(match[2]) ? 'True' : 'False';
      items.push({type:'True / False',question:clean(match[1]),answer,options:['True','False'],page:chunk.page,evidence:match[0].trim(),sources:[{documentId:doc.id,page:chunk.page}],topic:doc.title});
    }
    for (const match of text.matchAll(/(?:^|\n)\s*[a-z][.)]\s*([a-z-]+):\s*([^\n]+)/g)) {
      items.push({type:'Short answer',question:`What does “${match[1]}” mean?`,answer:clean(match[2]),options:[],page:chunk.page,evidence:match[0].trim(),sources:[{documentId:doc.id,page:chunk.page}],topic:doc.title});
    }
    // Simple definitions in newly added prose notes also become direct recall questions.
    if (doc.kind === 'Note') {
      for (const sentence of text.split(/(?<=[.!?])\s+/)) {
        const match = sentence.trim().match(/^([A-Z][a-zA-Z -]{2,45}) (is|are) ([^!?\n]{12,180})\.$/);
        if (!match || /^(It|He|She|They|This|That|There|Here)\b/.test(match[1])) continue;
        items.push({type:'Short answer',question:`What ${match[2]} ${match[1].toLowerCase()}?`,answer:clean(sentence),options:[],page:chunk.page,evidence:sentence.trim(),sources:[{documentId:doc.id,page:chunk.page}],topic:doc.title});
      }
    }
    const pattern = /(?:^|\n)\s*(?:Q\s*\d+(?:\.[a-z]\))?[.)]?|\d+[.)]|[a-z][.)]|\([ক-হ]\))\s*([^\n]+)\s*\n\s*(?:Ans\.|Answer:|উত্তর\s*[:ঃ])\s*([^]*?)(?=\n\s*(?:Q\s*\d|\d+[.)]|[a-z][.)]|\([ক-হ]\)|Exercise\b|Fill in\b|Write True\b|True\s*\/|LET[’']S|[©@]|The End)|$)/g;
    for (const match of text.matchAll(pattern)) {
      const question = clean(match[1]), answer = clean(match[2]);
      if (!answer || answer.length > 650 || /_{3,}/.test(answer) || /\b(?:this child|he have|he can|given above|these foods)\b/i.test(question)) continue;
      items.push({type:'Short answer',question,answer,options:[],page:chunk.page,evidence:match[2].trim(),sources:[{documentId:doc.id,page:chunk.page}],topic:doc.title});
    }
  }
  const original = [...items];
  for (const item of original.filter(item => item.type === 'Short answer')) {
    for (const sentence of (item.answer.match(/[^.!?]+[.!?]/g) || []).map(value => value.trim()).slice(0, 2)) {
    if (!sentence || sentence.length > 220 || sentence.length < 35 || /["“”]/.test(sentence)) continue;
    const words = sentence.match(/\b[a-zA-Z]{5,}\b/g) || [];
    const stop = new Set(['their','there','which','where','would','could','should','because','about','after','before','these','those','through','always']);
    const answer = words.find(word => !stop.has(word.toLowerCase()));
    if (!answer) continue;
    items.push({...item,type:'Fill in the blank',question:`Fill in the missing word: ${sentence.replace(answer,'________')}`,answer});
  }
  }
  return items;
}
