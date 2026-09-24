"""Curated, source-grounded Class II practice. Run after import-notion.py."""
import json
from pathlib import Path
root=Path(__file__).resolve().parents[1]
library=json.loads((root/'data/library.json').read_text())
docs={d['filename']:d for d in library['documents']}
questions=[]
def q(file,page,topic,question,answer,kind='Short answer',options=None,explanation='',extra=None):
    d=docs[file]
    refs=[{'documentId':d['id'],'page':page}]
    for f,p in extra or []:refs.append({'documentId':docs[f]['id'],'page':p})
    questions.append({'id':f'q-{len(questions)+1:03d}','subject':d['subject'],'topic':topic,'type':kind,'question':question,'answer':answer,'options':options or [],'explanation':explanation,'sources':refs})

# Science: school seen notes and unseen chapter pages, with simple vocabulary.
q('Science.pdf',1,'Uses of plants','Where do we get fruits and vegetables?','We get fruits and vegetables from plants.')
q('Science.pdf',1,'Uses of plants','Which pair of plant stems do we eat?','Potato and ginger','Multiple choice',['Potato and ginger','Carrot and radish','Cabbage and spinach'])
q('Science.pdf',1,'Uses of plants','Pulses are found inside ____.','pods','Fill in the blank')
q('Science.pdf',1,'Uses of plants','Name two plant fibres.','Cotton and jute.')
q('Science.pdf',1,'Uses of plants','We make paper from plants.','True','True / False',['True','False'])
q('Science.pdf',1,'Uses of plants','Name two plants from which we get oil.','Mustard and coconut.')
q('Science.pdf',2,'Uses of plants','Which part of a carrot do we eat?','The root.')
q('Science.pdf',2,'Uses of plants','Which part of cabbage do we eat?','The leaves.')
q('Science.pdf',2,'Uses of plants','Name two flowers that we eat.','Cauliflower and broccoli.')
q('Science.pdf',2,'Uses of plants','What are cereals? Give two examples.','Cereals are food grains from grass-like plants. Rice and wheat are cereals.')
q('Science.pdf',2,'Uses of plants','Why do we add spices to food?','Spices add flavour to our food.')
q('Science.pdf',2,'Uses of plants','Give two examples of spices.','Cinnamon and black pepper.')
q('Science.pdf',3,'Uses of plants','What do we get when wheat grains are ground?','Flour.')
q('95.jpeg',1,'Air Around Us','What is wind?','Moving air is called wind.')
q('95.jpeg',1,'Air Around Us','A gentle wind is called a ____.','breeze','Fill in the blank')
q('95.jpeg',1,'Air Around Us','Give two uses of wind.','Wind helps a kite fly and a boat sail.')
q('95.jpeg',1,'Air Around Us','Which instrument tells us the direction of wind?','A wind vane.')
q('95.jpeg',1,'Air Around Us','What can a storm damage?','A storm can damage trees and houses.')
q('96.jpeg',1,'Air Around Us','Name four things that air contains.','Air contains water vapour, dust, smoke, and germs.')
q('96.jpeg',1,'Air Around Us','What makes air dirty?','Dust, smoke, and germs make air dirty.')
q('96.jpeg',1,'Air Around Us','What happens to water in wet clothes when they dry in the sun?','The water changes into water vapour and mixes with the air.')
q('97.jpeg',1,'Air Around Us','What are the three properties of air?','Air fills space, gives shape to things, and has weight.')
q('97.jpeg',1,'Air Around Us','Why does a balloon become bigger when we blow air into it?','Air fills the balloon and gives it shape.')
q('97.jpeg',1,'Air Around Us','Why is an inflated football heavier than an empty one?','The air inside the inflated football has weight.')
q('97.jpeg',1,'Air Around Us','Why should we grow more plants?','Plants help keep the air fresh and clean.')
q('98.jpeg',1,'Air Around Us','Air has no weight.','False','True / False',['True','False'],'Air has weight, fills space, and gives shape to things.')
q('98.jpeg',1,'Air Around Us','We can feel air when it moves.','True','True / False',['True','False'])
q('99.jpeg',1,'Air Around Us','Which of these helps keep the air clean?','Plants','Multiple choice',['Smoke','Dust','Plants'])
q('99.jpeg',1,'Air Around Us','Which does not need wind to move?','Whale','Multiple choice',['Sail boat','Kite','Whale'])
q('99.jpeg',1,'Air Around Us','Name two things to which air gives shape.','A balloon and an inflated ball.','Short answer',extra=[('97.jpeg',1)])
q('100.jpeg',1,'Air Around Us','Draw three things that move with the help of wind.','Draw a kite, a sailing boat, and a windmill.','Drawing',explanation='Label each drawing. This is an example answer.',extra=[('95.jpeg',1)])
q('100.jpeg',1,'Air Around Us','Complete: air fills ____, gives ____, and has ____.','space; shape; weight','Fill in the blank',extra=[('97.jpeg',1)])
q('101.jpeg',1,'Air Around Us','Why should we cover our nose and mouth when we sneeze?','To help stop germs from spreading into the air.','Short answer',extra=[('96.jpeg',1)])
q('102.jpeg',1,'Air Around Us','Write a short slogan about planting trees.','Plant more trees. Keep our air clean!','Apply',explanation='This is an example slogan. You can write your own.',extra=[('97.jpeg',1)])

# History and Bangladesh Studies: use the provided notes and avoid unsupported generalisations.
q('History.pdf',2,'Crossing Barriers','How did people travel before the wheel was invented?','They walked and used domesticated animals.')
q('History.pdf',2,'Crossing Barriers','How did the wheel change travel?','The wheel made travel faster and helped people explore more places.')
q('History.pdf',1,'Crossing Barriers','Match George Stephenson with his invention.','Steam locomotive','Multiple choice',['Steam locomotive','Petrol car','Bicycle'])
q('History.pdf',1,'Crossing Barriers','Who is matched with the first petrol car in your notes?','Karl Benz.')
q('History.pdf',2,'Crossing Barriers','What was used when air travel began?','Hot-air balloons.')
q('History.pdf',2,'Crossing Barriers','Who was the first person to set foot on the Moon?','Neil Armstrong.')
q('History.pdf',2,'Crossing Barriers','In which spaceship did Yuri Gagarin orbit the Earth?','Vostok 1.')
q('Bangladesh_Studies.pdf',1,'Rakhain community','According to the notes, where did the Rakhains originally come from?','Arakan.')
q('Bangladesh_Studies.pdf',1,'Rakhain community','What main occupation of the Rakhain community is given in the notes?','Farming.','Short answer',explanation='The notes also mention weaving and making salt and molasses.')
q('Bangladesh_Studies.pdf',1,'Rakhain community','What is Sundrey?','Sundrey is a three-day community festival of the Rakhains during Chaitra Sankranti.')
q('Bangladesh_Studies.pdf',1,'Nawab Faizunnesa','Name two ways Nawab Faizunnesa helped women.','She established a school for girls and a hospital for women.')
q('Bangladesh_Studies.pdf',1,'Nawab Faizunnesa','Who awarded Faizunnesa the title of Nawab?','Queen Victoria.')
q('Bangladesh_Studies.pdf',1,'Nawab Faizunnesa','Why was Faizunnesa awarded the title of Nawab?','For her social work.')
q('assign_bs.pdf',1,'Assignment practice','Complete the assignment: Faizunnesa founded a ____ and later upgraded it to a ____.','madrasha; college','Fill in the blank',extra=[('Bangladesh_Studies.pdf',1)])

# Values stories: short, supportive responses.
q('Moral_Studies_1.pdf',1,'Having Good Thoughts','What was Robert Bruce’s goal in the story?','To free his country from the enemy.')
q('Moral_Studies_1.pdf',1,'Having Good Thoughts','The spider reached the next beam on its seventh try.','True','True / False',['True','False'])
q('Moral_Studies_1.pdf',3,'Having Good Thoughts','What does the story of the king and the spider teach us?','Keep trying, think positively, and do not give up hope.')
q('Moral_Studies_1.pdf',3,'Having Good Thoughts','What could you say to a friend who did not win a competition?','Keep practicing. Be proud of trying, and congratulate the winner.','Apply',explanation='This is a kind example response based on the lesson.')
q('Moral_Studies_2.pdf',2,'Being a Family','Why did the girls’ mother need money?','She needed money for their father’s treatment.')
q('Moral_Studies_2.pdf',3,'Being a Family','Why did Jo cut off her hair?','She sold her hair to help pay for her father’s treatment.')
q('Moral_Studies_2.pdf',1,'Being a Family','Family members should help each other in difficult times.','True','True / False',['True','False'])
q('assign_MSpdf.pdf',2,'Assignment practice','What can Ejaz do after a fight with his brother?','He can apologise, listen, and talk kindly with his brother.','Apply',extra=[('Moral_Studies_2.pdf',3)])

# Reading and vocabulary.
q('English_Literature.pdf',1,'Cuckoo!','Why did Winnie want to go home?','She was tired.')
q('English_Literature.pdf',1,'Cuckoo!','How were Tony and Winnie related?','They were brother and sister.')
q('English_Literature.pdf',1,'Cuckoo!','Who did Tony think was making the cuckoo sound?','Winnie.')
q('English_Literature.pdf',1,'Cuckoo!','What did Winnie help her mother make?','Tea.')
q('English_Literature.pdf',2,'Cuckoo!','What does “astonished” mean?','Very surprised.')
q('English_Literature.pdf',2,'Cuckoo!','What does “hunted” mean in the notes?','Looked for.')
q('English_Literature.pdf',2,'Dumbo vocabulary','What does “thrilling” mean?','Exciting.')
q('English_Literature.pdf',2,'Dumbo vocabulary','What does “ached” mean?','Hurt.')

# Language practice directly aligned with the five grammar handouts.
q('EL1.pdf',1,'Plurals','Write the plural of “bird”.','birds','Fill in the blank')
q('EL1.pdf',1,'Plurals','Write the plural of “box”.','boxes','Fill in the blank')
q('EL1.pdf',1,'Plurals','Write the plural of “fly”.','flies','Fill in the blank')
q('EL2.pdf',3,'Irregular plurals','What is the plural of “child”?','children','Multiple choice',['childs','children','childes'])
q('EL2.pdf',3,'Irregular plurals','Write the plural of “tooth”.','teeth','Fill in the blank')
q('EL2.pdf',4,'Irregular plurals','Write the singular of “mice”.','mouse','Fill in the blank')
q('EL2.pdf',6,'Capital letters','Correct the capitals: “we hope to go next friday.”','We hope to go next Friday.','Apply')
q('EL2.pdf',7,'Here and hear','Choose: “I can ____ the bird singing.”','hear','Multiple choice',['here','hear'])
q('EL3.pdf',1,'Adjectives','Find the describing word: “A big lorry was parked outside the school.”','big')
q('EL3.pdf',2,'Questions','Which mark belongs at the end of a question?','Question mark (?)','Multiple choice',['Full stop (.)','Question mark (?)','Comma (,)'])
q('EL3.pdf',3,'Weather words','When there is fog, the weather is ____.','foggy','Fill in the blank')
q('EL3.pdf',4,'Using the right word','Choose: “The books ____ kept on the shelf.”','are','Multiple choice',['is','are'])
q('EL4.pdf',1,'Singular and plural','One horse, two ____.','horses','Fill in the blank')
q('EL4.pdf',6,'A and an','Choose: “____ apple”.','an','Multiple choice',['a','an'])
q('EL4.pdf',6,'A and an','Choose: “____ book”.','a','Multiple choice',['a','an'])
q('EL4.pdf',8,'Action words','Add “-ing” to “dance”.','dancing','Fill in the blank',explanation='Drop the final e before adding -ing.')
q('EL5.pdf',1,'Nouns','Which word names a person?','teacher','Multiple choice',['teacher','quickly','run'])
q('EL5.pdf',3,'Nouns','Find the noun: “The window was broken.”','window')
q('EL5.pdf',3,'Verbs','Find the doing word: “The little girl cried.”','cried')
q('EL5.pdf',3,'Verbs','Find the doing word: “The clown smiled.”','smiled')

# Mathematics numbers are changed, as the syllabus explicitly requires.
q('Math.pdf',1,'Geometry','Name two instruments used in geometry.','A ruler and a compass.','Short answer',explanation='The notes also list a set square, protractor, and divider.')
q('Math.pdf',2,'Geometry','Which line keeps the same direction?','Straight line','Multiple choice',['Straight line','Curved line'])
q('Math.pdf',2,'Geometry','Draw one straight line and one curved line.','Draw a straight line like — and a curved line like ∩. Label both.','Drawing')
q('JOM2.pdf',1,'Number sense','How many digits do we use in our number system?','10','Multiple choice',['9','10','11'])
q('JOM2.pdf',1,'Number sense','What is the smallest two-digit number?','10')
q('JOM2.pdf',1,'Number sense','What is the largest three-digit number?','999')
q('JOM2.pdf',2,'Number names','Write “five hundred and twenty-three” in digits.','523')
q('JOM2.pdf',3,'Place value','In 4,582, which digit is in the hundreds place?','5','Short answer',explanation='4 thousands, 5 hundreds, 8 tens, and 2 ones. This is a new number for practice.')
q('JOM2.pdf',3,'Place value','What is the value of 7 in 3,746?','700','Short answer',explanation='The 7 is in the hundreds place. This is a new practice number.')

# The geography attachment is a map, not the other textbook chapters.
for country,capital in [('England','London'),('Wales','Cardiff'),('Scotland','Edinburgh'),('Northern Ireland','Belfast')]:
    q('1787467035.pdf',1,'UK map','What is the capital of '+country+'?',capital)
q('1787467035.pdf',1,'UK map','Label England and London on an outline map of the UK.','Label England in the southern part of Great Britain and London in southeast England.','Drawing',explanation='Compare your labels with the original map.')

# Bangla items cross-checked against the page images and readable OCR.
q('Bangla_Paper_I.pdf',1,'আমার বাড়ি আমার কাজ','তুলি কী কাজ করবে?','তুলি ঘর পরিষ্কার করবে ও কাপড় গোছাবে।')
q('Bangla_Paper_I.pdf',1,'আমার বাড়ি আমার কাজ','তপু কার সাথে বাজারে যেতে চাইল?','তপু বাবার সাথে বাজারে যেতে চাইল।')
q('Bangla_Paper_I.pdf',1,'বিড়ালছানা','পশুপাখির সাথে আমরা কেমন আচরণ করব?','পশুপাখির সাথে আমরা সদয় আচরণ করব।')
q('Bangla_Paper_I.pdf',2,'প্রজাপতি','প্রজাপতির পাখা কেমন?','প্রজাপতির পাখা রঙিন।')
q('Bangla_Paper_I.pdf',2,'শব্দার্থ','“পাখা” শব্দের অর্থ কী?','ডানা।')
q('Bangla_Paper_I.pdf',2,'শব্দার্থ','“ক্ষত” শব্দের অর্থ কী?','ঘা।')
q('Bangla_Paper_I.pdf',3,'পরিভাষা','“Knowledge” এর বাংলা কী?','জ্ঞান।')
q('Bangla_Paper_I.pdf',3,'পরিভাষা','“Playground” এর বাংলা কী?','খেলার মাঠ।')
q('Bangla_1.pdf',1,'Assignment practice','শূন্যস্থান পূরণ কর: ফুলে ফুলে ____ উড়ছে।','প্রজাপতি','Fill in the blank',extra=[('Bangla_Paper_I.pdf',2)])
q('Bangla_2.pdf',1,'Assignment practice','“Drawing” এর বাংলা কী?','অঙ্কন।','Short answer',extra=[('Bangla_Paper_I.pdf',3)])

summaries={
'offsched_c22_s16_20260730_34570f.pdf':('Class II, Rose section weekly routine. The class teacher is Tithi Biswas.',['Sunday–Thursday timetable','Six class periods','Tiffin 10:15–10:35'],'The second PDF page is blank. Preserve it as part of the original.'),
'syllabus_c22_s16_20260717_df885b.pdf':('First Monthly Examination 2026–2027, Class II July Session: the master guide for scope and question formats.',['Seen and unseen chapters','English, mathematics, science and humanities','Bangla, Islamic Studies and Moral Studies'],'A syllabus lists topics; it does not supply all textbook content. Unuploaded chapters are not treated as read.'),
'Math.pdf':('Geometry definitions, instruments, and examples of straight and curved lines.',['Geometry instruments','Straight lines','Curved lines'],''),
'JOM2.pdf':('Joy of Mathematics exercises for the first monthly examination.',['Number names and numerals','Four-digit place value','Comparing and ordering numbers','Arithmetic exercises'],'The syllabus asks for changed numbers. One source line calls 1 the smallest one-digit number; distinguish positive counting numbers from 0 when teaching.'),
'Moral_Studies_1.pdf':('Having Good Thoughts: Robert Bruce and the spider, with recall questions and everyday applications.',['Perseverance','Positive thinking','Responding kindly to setbacks'],''),
'Moral_Studies_2.pdf':('Being a Family: Jo and the March family, with questions about care and helping others.',['Jo’s sacrifice','Helping family members','Kind communication'],''),
'Science.pdf':('Uses of Plants: plant foods, fibres, oil, and other useful products.',['Roots, stems, leaves and flowers we eat','Cereals versus pulses','Spices and plant fibres','Observe, apply and label diagrams'],'Use the original diagrams for picture questions. The plant examples are lesson content, not medical advice.'),
'History.pdf':('Crossing Barriers: developments in land, water, air and space travel.',['The wheel and early travel','Transport inventions','Air and space travel'],'Some historical superlatives and simplified attributions in the notes need teacher context; practice avoids the undersea-tunnel superlative.'),
'Bangla_Paper_I.pdf':('বাংলা প্রথম পত্রের গদ্য, পদ্য, শব্দার্থ, যুক্তবর্ণ এবং কিছু বাংলা দ্বিতীয় পত্রের পরিভাষা।',['আমার বাড়ি আমার কাজ','বিড়ালছানা','প্রজাপতি','ইংরেজি থেকে বাংলা পরিভাষা'],'Legacy-font text required OCR. Check যুক্তবর্ণ and unclear spellings in the original image.'),
'Bangladesh_Studies.pdf':('School notes about the Rakhain community and Nawab Faizunnesa.',['Rakhain festivals and occupations','Nawab Faizunnesa’s education and social work'],'Read community descriptions as the wording of these school notes. Practice focuses on named facts and avoids appearance-based generalisations.'),
'English_Literature.pdf':('Cuckoo! comprehension, sentence completion and vocabulary; a Dumbo vocabulary list.',['Tony and Winnie','Story comprehension','Cuckoo! word meanings','Dumbo word meanings'],'The complete Dumbo story is not attached. Do not invent story answers from its vocabulary list.'),
'1787467035.pdf':('An outline map of the United Kingdom with countries and capitals labeled.',['England — London','Wales — Cardiff','Scotland — Edinburgh','Northern Ireland — Belfast'],'The Earth, planets, day/night, and living-planet chapters are listed in the syllabus but are not in this attachment.'),
'EL1.pdf':('Junior English regular plural forms, spelling changes, and answer exercises.',['Add -s or -es','Change y to -ies','Change f to -ves'],'Some worksheet lists contain mismatched examples; use the checked answer forms and original context.'),
'EL2.pdf':('Irregular plurals, singular/plural sentence changes, capital letters, and here/hear/there/their.',['Irregular noun forms','Sentence transformations','Capital letters','Homophones'],'An early example prints feet → feet; the later answer key correctly gives feet → foot.'),
'EL3.pdf':('Describing words, question words, punctuation, weather vocabulary, and correct verb forms.',['Adjectives','Question marks and full stops','Weather words','Is/are, was/were, saw/seen'],''),
'EL4.pdf':('Singular and plural nouns, a/an, and verb endings -ed and -ing.',['One versus more than one','A and an','Verb spelling changes'],''),
'EL5.pdf':('Nouns as naming words and verbs as doing words, with complete exercise answers.',['People, animals and things','Finding nouns in sentences','Finding action words'],''),
'assign_MSpdf.pdf':('Moral Studies assignment for the first monthly: Jo’s family and Robert Bruce.',['Multiple choice','True/false and gap filling','Short answers and life skills'],'This is an unfilled worksheet. Model answers are sourced from the corresponding study notes.'),
'assign_bs.pdf':('Bangladesh Studies assignment on Rakhain life and Nawab Faizunnesa.',['Short answers','Fill in the blanks','True/false'],'Answer support is in Bangladesh Studies.pdf.'),
'Bangla_1.pdf':('বাংলা প্রথম পত্রের অ্যাসাইনমেন্ট: প্রশ্নোত্তর, শব্দার্থ, বাক্য, শূন্যস্থান এবং যুক্তবর্ণ।',['তুলি ও পশুপাখি','প্রজাপতি','শব্দার্থ ও বাক্য গঠন'],'Answers should be checked against the Bangla study notes. OCR can miss letter combinations.'),
'Bangla_2.pdf':('বাংলা দ্বিতীয় পত্রের অ্যাসাইনমেন্ট: ব্যাকরণ, অর্ধমাত্রা, বচন, লিঙ্গ এবং পরিভাষা।',['বাংলা ব্যাকরণ','বচন ও লিঙ্গ পরিবর্তন','ইংরেজি থেকে বাংলা'],'The uploaded notes do not provide a complete answer key for every grammar item. Those answers are not invented.'),
'CamScanner_22-08-2026_21.42.pdf':('Scanned First Monthly Examination schedule for Class II.',['Exam dates and subjects','Exam timing and instructions'],'Use the original scan to confirm dates. This is a schedule, not a question paper.'),
}
air={
'95.jpeg':('Moving air, useful wind, breeze, storm, and wind direction.',['Wind and breeze','Uses of wind','Storms','Wind vane']),
'96.jpeg':('What air contains and how dust, smoke, and germs make it dirty.',['Water vapour','Smoke and dust','Germs','Clean air']),
'97.jpeg':('Properties of air and keeping air clean.',['Air fills space','Air gives shape','Air has weight','Growing plants']),
'98.jpeg':('Recall questions and a summary of Air Around Us.',['True/false','Wind, breeze, storm','Air properties']),
'99.jpeg':('Air Around Us exercises: fill-in-the-blanks, true/false, multiple choice, and examples.',['Choose the right word','Properties and uses of air','Examples']),
'100.jpeg':('Short-answer questions, a concept map, and wind-powered drawing activities.',['Five short-answer prompts','Concept map','Draw three things']),
'101.jpeg':('Picture comparison, sneezing, hot air, and an air-quality illustration.',['Compare inflated objects','Apply chapter ideas','Read the picture']),
'102.jpeg':('Air-quality picture questions and creative activities.',['Explain dirty air','Write a planting slogan','Make a wind vane']),
}
analysis=[]
for file,d in docs.items():
    if file in air:
        summary,topics=air[file]; note='Scanned textbook page. Check diagrams and any unclear OCR against the original. Question-only prompts need supporting chapter evidence.'
    else:summary,topics,note=summaries[file]
    analysis.append({'documentId':d['id'],'summary':summary,'topics':topics,'note':note})
out={'grade':'Class II','school':'Maple Leaf International School','questions':questions,'analysis':analysis,'coverageNote':'The bank covers evidence present in the imported notes and Air Around Us pages 95–102. The full Dumbo story, Emperor Ashoka chapter, most geography textbook chapters, Harrap spelling sets, and separate Mental Mathematics exercises are not attached. They are syllabus topics, not claimed as imported lessons. Bangla grammar prompts without an answer source remain for teacher review. Model answers are study aids, not an official school answer key.'}
(root/'data/practice.json').write_text(json.dumps(out,ensure_ascii=False,indent=2))
manifest={k:v for k,v in library.items() if k not in ['documents','records']}
manifest['documents']=[{k:v for k,v in d.items() if k!='pages'}|{'pageCount':len(d['pages'])} for d in library['documents']]
manifest['records']=library['records']
(root/'public/documents/import-report.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2))
print(f'{len(questions)} questions; {len(analysis)} document summaries')
