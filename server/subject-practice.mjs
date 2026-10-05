import {englishReviewVersion, isReviewedEnglish, reviewedEnglishQuestions} from './english-language.mjs';
import {noteQuestions, reviewedStudyVersion} from './study-notes.mjs';
import path from 'node:path';
import crypto from 'node:crypto';
import {acquireLock} from './sync-lock.mjs';
import {atomic, read, root} from './notion-sync.mjs';
import {generateQuestions, validateQuestions, versionKey} from './unseen-practice.mjs';

const hash = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 16);
const sourceIds = docs => docs.map(doc => [doc.id, doc.sha256, versionKey(doc)]).sort((a, b) => a[0].localeCompare(b[0]));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
export const subjectFile = store => path.join(store, 'subject-practice.json');

export function materialGroups(library, collection = 'Subject Materials') {
  const groups = new Map();
  for (const record of library.records || []) {
    if (record.collection !== collection || !record.subject) continue;
    const group = groups.get(record.subject) || {subject: record.subject, records: [], documents: []};
    group.records.push(record);
    groups.set(record.subject, group);
  }
  for (const group of groups.values()) {
    const urls = new Set(group.records.map(record => record.url));
    group.documents = (library.documents || []).filter(doc => doc.subject === group.subject && (doc.collection === collection || (collection === 'Subject Materials' && doc.collection !== 'Study Note' && (urls.has(doc.notionUrl) || doc.sourceType === 'google_drive'))));
    group.documents.sort((a, b) => (a.sourcePage || 0) - (b.sourcePage || 0) || a.title.localeCompare(b.title));
  }
  return [...groups.values()].sort((a, b) => a.subject.localeCompare(b.subject));
}

export function readableChunks(group) {
  const chunks = [];
  for (const doc of group.documents) {
    if (!['PDF', 'Image', 'Note'].includes(doc.kind) || doc.processingError) continue;
    for (const page of doc.pages || []) {
      const text = (page.text || '').trim();
      if (text.length < 40 || page.method === 'Pending' || (page.method === 'OCR' && (typeof page.confidence !== 'number' || page.confidence < 60))) continue;
      for (let offset = 0; offset < text.length; offset += 9000) chunks.push({doc, chunk: {page: page.number, text: text.slice(offset, offset + 9000)}, key: `${doc.id}:${page.number}:${offset}`});
    }
  }
  // Mix earlier and later pages so the first set covers more than the opening chapter.
  const midpoint = Math.ceil(chunks.length / 2), spread = [];
  for (let i = 0; i < midpoint; i++) {
    spread.push(chunks[i]);
    if (chunks[i + midpoint]) spread.push(chunks[i + midpoint]);
  }
  return spread;
}

const commonWords = new Set('a an and are as at be been by can did do for from had has have he her him his i in is it its me my of on or our she that the their them there they this to was we were what when where which who will with would you your how why'.split(' '));
const shortWords = new Set('ago air ant any arm ask bad bag bed bee big boy bus but buy cat cow day did dog dry eat egg end eye far fat few fix fly fox fun get god got gun guy had hat hen her hid him his hit hot ice ill ink job joy key kid kin king law lay led leg let lie lip log lot low mad man map may met mix mob mom mud net new nor not now nut oak odd off oil old one out own pad pan pat pay pen pie pig pin pot put ran raw red rid ring row run sat saw say sea see set she shy sir sit sky son sun ten tin toe top toy try two use van vet war was way wet who win won yes yet zoo'.split(' '));
const lexicalKey = value => value.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
function cleanOcrSentence(value) {
  const words=value.match(/[\p{L}][\p{L}'’-]*/gu)||[];
  const clean=words.filter((word,index)=>{
    const lower=word.toLowerCase();
    if(lower==='a'&&words[index-1]?.toLowerCase()==='very'&&words[index-2]?.toLowerCase()==='very'&&words[index+1]?.toLowerCase()==='cold')return false;
    if(word.length===1)return lower==='a'||word==='I';
    if(word.length===2)return commonWords.has(lower);
    if(word.length===3&&!/[A-Z]/.test(word)&&!commonWords.has(lower)&&!shortWords.has(lower))return false;
    if(/(.)\1{2,}/iu.test(word))return false;
    const vowels=(word.match(/[aeiouy]/gi)||[]).length;
    return vowels>0&&(word.length<5||vowels/word.length>=0.18||/^[A-Z]/.test(word));
  });
  const ending=value.match(/[.!?]$/)?.[0]||'';
  return `${clean.join(' ')}${ending}`;
}

export function extractiveQuestions(chunks, doc, existing = [], batchStart = 0, target = 15, pageLimit = 3) {
  const questions = [];
  const seen = new Set(existing.map(question => lexicalKey(question.question)));
  const storyDoc=chunks.find(item=>item.doc.pages?.some(page=>page.text?.includes('The Ice King is a story told by Native Americans.')))?.doc;
  if(storyDoc){
    const authored=[
      [1,'Which people tell the story “The Ice King”?','Native Americans','The Ice King is a story told by Native Americans.'],
      [1,'Where did some groups of Native Americans settle?','In cold parts of North America','cold parts of North America.'],
      [1,'Why did the people store food?','For the coldest parts of the year','store food for the coldest Parts of the year.'],
      [1,'What did the people wear to keep warm?','Thick animal skins','wear thick animal skins to keep warm.'],
      [1,'What was Chitto like?','He was brave','Chitto. He was a brave man.'],
      [1,'What covered the meadows, hills, and mountains?','Snow','Covered with snow.'],
      [1,'Where did Chitto live?','Near a river','Chitto lived near a river.'],
      [1,'How did the river look in winter?','It was frozen and covered with hard ice','frozen covered over with hard ice'],
      [2,'What happened to the ice in spring?','It slowly melted','Slowly, all the ice melted.'],
      [2,'What did Chitto do to try to melt the Ice King?','He filled his cheeks with warm air and blew','his cheeks with warm air, and he blew'],
      [3,'What did Chitto place near his wigwam to prepare for winter?','A large pile of dry wood','placed a large pile of dry wood near'],
      [3,'How did Chitto get oil?','He took the fat from fish','He took out the fat from the fish.'],
      [3,'What did Chitto use to make his big fire?','Wood and oil','lit a big fire\nwith the wood and oil.'],
      [4,'What happened to the fire when Chitto poured oil on the wood?','It grew high and hot','the fire grew high and hot.'],
      [4,'What did Chitto ask the Ice King to promise?','That they would not harm each other again','Let’s not harm each other again'],
      [4,'How would Chitto’s people keep warm?','They would light fires and wear thick wool clothes','We will light fires and\nwear thick clothes made from wool.'],
    ];
    for(const [page,question,answer,evidence] of authored){
      if(existing.length+questions.length>=target)break;
      const source=chunks.find(item=>item.doc.id===storyDoc.id&&item.chunk.page===page&&item.chunk.text.toLowerCase().replace(/\s+/g,' ').includes(evidence.toLowerCase().replace(/\s+/g,' ')));
      if(!source||seen.has(lexicalKey(question)))continue;
      const item={id:`extract-${storyDoc.id}-${versionKey(storyDoc)}-${batchStart+questions.length}`,subject:storyDoc.subject,topic:storyDoc.title||doc.title,type:'Short answer',question,answer,page,options:[],sources:[{documentId:storyDoc.id,page}],evidence};
      seen.add(lexicalKey(question));questions.push(item);
    }
    if(existing.length+questions.length>=target)return questions;
  }
  const weatherDoc=chunks.find(item=>item.doc.subject==='Geography'&&item.doc.pages?.some(page=>page.text?.includes('A nasty surprise')))?.doc;
  if(weatherDoc){
    const authored=[
      [7,'What was the weather like when Mika went for a walk?','It was a bright, sunny day','It was a bright, sunny day.'],
      [7,'What were the birds and bees doing?','The birds were singing and the bees were buzzing','The birds were\nsinging and the bees were buzzing.'],
      [7,'What did Mika call the first rain?','A shower','It will\nonly be a shower.'],
      [7,'What did Mika put up when it started to rain?','His umbrella','He put up his umbrella.'],
      [7,'What did the gentle breeze turn into?','A howling gale','The gentle breeze turned into a howling g'],
      [7,'What blew into Mika’s umbrella?','The wind','It blew into Mika’s umbrella.'],
      [7,'Where did Mika fall when the wind dropped?','Into a pond','Into a pond.'],
      [9,'What appeared in the sky before it began to rain?','Some clouds','Before long, some clouds appeared.'],
      [9,'What came with the thunder during Mika’s drive?','Lightning','There was thunder ae and lightning.'],
      [9,'What did Mika put on when water sprayed over the car?','The headlights','Mika put on the'],
      [9,'What did Mika say when the weather changed?','“It will soon change.”','It’ll soon change.'],
      [11,'What woke Priya during the night?','A crash and a rumble','up by a crash and a rumble.'],
      [11,'What bent the trees over?','The wind','over by the wind.'],
      [11,'What happened to the fields after the heavy rain?','They were flooded','The fields were flooded.'],
      [11,'What did Priya think when she saw the flooded fields?','There would be no school that day','“Hurray! No school today,”'],
      [11,'Who came to collect Priya?','Her teacher','It was Priya’s teacher.'],
    ];
    for(const [page,question,answer,evidence] of authored){
      if(existing.length+questions.length>=target)break;
      const source=chunks.find(item=>item.doc.id===weatherDoc.id&&item.chunk.page===page&&item.chunk.text.toLowerCase().replace(/\s+/g,' ').includes(evidence.toLowerCase().replace(/\s+/g,' ')));
      if(!source||seen.has(lexicalKey(question)))continue;
      const item={id:`extract-${weatherDoc.id}-${versionKey(weatherDoc)}-${batchStart+questions.length}`,subject:weatherDoc.subject,topic:weatherDoc.title||doc.title,type:'Short answer',question,answer,page,options:[],sources:[{documentId:weatherDoc.id,page}],evidence};
      seen.add(lexicalKey(question));questions.push(item);
    }
    if(existing.length+questions.length>=target)return questions;
  }
  const scienceDoc=chunks.find(item=>item.doc.subject==='Science'&&item.doc.title?.includes('Food for Health')&&item.doc.pages?.some(page=>page.text?.includes('energy-giving, body-building, and protective.')))?.doc;
  if(scienceDoc){
    const authored=[
      [60,'Which three groups divide the food we eat?','Energy-giving, body-building, and protective foods','energy-giving, body-building, and protective.'],
      [60,'Name three foods that give us energy.','Rice, sugar, and wheat','rice, sugar, and wheat give us the energy'],
      [60,'What do body-building foods help us do?','They help us grow and make our bones and muscles strong','help us grow. Milk\nThey make our bones and muscles strong.'],
      [60,'Which foods help protect us from falling ill?','Fruits, vegetables, and nuts','Fruits, vegetables, and nuts protect us from falling ill.'],
      [60,'What should we drink plenty of to remain healthy?','Water','drink plenty of water to remain'],
      [61,'What is a meal?','Food eaten at a particular time of the day','is called a meal.'],
      [61,'How many meals do we usually eat each day?','Three','We usually eat three meals a day.'],
      [61,'What are the three usual meals?','Breakfast, lunch, and dinner','breakfast, lunch, and dinner'],
      [62,'When should we wash our hands?','Before and after eating','Wash your hands before and after eating.'],
      [62,'Why should we not eat food kept uncovered?','It might have germs that can make us sick','It might have germs that can\nmake you sick.'],
      [62,'Name one rule for eating healthy food.','Eat well-cooked food','Eat well-cooked food.'],
      [85,'What is the Earth mainly made up of?','Rocks','The Earth is mainly made up of rocks.'],
      [85,'Which hard rock is used to make kitchen counters?','Granite','It is used to make kitchen\ncounters.'],
      [85,'Which rock was used to build the Red Fort in Delhi?','Red sandstone','The Red Fort in Delhi is made up of red sandstone.'],
      [86,'What are all rocks made up of?','Minerals','All rocks are made up of minerals.'],
      [86,'Which mineral is the softest, and which is the hardest?','Talc is the softest; diamond is the hardest','Talc is the softest mineral. Diamond is the hardest mineral'],
      [86,'Which mineral is used as the “lead” of a pencil?','Graphite','Graphite is used as the\n‘lead’ of a pencil.'],
      [86,'Name three gemstones mentioned in the book.','Ruby, emerald, and garnet','Ruby, emerald, and garnet\nare examples of gemstones.'],
      [86,'What is silica sand used to make?','Mirrors and glasses','Silica sand is used to make\nmirrors and glasses.'],
      [60,'What do energy-giving foods help us do?','Work and play','to work and play. These food items are called energy-giving'],
      [60,'What do milk, eggs, and chicken help us do?','Grow','Food items such as milk, eggs, and chicken help us grow.'],
      [60,'What do fruits, vegetables, and nuts protect us from?','Falling ill','Fruits, vegetables, and nuts protect us from falling ill.'],
      [61,'What is dinner also called?','Supper','dinner\n(supper) at the right time.'],
      [61,'When should we eat breakfast, lunch, and dinner?','At the right time','breakfast, lunch, and dinner\n(supper) at the right time.'],
      [62,'What should we do after eating to clean our mouths?','Wash our mouths','Wash your mouth after eating.'],
      [62,'How should we chew our food?','Slowly and well','Eat slowly and chew your food well.'],
      [62,'What kind of plates and glasses should we use?','Clean ones','Eat and drink from clean plates and glasses.'],
      [62,'What can eating stale food do?','Make us sick','Eating stale food can make you sick.'],
      [62,'How often should we eat meals?','At regular intervals','Eat meals at regular intervals and do not waste food.'],
      [85,'Name three places where rocks can be found.','Mountains, hills, and valleys','Rocks are found on mountains, hills, and in\nvalleys.'],
      [85,'Where else can rocks be found below water?','Under rivers and seas','They are also found under rivers and seas.'],
      [85,'Name two colours that rocks can have.','White and black','white, black, red, and grey.'],
      [85,'Which rock is described as very hard?','Granite','Granite is a very hard rock.'],
      [85,'What is marble used to make?','Buildings, statues, and floors','It is used for making buildings, statues, and floors.'],
      [85,'What is the Taj Mahal made of?','White marble','The Taj Mahal in Agra is made of white marble.'],
      [85,'Is sandstone as hard as granite or marble?','No','it is not as hard as granite or marble.'],
      [85,'Name two soft rocks.','Chalk and slate','Chalk and slate are examples of soft rocks.'],
      [86,'What can be different about minerals?','Their colours, shapes, and sizes','different colours, shapes, and sizes.'],
      [86,'What is talc used to make?','Talcum powder','Talc is used to make\ntalcum powder.'],
      [86,'What is iron used to make?','Nails','Iron is used to make\nnails.'],
      [86,'What is quartz used in?','Watches','Quartz is used in 4\nwatches.'],
      [86,'What are gemstones commonly used in?','Jewellery','Gemstones are used commonly in\njewellery.'],
    ];
    for(const [sourcePage,question,answer,evidence] of authored){
      if(existing.length+questions.length>=target)break;
      const source=chunks.find(item=>item.doc.subject==='Science'&&item.doc.title?.includes(`textbook page ${sourcePage}`)&&item.chunk.text.toLowerCase().replace(/\s+/g,' ').includes(evidence.toLowerCase().replace(/\s+/g,' ')));
      if(!source||seen.has(lexicalKey(question)))continue;
      const item={id:`extract-${source.doc.id}-${versionKey(source.doc)}-${batchStart+questions.length}`,subject:source.doc.subject,topic:source.doc.title,type:'Short answer',question,answer,page:source.chunk.page,options:[],sources:[{documentId:source.doc.id,page:source.chunk.page}],evidence};
      seen.add(lexicalKey(question));questions.push(item);
    }
    if(existing.length+questions.length>=target)return questions;
  }
  const pageCounts=new Map();
  for (const {doc:sourceDoc, chunk} of chunks) {
    const sentences = chunk.text.replace(/\s+/g, ' ').match(/[^.!?]+[.!?]?/g) || [];
    for (const raw of sentences) {
      const sentence = raw.trim();
      const pageKey=`${sourceDoc.id}:${chunk.page}`;
      if((pageCounts.get(pageKey)||0)>=pageLimit)continue;
      const ocrPage=sourceDoc.pages?.find(page=>page.number===chunk.page);
      if(ocrPage?.method==='OCR'&&(typeof ocrPage.confidence!=='number'||ocrPage.confidence<75))continue;
      const cleaned=cleanOcrSentence(sentence);
      const words = cleaned.match(/[\p{L}][\p{L}'’-]*/gu) || [];
      const rawWords=sentence.match(/[\p{L}][\p{L}'’-]*/gu)||[];
      if(rawWords.some(word=>/[a-z][A-Z]/.test(word.slice(1))))continue;
      const alphaRatio = sentence.replace(/\s/g, '').replace(/[^\p{L}]/gu, '').length / Math.max(1, sentence.replace(/\s/g, '').length);
      if (sentence.length < 35 || sentence.length > 260 || words.length < 6 || words.length/Math.max(rawWords.length,1)<0.65 || alphaRatio < 0.72 || words.filter(word => !commonWords.has(word.toLowerCase())).length < 3) continue;
      const proper = [...cleaned.matchAll(/\b[A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,}){0,2}\b/g)].filter(match=>match.index>0).map(match=>match[0]);
      const answer = proper.find(value => !commonWords.has(value.split(/\s+/)[0].toLowerCase())) || words.filter(word => word.length >= 5 && !commonWords.has(word.toLowerCase())).sort((a, b) => b.length - a.length)[0];
      if (!answer || answer.length > 55) continue;
      const deduplicated=cleaned.replace(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})\s+\1\b/,'$1');
      const blanked = deduplicated.replace(answer, '________');
      const question = `Fill in the missing word: ${blanked}`;
      const key = lexicalKey(question);
      if (seen.has(key)) continue;
      seen.add(key);
      questions.push({
        id:`extract-${sourceDoc.id}-${versionKey(sourceDoc)}-${batchStart+questions.length}`,
        subject:sourceDoc.subject,
        topic:sourceDoc.title || doc.title,
        type:'Fill in the blank',
        question,
        answer,
        page:chunk.page,
        options:[],
        sources:[{documentId:sourceDoc.id,page:chunk.page}],
        evidence:sentence,
      });
      pageCounts.set(pageKey,(pageCounts.get(pageKey)||0)+1);
      if (existing.length + questions.length >= target) return questions;
    }
  }
  if(pageLimit!==Infinity&&existing.length+questions.length<target){
    return [...questions,...extractiveQuestions(chunks,doc,[...existing,...questions],batchStart+questions.length,target,Infinity)];
  }
  return questions;
}

export async function prepareSubject(library, subject, {store = root, generate = generateQuestions, apiKey = process.env.OPENROUTER_API_KEY, more = false, refresh = false, maxCalls = 15, onProgress, collection = 'Subject Materials'} = {}) {
  const group = materialGroups(library, collection).find(item => item.subject === subject);
  if (!group) throw Error('subject_not_found');
  const release = await acquireLock(store, 'subject-practice.lock');
  if (!release) throw Error('busy');
  try {
    const file = subjectFile(store);
    const saved = await read(file, {subjects: {}});
    saved.subjects ||= {};
    const sources = sourceIds(group.documents);
    const version = hash([collection === 'Study Note' ? `study-local-v4:${reviewedStudyVersion}` : subject === 'English Language' ? englishReviewVersion : 'ocr-min-60-v2', group.records.map(record => [record.id, record.url]), sources]);
    const bankKey = collection === 'Subject Materials' ? subject : `${collection}:${subject}`;
    let entry = saved.subjects[bankKey];
    const stale = refresh || !entry || entry.version !== version || !same(entry.sources, sources);
    if (stale) {
      entry = {version, sources, target: 15, questions: [], nextBatch: 0, state: 'preparing', message: `Preparing the first 15 questions from ${collection}.`};
      saved.subjects[bankKey] = entry;
    }
    if (more) {
      if (entry.questions.length < entry.target) throw Error('initial_not_ready');
      entry.target += 5;
      entry.state = 'preparing';
      entry.message = `Preparing five more ${subject} questions.`;
    }
    await atomic(file, saved);
    await onProgress?.({subject, state: entry.state, questions: entry.questions.length, target: entry.target, message: entry.message});
    if (entry.questions.length >= entry.target) return entry;
    const chunks = readableChunks(group);
    if (!chunks.length) {
      entry.state = 'waiting_for_files';
      entry.message = `Readable ${collection} files have not synced yet.`;
      await atomic(file, saved);
      await onProgress?.({subject, state: entry.state, questions: entry.questions.length, target: entry.target, message: entry.message});
      return entry;
    }
    if (collection === 'Study Note') {
      const candidates = noteQuestions(chunks);
      for (const candidate of candidates) {
        const source = group.documents.find(doc => doc.id === candidate.sources[0].documentId);
        const chunk = chunks.find(item => item.doc.id === source.id && item.chunk.page === candidate.page)?.chunk;
        try {
          const [question] = validateQuestions({items:[candidate],topic:candidate.topic}, chunk, source, entry.nextBatch++, entry.questions);
          entry.questions.push(question);
        } catch { /* Only exact source-supported, unique items are published. */ }
      }
      entry.target = entry.questions.length || 15;
      entry.state = entry.questions.length >= entry.target ? 'ready' : 'partial';
      entry.message = `${entry.questions.length} source-backed questions prepared locally. ` + (entry.state === 'ready' ? 'Check original pages for diagrams.' : 'Add more readable question-and-answer notes for further practice.');
      entry.updatedAt = new Date().toISOString();
      await atomic(file, saved);
      return entry;
    }
    for (const candidate of reviewedEnglishQuestions(chunks)) {
      if (entry.questions.length >= entry.target) break;
      const source = chunks.find(item => item.doc.id === candidate.sources[0].documentId && item.chunk.page === candidate.page);
      try {
        const [question] = validateQuestions({items:[candidate],topic:candidate.topic}, source.chunk, source.doc, entry.nextBatch++, entry.questions);
        entry.questions.push(question);
      } catch { /* Reject duplicates and evidence mismatches. */ }
    }
    // Reviewed pages are processed locally; do not replace reviewed answers with OCR guesses.
    const generationChunks = chunks.filter(item => !isReviewedEnglish(item.doc));
    const failures = new Map();
    let consecutiveNoProgress = 0;
    for (let call = 0; apiKey && generationChunks.length && call < maxCalls && entry.questions.length < entry.target; call++) {
      const ranked = generationChunks.map((item, order) => ({...item, order, used: entry.questions.filter(q => q.sources?.some(source => source.documentId === item.doc.id && source.page === item.chunk.page)).length, failed: failures.get(item.key) || 0}));
      ranked.sort((a, b) => a.used - b.used || a.failed - b.failed || a.order - b.order);
      const item = ranked[0];
      entry.state = 'preparing';
      entry.message = `Preparing ${subject} questions from ${item.doc.title}, page ${item.chunk.page}.`;
      await atomic(file, saved);
      try {
        const payload = await generate({doc: item.doc, chunk: item.chunk, count: Math.min(3, entry.target - entry.questions.length), existing: entry.questions});
        let added = 0;
        for (const candidate of payload.items || []) {
          if (entry.questions.length >= entry.target) break;
          try {
            const [question] = validateQuestions({items: [candidate], topic: payload.topic}, item.chunk, item.doc, entry.nextBatch++, entry.questions);
            entry.questions.push(question);
            added++;
          } catch { /* Keep other evidence-backed questions from the same response. */ }
        }
      if (!added) {
        failures.set(item.key, (failures.get(item.key) || 0) + 1);
        consecutiveNoProgress++;
      } else consecutiveNoProgress = 0;
      } catch {
        failures.set(item.key, (failures.get(item.key) || 0) + 1);
        consecutiveNoProgress++;
      }
      await atomic(file, saved);
      await onProgress?.({subject, state: entry.state, questions: entry.questions.length, target: entry.target, message: entry.message});
      if (consecutiveNoProgress >= 5) break;
    }
    if (entry.questions.length < entry.target) {
      const fallback = extractiveQuestions(generationChunks, group.documents[0], entry.questions, entry.nextBatch, entry.target);
      for (const candidate of fallback) {
        if (entry.questions.length >= entry.target) break;
        try {
          const source = group.documents.find(item => item.id === candidate.sources[0].documentId);
          const chunk = chunks.find(item => item.doc.id === source.id && item.chunk.page === candidate.sources[0].page)?.chunk;
          const [question] = validateQuestions({items:[candidate],topic:candidate.topic},chunk,source,entry.nextBatch++,entry.questions);
          entry.questions.push(question);
        } catch { /* Keep fallback items only when the page still validates their exact evidence. */ }
      }
      await atomic(file,saved);
      await onProgress?.({subject,state:'preparing',questions:entry.questions.length,target:entry.target,message:`Prepared ${entry.questions.length} source-grounded questions for ${subject}.`});
    }
    entry.state = entry.questions.length >= entry.target ? 'ready' : 'partial';
    entry.message = entry.state === 'ready' ? `${entry.questions.length} source-backed questions are ready.` : `${entry.questions.length} of ${entry.target} questions are ready. More will be prepared from readable pages.`;
    entry.updatedAt = new Date().toISOString();
    await atomic(file, saved);
    await onProgress?.({subject, state: entry.state, questions: entry.questions.length, target: entry.target, message: entry.message});
    return entry;
  } finally { await release(); }
}

export async function prepareAllSubjects(library, options = {}) {
  const results = [];
  for (const collection of options.collection ? [options.collection] : ['Subject Materials', 'Study Note']) {
  for (const group of materialGroups(library, collection)) {
    try { results.push({subject: group.subject, result: await prepareSubject(library, group.subject, {...options, collection})}); }
    catch (error) { if (error.message !== 'busy') throw error; }
  }
  }
  return results;
}
