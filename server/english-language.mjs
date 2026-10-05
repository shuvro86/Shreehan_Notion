// Reviewed against PDF page 1 (textbook p. 16). Never reuse for a changed file.
export const englishReviewVersion = 'present-for-paul-v1';
export const englishSource = {id:'1TeGUTs3XnLY5EsYplIc9t9s5ilfUK3WL', sha256:'94a181234bdd011f8fcc3ea28c030aa24c25188a3e1e9b6dd91455cab8985768'};
export const isReviewedEnglish = doc => doc.subject === 'English Language' && doc.id === englishSource.id && doc.sha256 === englishSource.sha256;
const rows = [
 ['Short answer','On which day does the story begin?','Saturday.','It was Saturday'],
 ['Short answer','Why was baby Paul hurting?','A new tooth was coming through.','with a new tooth coming'],
 ['Short answer','Who went shopping with Pleasure?','Her dad.','Pleasure’s dad said'],
 ['Think and answer','Why did Dad tell Pleasure to stay close?','The market was busy, so she needed to stay near him.','That market’s a busy'],
 ['Short answer','How did Pleasure and Dad travel to the market?','By bus.','On the top of the bus going to market'],
 ['Short answer','How much money did Pleasure have for a present?','One pound.','A pound for a present for Paul'],
 ['Short answer','Who was the present for?','Baby Paul.','A pound for a present for Paul'],
 ['Short answer','What was Dad checking?','His shopping list.','her Dad was busy checking his list'],
 ['Short answer','Name the three vegetables Dad bought.','Chillies, potatoes and beans.','chillies, potatoes and beans'],
 ['Short answer','What did the bright market stalls look like from above?','They looked like a fair.','good fun like a fair'],
 ['Short answer','What is the past tense of “buy” used in the passage?','Bought.','bought chillies, potatoes and beans'],
 ['Short answer','Which word in “a new tooth” describes the tooth?','New.','with a new tooth coming'],
 ['Fill in the blank','Complete with the plural noun from the passage: At the market the ________ looked bright.','stalls','At the market the stalls looked bright'],
 ['True / False','Pleasure wanted to buy a present for Paul.','True','A pound for a present for Paul'],
 ['Multiple choice','In “stay close”, what does “close” mean?','Near','close,” he told her.', ['Near','Far away','Shut']],
 ['Short answer','Who wrote “A Present for Paul”?','Bernard Ashley.','Bernard Ashley'],
 ['Short answer','Which word in “holding her tightly” tells us how Dad held Pleasure?','Tightly.','holding her tightly'],
 ['True / False','Dad was doing the shopping alone at the market.','False','he said, holding her tightly'],
 ['Fill in the blank','Complete using the passage: The stalls looked ________ from above.','bright','the stalls looked bright from above'],
 ['Multiple choice','Which word from the passage names a part of the body?','Tooth','with a new tooth coming',['Tooth','Market','Saturday']],
];
export function reviewedEnglishQuestions(chunks) {
 const source = chunks.find(({doc,chunk}) => isReviewedEnglish(doc) && chunk.page === 1);
 if (!source) return [];
 const clean = text => text.replace(/\s+/g,' ').trim();
 return rows.filter(row => clean(source.chunk.text).includes(clean(row[3]))).map(([type,question,answer,evidence,options]) => ({type,question,answer,evidence,options:options || (type === 'True / False' ? ['True','False'] : []),page:1,topic:'A Present for Paul',sources:[{documentId:source.doc.id,page:1}]}));
}
