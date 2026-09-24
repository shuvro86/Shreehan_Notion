export const HOMEWORK_PAGE_ID='3c89ecdd-38af-8034-9a22-f4d5af9fde88';
export function isHomeworkRoot(page,name){return page.id===HOMEWORK_PAGE_ID||/^home\s*work(?:\s+list)?$/i.test(name.trim());}
export function homeworkFromRecords(records){
 const sources=records.filter(r=>r.collection==='Homework');
 const items=[];
 for(const r of sources){
  const blocks=(r.blocks||[]).filter(b=>b.text?.trim()&&!['child_page','child_database'].includes(b.type));
  if(r.id!==HOMEWORK_PAGE_ID&&!/^home\s*work(?:\s+list)?$/i.test(r.title))items.push({id:r.id,title:r.title,kind:'page',checked:r.completed??null,date:r.date,sourceTitle:r.title,notionUrl:r.url,level:0});
  for(const b of blocks)items.push({id:b.id,title:b.text,kind:b.type,checked:b.checked??null,date:r.date,sourceTitle:r.title,notionUrl:r.url+'#'+b.id.replaceAll('-',''),level:b.level||0});
 }
 return {sources:sources.map(r=>({id:r.id,title:r.title,url:r.url})),items};
}
