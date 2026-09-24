from backend.content import merged_practice, retrieve


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
