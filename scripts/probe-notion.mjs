const headers={Authorization:`Bearer ${process.env.NOTION_TOKEN}`,'Notion-Version':'2025-09-03','Content-Type':'application/json'};
for(const [path,body] of [['search',{page_size:100}],['databases/3c49ecdd38af800fb72df5988abf3b43',null]]){
 const response=await fetch(`https://api.notion.com/v1/${path}`,{method:body?'POST':'GET',headers,...(body?{body:JSON.stringify(body)}:{})});
 const data=await response.json();
 console.log(JSON.stringify({endpoint:path,status:response.status,hasMore:data.has_more,message:data.message,results:data.results?.filter(r=>r.object==='data_source').map(r=>({id:r.id,type:r.object,parent:r.parent,title:(r.title||Object.values(r.properties||{}).find(p=>p.type==='title')?.title||[]).map(t=>t.plain_text||t.text?.content||'').join('')})),dataSources:data.data_sources},null,2));
}
