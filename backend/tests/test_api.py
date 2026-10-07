import pytest
from fastapi.testclient import TestClient

from backend import auth
from backend.main import app


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("DATABASE_PATH", str(tmp_path / "new-directory" / "new.db"))
    codes = []
    monkeypatch.setattr(auth, "send_code", lambda email, code, purpose: codes.append((email, code, purpose)) or "email")
    with TestClient(app) as test_client:
        yield test_client, codes, tmp_path


def register(client, codes, username="shreehan", email="shreehan@example.test"):
    assert client.post("/api/auth/signup", json={"username": username, "email": email}).status_code == 200
    code = codes[-1][1]
    ticket = client.post("/api/auth/verify-signup", json={"email": email, "code": code}).json()["ticket"]
    assert client.post("/api/auth/set-password", json={"ticket": ticket, "password": "good-secret-123"}).status_code == 200


def test_signup_login_reset_and_persistent_board(client):
    browser, codes, tmp_path = client
    assert (tmp_path / "new-directory" / "new.db").exists()
    assert browser.get("/api/board").status_code == 401
    register(browser, codes)
    assert browser.get("/api/auth/me").json()["username"] == "shreehan"
    columns = browser.get("/api/board").json()["columns"]
    assert len(columns) == 5
    assert sum(len(column["cards"]) for column in columns) == 9
    columns[0]["name"] = "Dreams"
    moved = columns[0]["cards"].pop()
    columns[2]["cards"].append(moved)
    columns[4]["cards"].append({"id": "new-card", "title": "A little win", "details": "Saved to SQLite"})
    assert browser.put("/api/board", json={"columns": columns}).status_code == 200
    assert browser.get("/api/board").json()["columns"] == columns
    assert browser.put("/api/tasks", json={"tasks": [{"id": "task-new", "title": "New task", "subject": "Science", "priority": "High", "done": True}]}).status_code == 200
    assert browser.get("/api/tasks").json()["tasks"][0]["done"] is True
    assert browser.put("/api/practice-progress", json={"known": ["q1", "q2"]}).status_code == 200
    assert browser.get("/api/practice-progress").json()["known"] == ["q1", "q2"]
    assert browser.post("/api/auth/logout").status_code == 200
    assert browser.get("/api/board").status_code == 401
    assert browser.post("/api/auth/login", json={"username": "shreehan", "password": "good-secret-123"}).status_code == 200
    assert browser.get("/api/board").json()["columns"] == columns
    assert browser.post("/api/auth/forgot-password", json={"email": "shreehan@example.test"}).status_code == 200
    ticket = browser.post("/api/auth/verify-reset", json={"email": "shreehan@example.test", "code": codes[-1][1]}).json()["ticket"]
    assert browser.post("/api/auth/reset-password", json={"ticket": ticket, "password": "new-secret-123"}).status_code == 200
    assert browser.get("/api/auth/me").status_code == 401
    assert browser.post("/api/auth/login", json={"username": "shreehan", "password": "new-secret-123"}).status_code == 200


def test_otp_wrong_code_limited_and_board_scope(client):
    browser, codes, _ = client
    browser.post("/api/auth/signup", json={"username": "first", "email": "first@example.test"})
    wrong = "000000" if codes[-1][1] != "000000" else "999999"
    for _ in range(5):
        assert browser.post("/api/auth/verify-signup", json={"email": "first@example.test", "code": wrong}).status_code == 400
    assert browser.post("/api/auth/verify-signup", json={"email": "first@example.test", "code": codes[-1][1]}).status_code == 400
    assert browser.post("/api/auth/resend-code", json={"email": "first@example.test", "purpose": "signup"}).status_code == 429
    register(browser, codes, "second", "second@example.test")
    own = browser.get("/api/board").json()["columns"]
    own[0]["id"] = "some-other-board-column"
    assert browser.put("/api/board", json={"columns": own}).status_code == 400
    assert browser.get("/api/board").json()["columns"][0]["name"] == "Ideas"


def test_static_login_and_api_guard(client):
    browser, _, _ = client
    assert browser.get("/login").status_code == 200
    assert "Ready to explore?" in browser.get("/login").text
    assert browser.get("/api/library").status_code == 401
    assert browser.post("/api/assistant", json={"message": "Hello"}).status_code == 401


def test_security_headers_and_cross_origin_write_guard(client):
    browser, _, _ = client
    response = browser.get("/login")
    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.headers["x-frame-options"] == "DENY"
    assert "frame-ancestors 'none'" in response.headers["content-security-policy"]
    assert response.headers["cache-control"] == "private, no-store"
    endpoint = "/api/auth/signup"
    payload = {"username": "guard_test", "email": "guard@example.test"}
    for headers in (
        {"Sec-Fetch-Site": "cross-site"},
        {"Sec-Fetch-Site": "same-site"},
        {"Origin": "https://evil.test"},
        {"Origin": "http://testserver/other"},
    ):
        rejected = browser.post(endpoint, json=payload, headers=headers)
        assert rejected.status_code == 403
        assert rejected.headers["x-content-type-options"] == "nosniff"
    assert browser.post(endpoint, json=payload, headers={"Origin": "http://testserver"}).status_code == 200


def test_two_accounts_cannot_edit_each_others_board(client):
    browser, codes, _ = client
    register(browser, codes, "first_user", "first@example.test")
    first_board = browser.get("/api/board").json()["columns"]
    browser.post("/api/auth/logout")
    register(browser, codes, "second_user", "second@example.test")
    second_board = browser.get("/api/board").json()["columns"]
    assert first_board[0]["id"] != second_board[0]["id"]
    assert browser.put("/api/board", json={"columns": first_board}).status_code == 400
    assert browser.get("/api/board").json()["columns"] == second_board


def test_change_password_requires_session_and_matching_confirmation(client):
    browser, codes, _ = client
    endpoint = "/api/auth/change-password"
    assert browser.post(endpoint, json={"new_password": "replacement-123", "confirm_password": "replacement-123"}).status_code == 401
    register(browser, codes)
    assert browser.post(endpoint, json={"new_password": "replacement-123", "confirm_password": "different-123"}).status_code == 400
    assert browser.post(endpoint, json={"new_password": "good-secret-123", "confirm_password": "good-secret-123"}).status_code == 400
    assert browser.post(endpoint, json={"new_password": "12345", "confirm_password": "12345"}).status_code == 422
    assert browser.post(endpoint, json={"new_password": "abc123", "confirm_password": "abc123"}).status_code == 200
    assert browser.get("/api/auth/me").status_code == 200
    browser.post("/api/auth/logout")
    assert browser.post("/api/auth/login", json={"username": "shreehan", "password": "good-secret-123"}).status_code == 401
    assert browser.post("/api/auth/login", json={"username": "shreehan", "password": "abc123"}).status_code == 200


def test_first_and_reset_password_accept_six_characters(client):
    browser, codes, _ = client
    email = "short@example.test"
    assert browser.post("/api/auth/signup", json={"username": "short_user", "email": email}).status_code == 200
    ticket = browser.post("/api/auth/verify-signup", json={"email": email, "code": codes[-1][1]}).json()["ticket"]
    assert browser.post("/api/auth/set-password", json={"ticket": ticket, "password": "12345"}).status_code == 422
    assert browser.post("/api/auth/set-password", json={"ticket": ticket, "password": "123456"}).status_code == 200
    assert browser.post("/api/auth/forgot-password", json={"email": email}).status_code == 200
    ticket = browser.post("/api/auth/verify-reset", json={"email": email, "code": codes[-1][1]}).json()["ticket"]
    assert browser.post("/api/auth/reset-password", json={"ticket": ticket, "password": "12345"}).status_code == 422
    assert browser.post("/api/auth/reset-password", json={"ticket": ticket, "password": "654321"}).status_code == 200
    assert browser.post("/api/auth/login", json={"username": "short_user", "password": "654321"}).status_code == 200


def test_idle_expiry_polling_and_absolute_expiry(client):
    from backend.db import connection
    browser, codes, _ = client
    register(browser, codes)
    with connection() as db:
        db.execute("UPDATE sessions SET last_active_at=?", (auth.utc_after(minutes=-31),))
    response = browser.get('/api/auth/me')
    assert response.status_code == 401
    assert 'no-store' in response.headers['cache-control']
    assert 'Max-Age=0' in response.headers['set-cookie']
    browser.post('/api/auth/login', json={'username': 'shreehan', 'password': 'good-secret-123'})
    with connection() as db:
        before = db.execute('SELECT last_active_at FROM sessions').fetchone()[0]
    browser.get('/api/auth/me')
    browser.get('/api/library')
    with connection() as db:
        assert db.execute('SELECT last_active_at FROM sessions').fetchone()[0] == before
    assert browser.post('/api/auth/activity').status_code == 200
    with connection() as db:
        assert db.execute('SELECT last_active_at FROM sessions').fetchone()[0] > before
        db.execute('UPDATE sessions SET expires_at=?', (auth.utc_after(minutes=-1),))
    assert browser.post('/api/auth/activity').status_code == 401


def test_rotation_revocation_and_cross_origin(client):
    from backend.db import connection
    browser, codes, _ = client
    register(browser, codes)
    old = browser.cookies.get(auth.COOKIE)
    browser.post('/api/auth/login', json={'username': 'shreehan', 'password': 'good-secret-123'})
    assert browser.cookies.get(auth.COOKIE) != old
    with connection() as db:
        assert db.execute('SELECT count(*) FROM sessions').fetchone()[0] == 1
    other = TestClient(app)
    other.post('/api/auth/login', json={'username': 'shreehan', 'password': 'good-secret-123'})
    old = browser.cookies.get(auth.COOKIE)
    assert browser.post('/api/auth/change-password', json={'new_password':'replacement-123', 'confirm_password':'replacement-123'}).status_code == 200
    assert browser.cookies.get(auth.COOKIE) != old
    assert other.get('/api/auth/me').status_code == 401
    assert browser.post('/api/auth/logout', headers={'Origin':'https://evil.test'}).status_code == 403
    assert browser.get('/api/auth/me').status_code == 200
    assert browser.post('/api/auth/logout-all').status_code == 200
    assert browser.get('/api/auth/me').status_code == 401


def test_head_navigation_and_secure_cookie(client, monkeypatch):
    browser, codes, _ = client
    assert browser.head('/login').status_code == 200
    assert browser.head('/', follow_redirects=False).status_code == 303
    monkeypatch.setenv('APP_ENV', 'production')
    register(browser, codes)
    cookie = browser.cookies.get(auth.COOKIE)
    assert cookie
    # HTTPS-only cookies must not authenticate an HTTP request.
    assert browser.get('/api/auth/me').status_code == 401


def test_email_failure_rolls_back_signup_and_can_retry(client,monkeypatch):
    browser,codes,_ = client
    def fail(*args): raise RuntimeError('We could not send your code. Please try again in a minute.')
    monkeypatch.setattr(auth,'send_code',fail)
    body = {'username':'delivery_retry','email':'retry@example.test'}
    assert browser.post('/api/auth/signup',json=body).status_code == 503
    from backend.db import connection
    with connection() as db:
        assert db.execute('SELECT id FROM users WHERE email=?',(body['email'],)).fetchone() is None
    monkeypatch.setattr(auth,'send_code',lambda email,code,purpose:codes.append((email,code,purpose)) or 'email')
    register(browser,codes,body['username'],body['email'])
    assert browser.post('/api/auth/verify-signup',json={'email':body['email'],'code':codes[-1][1]}).status_code == 400


def test_signup_through_resend_adapter(client,monkeypatch):
    import httpx
    from backend import mailer
    browser,_,_ = client
    sent=[]
    monkeypatch.setenv('RESEND_API_KEY','test-key')
    monkeypatch.setenv('RESEND_FROM','otp@example.test')
    monkeypatch.setattr(auth,'send_code',mailer.send_code)
    def deliver(url,**kwargs):
        sent.append(kwargs['json'])
        return httpx.Response(200,json={'id':'test-message'},request=httpx.Request('POST',url))
    monkeypatch.setattr(mailer.httpx,'post',deliver)
    body={'username':'resend_user','email':'resend@example.test'}
    response=browser.post('/api/auth/signup',json=body)
    assert response.status_code == 200
    assert response.json()['delivery'] == 'email'
    import re
    code=re.search(r'Your code is ([0-9]{6})',sent[0]['text']).group(1)
    assert sent[0]['to'] == [body['email']]
    assert code not in response.text
    ticket=browser.post('/api/auth/verify-signup',json={'email':body['email'],'code':code}).json()['ticket']
    assert browser.post('/api/auth/set-password',json={'ticket':ticket,'password':'safe-test-password'}).status_code == 200
    assert browser.get('/api/auth/me').json()['email'] == body['email']
