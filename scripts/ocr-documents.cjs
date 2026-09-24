const {createWorker}=require('tesseract.js');
const fs=require('fs');
const path=require('path');
(async()=>{
 const queue=JSON.parse(fs.readFileSync('tmp/import/ocr-queue.json','utf8'));
 for(const language of ['eng','ben+eng']){
  const jobs=queue.filter(j=>j.language===language);
  if(!jobs.length)continue;
  const worker=await createWorker(language,1,{langPath:path.resolve('tmp/ocr-models'),gzip:false,cachePath:path.resolve('tmp/ocr-models')});
  for(const job of jobs){
   const {data}=await worker.recognize(job.image);
   fs.mkdirSync(path.dirname(job.output),{recursive:true});
   fs.writeFileSync(job.output,JSON.stringify({text:data.text,confidence:data.confidence}));
   console.log(`${job.id} page ${job.page}: ${Math.round(data.confidence)}% OCR confidence`);
  }
  await worker.terminate();
 }
})().catch(e=>{console.error(e);process.exit(1)});
