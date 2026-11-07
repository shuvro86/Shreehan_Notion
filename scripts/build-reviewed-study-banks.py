"""Build the reviewed Class II Geography and Mathematics Study Note banks."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCES = {
    'geo': ('10UoJ3ZoAG9Rh2xeOGMe0XjsuyX_H3Ruo', 'Geography.pdf'),
    'math1': ('1MajrOzcGIiNpM0x-V9KU4ow5oKDeRVV4', 'Math1.pdf'),
    'math2': ('1-8v7hmVKkX5Baop3f6V1HHJT6XzEHClY', 'Math2.pdf'),
}

geography = [
('The shape of the land','geo',1,'What is a mountain?','A very high area of land.'),
('The shape of the land','geo',1,'What is a valley?','A low area between hills or mountains.'),
('The shape of the land','geo',1,'Which way does river water usually flow?','Downhill, towards lower land.'),
('The shape of the land','geo',1,'How can water travel from mountains to the sea?','Through streams and rivers.'),
('The shape of the land','geo',1,'What does downstream mean?','In the direction the water flows.'),
('The shape of the land','geo',1,'What is a waterfall?','Water falling over a steep drop.'),
('The shape of the land','geo',1,'Which continent is the River Nile in?','Africa.'),
('The shape of the land','geo',1,'Why should we keep waste out of rivers?','It can pollute the water and harm living things.'),
('Volcanoes','geo',3,'What is a volcano?','An opening in Earth’s surface where hot material can come out.'),
('Volcanoes','geo',3,'What can come out when a volcano erupts?','Lava, ash and gases.'),
('Volcanoes','geo',3,'What is magma?','Melted rock beneath Earth’s surface.'),
('Volcanoes','geo',3,'What is lava?','Melted rock that reaches Earth’s surface.'),
('Volcanoes','geo',3,'What happens when lava cools?','It becomes solid rock.'),
('Volcanoes','geo',3,'What is the crater of a volcano?','The bowl-shaped hollow around its opening.'),
('Volcanoes','geo',3,'What is Earth’s thin, solid outer layer called?','The crust.'),
('Volcanoes','geo',3,'Is every mountain a volcano?','No, many mountains are not volcanoes.'),
('World Wonders','geo',6,'What is an iceberg?','A large piece of ice floating in the sea.'),
('World Wonders','geo',6,'Where can we find natural wonders?','On land, in the sea and in the sky.'),
('World Wonders','geo',6,'Name one wonder Azim saw in the story.','An iceberg, a cave or the northern lights.'),
('World Wonders','geo',6,'What did Azim see inside the cave?','Many amazing shapes.'),
('World Wonders','geo',6,'What are the northern lights?','Colourful lights that can be seen in the night sky.'),
('World Wonders','geo',6,'Which wonder did Azim see floating in the sea?','An iceberg.'),
('World Wonders','geo',6,'In which country is the Great Barrier Reef?','Australia.'),
('World Wonders','geo',6,'In which country is Stonehenge?','The United Kingdom.'),
('Experiencing the weather','geo',7,'What is weather?','What the sky and air are like at a place and time.'),
('Experiencing the weather','geo',7,'Can the weather change during a day?','Yes, it can become sunny, rainy or windy.'),
('Experiencing the weather','geo',7,'What is a breeze?','A gentle wind.'),
('Experiencing the weather','geo',7,'What is a gale?','A very strong wind.'),
('Experiencing the weather','geo',7,'What can help keep us dry in the rain?','An umbrella or a raincoat.'),
('Experiencing the weather','geo',7,'What can we fly on a windy day?','A kite, when it is safe to do so.'),
('Experiencing the weather','geo',7,'What can children make when it snows?','A snowman.'),
('Experiencing the weather','geo',7,'Why might a strong wind make an umbrella hard to hold?','The wind can push or turn the umbrella.'),
]

mathematics = [
('Mental mathematics and place value','math1',1,'What is 8 + 5?','13.'),
('Mental mathematics and place value','math1',1,'What is 16 − 7?','9.'),
('Mental mathematics and place value','math1',1,'What number is 9 tens and 6 ones?','96.'),
('Mental mathematics and place value','math1',1,'How many tens are in 200?','20 tens.'),
('Mental mathematics and place value','math1',1,'What is 8 less than 15?','7.'),
('Mental mathematics and place value','math1',1,'What is 200 − 110?','90.'),
('Mental mathematics and place value','math1',3,'What is 136 + 2?','138.'),
('Mental mathematics and place value','math1',3,'What must be subtracted from 180 to get 170?','10.'),
('Mental mathematics and place value','math1',3,'What is 399 + 1?','400.'),
('Mental mathematics and place value','math1',5,'Which number comes just before 116?','115.'),
('Multiplication and division','math2',1,'What is 7 × 2?','14.'),
('Multiplication and division','math2',1,'What is 12 × 3?','36.'),
('Multiplication and division','math2',1,'What is 20 × 4?','80.'),
('Multiplication and division','math2',2,'If one book costs Tk 5, how much do 3 books cost?','Tk 15.'),
('Multiplication and division','math2',3,'If each of 4 classes has 10 children, how many children are there?','40 children.'),
('Multiplication and division','math2',4,'What is 6 × 5?','30.'),
('Multiplication and division','math2',8,'What is 12 ÷ 3?','4.'),
('Multiplication and division','math2',8,'If 18 sweets are shared equally among 3 children, how many does each get?','6 sweets.'),
('Multiplication and division','math2',8,'What is 20 ÷ 5?','4.'),
('Multiplication and division','math2',8,'What is 36 ÷ 4?','9.'),
('Taka and paisa','math1',1,'How many paisa make Tk 1?','100 paisa.'),
('Taka and paisa','math1',1,'What is 60p + 60p + 60p in taka?','Tk 1.80.'),
('Taka and paisa','math1',3,'How many paisa are in Tk 3.98?','398 paisa.'),
('Taka and paisa','math1',5,'How many paisa are in Tk 20.66?','2,066 paisa.'),
('Taka and paisa','math2',9,'How many paisa are in Tk 25.75?','2,575 paisa.'),
('Taka and paisa','math2',10,'How many paisa are in Tk 4.05?','405 paisa.'),
('Taka and paisa','math2',12,'Write 895 paisa in taka.','Tk 8.95.'),
('Taka and paisa','math2',11,'Write 14,320 paisa in taka.','Tk 143.20.'),
('Taka and paisa','math2',13,'What is Tk 3.25 + Tk 1.20?','Tk 4.45.'),
('Taka and paisa','math2',14,'What is Tk 8.91 + Tk 1.25?','Tk 10.16.'),
]

def build(subject, rows):
    topics = []
    for index, (title, source, page, question, answer) in enumerate(rows, 1):
        source_id, source_title = SOURCES[source]
        source_url = f'https://drive.google.com/file/d/{source_id}/view'
        topic = next((item for item in topics if item['title'] == title), None)
        if topic is None:
            topic = {'title': title, 'questions': []}
            topics.append(topic)
        topic['questions'].append({
            'id': f'{subject.lower().replace(" ", "-")}-{index:02d}',
            'subject': subject, 'topic': title, 'type': 'Short answer',
            'question': question, 'answer': answer, 'options': [],
            'sources': [{'documentId': source_id, 'page': page}],
            'sourceUrl': source_url, 'sourceTitle': source_title,
        })
    return {'level': 'Class 2', 'collection': 'Study Note', 'subject': subject,
            'topics': topics}

for filename, subject, rows in [
    ('geography-half-yearly.json', 'Geography', geography),
    ('mathematics-half-yearly.json', 'Mathematics', mathematics),
]:
    (ROOT / 'data' / filename).write_text(json.dumps(build(subject, rows), ensure_ascii=False, indent=2) + '\n')
