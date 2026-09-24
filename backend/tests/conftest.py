import pytest

@pytest.fixture(autouse=True)
def disable_live_notion_in_tests(monkeypatch):
    monkeypatch.setenv('NOTION_SYNC_DISABLED', '1')
