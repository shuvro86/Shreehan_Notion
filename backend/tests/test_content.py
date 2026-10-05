from backend.content import merged_practice, retrieve
from backend import content


def test_retrieve_prioritizes_matching_document():
    library = {"documents": [
        {"id": "weather", "title": "Clouds", "subject": "Science", "url": "/weather", "pages": [{"number": 1, "text": "Clouds are made of tiny water droplets in the sky."}]},
        {"id": "math", "title": "Multiplication", "subject": "Mathematics", "url": "/math", "pages": [{"number": 1, "text": "Multiplication helps add equal groups of numbers together."}]},
    ]}
    assert retrieve(library, "What are clouds?")[0]["documentId"] == "weather"


def test_merged_practice_filters_stale_curated_content():
    library = {"documents": [{"id": "a", "collection": "Unseen Paper", "sha256": "new", "subject": "Science"}]}
    curated = {"sources": [{"documentId": "a", "sha256": "old", "subject": "Science"}], "questions": [{"sources": [{"documentId": "a"}]}]}
    result = merged_practice(library, curated, {"documents": {}})
    assert result["sources"] == []
    assert result["questions"] == []
    assert result["jobs"][0]["state"] == "queued"


def test_drive_pivot_hides_legacy_snapshot_and_queues_current_materials(tmp_path, monkeypatch):
    monkeypatch.setenv('CONTENT_SOURCE', 'google_drive')
    monkeypatch.setattr(content, 'SYNC_DIR', tmp_path)
    (tmp_path / 'library.json').write_text('{"documents":[{"id":"old"}],"records":[]}')
    assert content.current_library()['documents'] == []
    (tmp_path / 'library.json').write_text('{"sourceType":"google_drive","documents":[{"id":"new","sourceType":"google_drive","collection":"Half Yearly","sha256":"abc","subject":"Science"}],"records":[]}')
    library = content.current_library()
    assert [item['id'] for item in library['documents']] == ['new']
    result = merged_practice(library, {'sources':[], 'questions':[]}, {'documents':{}})
    assert result['jobs'][0]['documentId'] == 'new'


def test_subject_practice_lists_notion_subjects_and_hides_stale_questions():
    doc = {'id': 'science-page', 'subject': 'Science', 'sha256': 'one', 'title': 'Food', 'kind': 'Image', 'sourceType': 'google_drive', 'pages': [{'number': 1, 'text': 'Plants give us food.', 'method': 'OCR', 'confidence': 90}]}
    library = {'records': [{'id': 'science', 'collection': 'Subject Materials', 'subject': 'Science', 'url': 'https://notion.test/science'}], 'documents': [doc]}
    sources = [['science-page', 'one', content.version_key(doc)]]
    saved = {'subjects': {'Science': {'sources': sources, 'target': 15, 'state': 'ready', 'message': 'Ready', 'questions': [{'id': 'q1'}]}}}
    result = content.subject_practice_view(library, saved)
    assert result['subjects'][0]['name'] == 'Science'
    assert result['subjects'][0]['questions'] == [{'id': 'q1'}]
    assert result['subjects'][0]['documentIds'] == ['science-page']
    doc['pages'][0]['text'] = 'Plants give us fresh food.'
    stale = content.subject_practice_view(library, saved)['subjects'][0]
    assert stale['questions'] == []
    assert stale['state'] == 'queued'


def test_subject_practice_source_order_does_not_hide_completed_bank():
    documents = [{'id': id_, 'subject': 'Science', 'sha256': id_, 'title': id_, 'kind': 'Image', 'sourceType': 'google_drive', 'pages': []} for id_ in ('1-z', '1_a')]
    library = {'records': [{'collection': 'Subject Materials', 'subject': 'Science', 'url': 'https://notion.test/science'}], 'documents': documents}
    sources = [[doc['id'], doc['sha256'], content.version_key(doc)] for doc in documents]
    saved = {'subjects': {'Science': {'sources': list(reversed(sources)), 'target': 15, 'state': 'ready', 'questions': [{'id': 'question'}]}}}
    assert content.subject_practice_view(library, saved)['subjects'][0]['questions'] == [{'id': 'question'}]


def test_study_notes_bank_is_isolated_and_removed_sources_hide_answers():
    doc = {'id': 'note', 'subject': 'Science', 'collection': 'Study Note', 'sha256': 'one', 'title': 'Food', 'pages': []}
    library = {'records': [{'collection': 'Study Note', 'subject': 'Science', 'url': 'https://notion.test/note'}], 'documents': [doc, {**doc, 'id': 'material', 'collection': 'Subject Materials'}]}
    saved = {'subjects': {'Study Note:Science': {'sources': [['note', 'one', content.version_key(doc)]], 'questions': [{'id': 'note-question'}]}, 'Science': {'questions': [{'id': 'wrong-bank'}]}}}
    result = content.subject_practice_view(library, saved, 'Study Note')['subjects'][0]
    assert result['documentIds'] == ['note']
    assert result['questions'] == [{'id': 'note-question'}]
    library['documents'] = []
    assert content.subject_practice_view(library, saved, 'Study Note')['subjects'][0]['questions'] == []
    library['records'] = []
    assert content.subject_practice_view(library, saved, 'Study Note')['subjects'] == []
