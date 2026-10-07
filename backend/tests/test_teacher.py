import pytest
from fastapi.testclient import TestClient
from backend.main import app
from backend.db import connection, initialize_database, now
from backend.auth import hash_password
from backend import teacher, mailer

@pytest.fixture
def classroom(tmp_path, monkeypatch):
    monkeypatch.delenv('TURSO_DATABASE_URL', raising=False)
    monkeypatch.delenv('VERCEL', raising=False)
    monkeypatch.setenv('DATABASE_PATH', str(tmp_path/'classroom.db'))
    with TestClient(app) as client:
        with connection() as db:
            for name in ('teacher', 'student', 'other', 'second_teacher'):
                db.execute('INSERT INTO users VALUES (?,?,?,?,?,?)', (name,name,name+'@example.test',hash_password('test-pass'),now(),now()))
            db.execute('INSERT INTO teachers VALUES (?)', ('teacher',))
            db.execute('INSERT INTO teachers VALUES (?)', ('second_teacher',))
        yield client

def login(client, name):
    assert client.post('/api/auth/login',json={'username':name,'password':'test-pass'}).status_code==200

def work(**overrides):
    return {'student_id':'student','kind':'Homework','subject':'Mathematics','title':'Fractions','instructions':'Complete page 44','due_date':'2026-10-07',**overrides}


def test_daily_teacher_feedback_reaches_admin_and_tracks_read_state(classroom):
    c = classroom
    with connection() as db:
        db.execute('INSERT INTO users VALUES (?,?,?,?,?,?)', ('shuvro','shuvro','shuvro@example.test',hash_password('test-pass'),now(),now()))
        db.execute("INSERT INTO account_roles VALUES ('shuvro','admin')")
    login(c, 'student')
    assert c.get('/api/teacher-feedback/today').status_code == 403
    assert c.put('/api/teacher-feedback/today',json={'body':'Hidden'}).status_code == 403
    assert c.get('/api/admin/feedback').status_code == 403
    login(c, 'teacher')
    assert c.get('/api/teacher-feedback/today').json() == {'day':teacher.bangladesh_day(),'feedback':None}
    assert c.put('/api/teacher-feedback/today',json={'body':'  '}).status_code == 422
    first = c.put('/api/teacher-feedback/today',json={'body':'Shreehan completed his reading.\nNeeds spelling practice.'})
    assert first.status_code == 200
    note_id = first.json()['feedback']['id']
    assert first.json()['feedback']['day'] == teacher.bangladesh_day()
    assert c.put('/api/teacher-feedback/today',json={'body':'Revised daily update.'}).json()['feedback']['id'] == note_id
    with connection() as db:
        assert db.execute('SELECT COUNT(*) AS n FROM daily_teacher_feedback').fetchone()['n'] == 1
    login(c, 'second_teacher')
    assert c.get('/api/teacher-feedback/today').json()['feedback'] is None
    login(c, 'shuvro')
    assert c.get('/api/teacher-feedback/today').status_code == 403
    notifications = c.get('/api/admin/feedback').json()
    assert notifications['unread'] == 1
    assert notifications['items'][0]['body'] == 'Revised daily update.'
    assert notifications['items'][0]['teacher_name'] == 'teacher'
    assert c.put('/api/admin/feedback/missing/read').status_code == 404
    assert c.put(f'/api/admin/feedback/{note_id}/read').status_code == 200
    assert c.get('/api/admin/feedback').json()['unread'] == 0
    login(c, 'teacher')
    assert c.put('/api/teacher-feedback/today',json={'body':'Another update after admin read it.'}).status_code == 200
    login(c, 'shuvro')
    assert c.get('/api/admin/feedback').json()['unread'] == 1


def test_admin_final_teacher_comments_are_date_ordered(classroom):
    c = classroom
    with connection() as db:
        db.execute('INSERT INTO users VALUES (?,?,?,?,?,?)', ('shuvro','shuvro','shuvro@example.test',hash_password('test-pass'),now(),now()))
        db.execute("INSERT INTO account_roles VALUES ('shuvro','admin')")
        for note_id, day, body in (('older','2025-01-04','Final reading comment.'),('newer','2025-01-05','Final maths comment.\nNext step: fractions.')):
            db.execute('INSERT INTO daily_teacher_feedback (id,teacher_id,day,body,created_at,updated_at) VALUES (?,?,?,?,?,?)',
                       (note_id,'teacher',day,body,now(),now()))
    login(c,'shuvro')
    response = c.get('/api/admin/feedback')
    assert response.status_code == 200
    assert [(item['day'],item['body']) for item in response.json()['items']] == [
        ('2025-01-05','Final maths comment.\nNext step: fractions.'),
        ('2025-01-04','Final reading comment.')]


def test_admin_role_management_and_role_boundaries(classroom):
    c = classroom
    with connection() as db:
        db.execute('INSERT INTO users VALUES (?,?,?,?,?,?)', ('shuvro','shuvro','shuvro@example.test',hash_password('test-pass'),now(),now()))
        db.execute("INSERT INTO account_roles VALUES ('shuvro','admin')")
    login(c, 'shuvro')
    assert c.get('/api/auth/me').json()['role'] == 'admin'
    assert c.get('/api/admin/users').status_code == 200
    assert c.get('/api/tasks').status_code == 403
    assert c.get('/api/library').status_code == 403
    assert c.get('/api/coursework').status_code == 403
    assert c.put('/api/admin/users/shuvro/role', json={'role':'student'}).status_code == 400
    assert c.put('/api/admin/users/teacher/role', json={'role':'student'}).status_code == 200
    assert c.put('/api/admin/users/student/role', json={'role':'teacher'}).status_code == 200
    with connection() as db:
        assert db.execute("SELECT role FROM account_roles WHERE user_id='teacher'").fetchone()['role'] == 'student'
        assert db.execute("SELECT user_id FROM teachers WHERE user_id='teacher'").fetchone() is not None
        assert db.execute("SELECT user_id FROM teachers WHERE user_id='student'").fetchone() is not None
    login(c, 'teacher')
    assert c.get('/api/auth/me').json()['role'] == 'student'
    assert c.get('/api/admin/users').status_code == 403
    assert c.post('/api/coursework/class-task', json={'kind':'Homework','subject':'Science','title':'Read','due_date':'2026-10-07'}).status_code == 403
    login(c, 'second_teacher')
    created = c.post('/api/coursework/class-task', json={'kind':'Homework','subject':'Science','title':'Read','due_date':'2026-10-07'})
    assert created.status_code == 201 and created.json()['count'] == 2
    assert {s['username'] for s in c.get('/api/coursework').json()['students']} == {'teacher','other'}


def test_admin_creates_updates_and_deletes_accounts(classroom):
    c = classroom
    with connection() as db:
        db.execute('INSERT INTO users VALUES (?,?,?,?,?,?)', ('shuvro','shuvro','shuvro@example.test',hash_password('test-pass'),now(),now()))
        db.execute("INSERT INTO account_roles VALUES ('shuvro','admin')")
    login(c, 'shuvro')
    body = {'username':'new_student','email':'new@example.test','password':'new-pass','role':'student'}
    assert c.post('/api/admin/users',json={**body,'email':'invalid'}).status_code == 400
    created = c.post('/api/admin/users',json=body)
    assert created.status_code == 201
    user_id = created.json()['id']
    assert c.post('/api/admin/users',json=body).status_code == 409
    with connection() as db:
        assert db.execute('SELECT id FROM boards WHERE user_id=?',(user_id,)).fetchone() is not None
    updated = c.put(f'/api/admin/users/{user_id}',json={'username':'new_teacher','email':'teacher2@example.test','role':'teacher','password':'changed-pass'})
    assert updated.status_code == 200
    assert next(user for user in updated.json()['users'] if user['id']==user_id)['role']=='teacher'
    assert c.put('/api/admin/users/shuvro',json={'username':'changed','email':'changed@example.test','role':'student'}).status_code == 400
    assert c.delete('/api/admin/users/shuvro').status_code == 400
    assert c.post('/api/auth/login',json={'username':'new_teacher','password':'changed-pass'}).status_code == 200
    task=c.post('/api/coursework',json=work())
    assert task.status_code == 201
    login(c, 'shuvro')
    assert c.delete(f'/api/admin/users/{user_id}').status_code == 200
    assert c.delete(f'/api/admin/users/{user_id}').status_code == 404
    with connection() as db:
        assert db.execute('SELECT id FROM users WHERE id=?',(user_id,)).fetchone() is None
        assert db.execute('SELECT id FROM coursework WHERE teacher_id=?',(user_id,)).fetchone() is None
    login(c, 'student')
    assert c.get('/api/admin/users').status_code == 403
    assert c.post('/api/admin/users',json=body).status_code == 403
    assert c.delete('/api/admin/users/teacher').status_code == 403


def test_admin_controls_role_menu_access(classroom):
    c=classroom
    with connection() as db:
        db.execute('INSERT INTO users VALUES (?,?,?,?,?,?)', ('shuvro','shuvro','shuvro@example.test',hash_password('test-pass'),now(),now()))
        db.execute("INSERT INTO account_roles VALUES ('shuvro','admin')")
    login(c,'shuvro')
    menus=c.get('/api/admin/menu-access').json()['roles']
    assert {item['key'] for item in menus['student']} >= {'overview','library','coursework'}
    assert c.put('/api/admin/menu-access',json={'role':'admin','menu_key':'admin_accounts','enabled':False}).status_code==400
    assert c.put('/api/admin/menu-access',json={'role':'teacher','menu_key':'library','enabled':False}).status_code==400
    result=c.put('/api/admin/menu-access',json={'role':'student','menu_key':'library','enabled':False})
    assert result.status_code==200
    assert next(item for item in result.json()['roles']['student'] if item['key']=='library')['enabled'] is False
    login(c,'student')
    assert 'library' not in c.get('/api/auth/me').json()['menus']
    response=c.get('/library',follow_redirects=False)
    assert response.status_code==303 and response.headers['location']=='/'
    assert c.get('/',follow_redirects=False).status_code==200
    assert c.get('/api/admin/menu-access').status_code==403
    login(c,'shuvro')
    assert c.put('/api/admin/menu-access',json={'role':'teacher','menu_key':'teacher_dashboard','enabled':False}).status_code==200
    assert c.put('/api/admin/menu-access',json={'role':'teacher','menu_key':'coursework','enabled':False}).status_code==409
    login(c,'teacher')
    teacher_page=c.get('/teacher',follow_redirects=False)
    assert teacher_page.status_code==303 and teacher_page.headers['location']=='/coursework'


def test_class_task_reaches_all_active_students_and_preserves_individual_reviews(classroom):
    c = classroom
    body = {'kind': 'Assignment', 'subject': 'Science', 'title': 'Tomorrow’s observation',
            'instructions': 'Describe a rock.', 'due_date': '2026-10-07'}
    login(c, 'student')
    assert c.post('/api/coursework/class-task', json=body).status_code == 403
    login(c, 'teacher')
    for changes in ({'subject': 'Unknown'}, {'title': '   '}, {'kind': 'Exam'}, {'due_date': 'invalid'}):
        assert c.post('/api/coursework/class-task', json={**body, **changes}).status_code == 422
    created = c.post('/api/coursework/class-task', json=body)
    assert created.status_code == 201
    assert created.json()['count'] == 2
    assert len(set(created.json()['ids'])) == 2
    teacher_items = c.get('/api/coursework').json()['items']
    assert len(teacher_items) == 1
    assert teacher_items[0]['student_count'] == 2
    assert {i['student_name'] for i in teacher_items[0]['assignments']} == {'student', 'other'}
    assert teacher_items[0]['kind'] == 'Assignment' and teacher_items[0]['subject'] == 'Science' and teacher_items[0]['status'] == 'pending'
    first = next(i for i in teacher_items[0]['assignments'] if i['student_name'] == 'student')
    second = next(i for i in teacher_items[0]['assignments'] if i['student_name'] == 'other')
    assert c.put(f"/api/coursework/{first['id']}/review", json={'status': 'completed', 'score': 8}).status_code == 200
    login(c, 'student')
    assert [i['id'] for i in c.get('/api/coursework').json()['items']] == [first['id']]
    login(c, 'other')
    assert [i['id'] for i in c.get('/api/coursework').json()['items']] == [second['id']]
    assert c.get('/api/coursework').json()['items'][0]['status'] == 'pending'


def test_three_review_states_are_saved_and_grouped(classroom):
    c = classroom
    login(c, 'teacher')
    created = c.post('/api/coursework/class-task', json={'kind':'Homework','subject':'Science','title':'Read today','due_date':'2026-10-07'})
    first, second = created.json()['ids']
    assert c.get('/api/coursework').json()['items'][0]['review_state'] == 'not_done'
    half = c.put(f'/api/coursework/{first}/review', json={'status':'half_done','score':5,'remarks':'Working through the lesson.'})
    assert half.status_code == 200
    assert half.json()['status'] == 'pending' and half.json()['review_state'] == 'half_done'
    assert c.get('/api/coursework').json()['items'][0]['review_state'] == 'half_done'
    assert c.put(f'/api/coursework/{second}/review', json={'status':'completed','score':9}).status_code == 200
    assert c.get('/api/coursework').json()['items'][0]['review_state'] == 'half_done'
    assert c.put(f'/api/coursework/{first}/review', json={'status':'completed','score':8}).status_code == 200
    assert c.get('/api/coursework').json()['items'][0]['review_state'] == 'done'
    assert c.put(f'/api/coursework/{first}/review', json={'status':'pending','score':None}).status_code == 200
    assert c.get('/api/coursework').json()['items'][0]['review_state'] == 'half_done'


def test_existing_coursework_review_states_are_backfilled(classroom):
    c = classroom
    login(c, 'teacher')
    item = c.post('/api/coursework', json=work()).json()['id']
    assert c.put(f'/api/coursework/{item}/review', json={'status':'completed','score':8}).status_code == 200
    with connection() as db:
        db.execute('ALTER TABLE coursework DROP COLUMN review_state')
        db.execute("DELETE FROM app_migrations WHERE name='coursework_review_state'")
    initialize_database()
    with connection() as db:
        row = db.execute('SELECT status,review_state FROM coursework WHERE id=?', (item,)).fetchone()
    assert row['status'] == 'completed' and row['review_state'] == 'done'


def test_teacher_deletes_one_class_task_and_all_its_assignments(classroom):
    c = classroom
    login(c, 'teacher')
    body = {'kind': 'Homework', 'subject': 'Poetry', 'title': 'Read a poem', 'due_date': '2026-10-07'}
    first = c.post('/api/coursework/class-task', json=body).json()
    second = c.post('/api/coursework/class-task', json={**body, 'title': 'Write a poem'}).json()
    items = c.get('/api/coursework').json()['items']
    assert len(items) == 2
    assert c.delete(f"/api/coursework/class-task/{first['ids'][0]}").json() == {'deleted': 2}
    assert [i['title'] for i in c.get('/api/coursework').json()['items']] == ['Write a poem']
    assert c.delete(f"/api/coursework/class-task/{first['ids'][0]}").status_code == 404
    login(c, 'second_teacher')
    assert c.delete(f"/api/coursework/class-task/{second['ids'][0]}").status_code == 404
    login(c, 'student')
    assert c.delete(f"/api/coursework/class-task/{second['ids'][0]}").status_code == 403
    assert [i['title'] for i in c.get('/api/coursework').json()['items']] == ['Write a poem']


def test_class_task_requires_an_active_student(classroom):
    c = classroom
    login(c, 'teacher')
    with connection() as db:
        db.execute("UPDATE users SET verified_at=NULL WHERE username IN ('student','other')")
    response = c.post('/api/coursework/class-task', json={
        'kind': 'Homework', 'subject': 'Poetry', 'title': 'Read a poem', 'due_date': '2026-10-07'})
    assert response.status_code == 409
    assert c.get('/api/coursework').json()['items'] == []

def test_teacher_student_lifecycle_and_isolation(classroom):
    c=classroom
    assert c.get('/api/coursework').status_code==401
    login(c,'teacher')
    assert c.get('/api/auth/me').json()['role']=='teacher'
    data=c.get('/api/coursework').json()
    assert len(data['subjects'])==11
    assert {s['id'] for s in data['students']}=={'student','other'}
    created=c.post('/api/coursework',json=work())
    assert created.status_code==201
    item=created.json()['id']
    assert c.put(f'/api/coursework/{item}',json=work(title='Updated fractions')).status_code==200
    assert c.put(f'/api/coursework/{item}/submission',json={'submission':'answer'}).status_code==403
    login(c,'second_teacher')
    assert c.get('/api/coursework').json()['items']==[]
    assert c.put(f'/api/coursework/{item}/review',json={'status':'completed','score':10}).status_code==404
    login(c,'other')
    assert c.get('/api/coursework').json()['items']==[]
    assert c.put(f'/api/coursework/{item}/submission',json={'submission':'answer'}).status_code==404
    login(c,'student')
    assert c.get('/api/auth/me').json()['role']=='student'
    assert c.get('/api/coursework/sources').status_code==403
    assert c.post('/api/coursework',json=work()).status_code==403
    assert c.post(f'/api/coursework/{item}/email').status_code==403
    assert c.put(f'/api/coursework/{item}/review',json={'status':'completed','score':10}).status_code==403
    assert c.put(f'/api/coursework/{item}/submission',json={'submission':'   '}).status_code==422
    assert c.put(f'/api/coursework/{item}/submission',json={'submission':'My answers: 1/2 and 1/4'}).status_code==200
    login(c,'teacher')
    assert c.get('/api/coursework').json()['items'][0]['submission'].startswith('My answers')
    assert c.put(f'/api/coursework/{item}/review',json={'status':'completed','score':9,'remarks':'Great work'}).status_code==200
    login(c,'student')
    saved=c.get('/api/coursework').json()['items'][0]
    assert saved['score']==9 and saved['status']=='completed'
    assert c.put(f'/api/coursework/{item}/submission',json={'submission':'changed'}).status_code==409
    login(c,'teacher')
    assert c.put(f'/api/coursework/{item}/review',json={'status':'pending','score':5,'remarks':'Try again'}).status_code==200
    login(c,'student')
    revised=c.put(f'/api/coursework/{item}/submission',json={'submission':'Revised answers'}).json()
    assert revised['score'] is None and revised['reviewed_at'] is None

def test_validation_sources_and_email(classroom, monkeypatch):
    c=classroom
    monkeypatch.setattr(teacher,'current_library',lambda:{'homework':{'items':[{'id':'source','title':'Old work','notionUrl':'https://notion.so/example'}]},'records':[]})
    login(c,'teacher')
    for changes in ({'subject':'Unknown'},{'title':'  '},{'due_date':'not a date'},{'kind':'Exam'}):
        assert c.post('/api/coursework',json=work(**changes)).status_code==422
    assert c.post('/api/coursework',json=work(student_id='teacher')).status_code==400
    assert c.post('/api/coursework',json=work(source_id='missing')).status_code==400
    body=work(source_id='homework:source')
    item=c.post('/api/coursework',json=body).json()['id']
    assert c.post('/api/coursework',json=body).status_code==409
    assert c.post(f'/api/coursework/{item}/email').status_code==400
    for score in (0,11,1.5,True):
        assert c.put(f'/api/coursework/{item}/review',json={'status':'pending','score':score}).status_code==422
    for score in (1,10,None):
        assert c.put(f'/api/coursework/{item}/review',json={'status':'completed','score':score,'remarks':'Good progress'}).status_code==200
    sent=[]
    monkeypatch.setattr(teacher,'send_teacher_remarks',lambda student,row:sent.append((student,row)))
    assert c.post(f'/api/coursework/{item}/email').status_code==200
    assert sent[0][0]=='student' and sent[0][1]['remarks']=='Good progress'
    plain=c.post('/api/coursework',json=work(title='Status-only review')).json()['id']
    assert c.put(f'/api/coursework/{plain}/review',json={'status':'half_done','score':5}).status_code==200
    assert c.post(f'/api/coursework/{plain}/email').status_code==200
    assert sent[-1][1]['review_state']=='half_done' and sent[-1][1]['remarks']==''
    def fail(*args): raise RuntimeError('Delivery failed')
    monkeypatch.setattr(teacher,'send_teacher_remarks',fail)
    assert c.post(f'/api/coursework/{item}/email').status_code==503
    assert next(row for row in c.get('/api/coursework').json()['items'] if row['id']==item)['remarks']=='Good progress'

def test_remarks_provider_is_fixed_recipient_and_idempotent(monkeypatch):
    monkeypatch.setenv('RESEND_API_KEY','test-key')
    monkeypatch.setenv('RESEND_FROM','onboarding@resend.dev')
    calls=[]
    import httpx
    def send(url,**kwargs):
        calls.append(kwargs)
        return httpx.Response(200,json={'id':'test-id'},request=httpx.Request('POST',url))
    monkeypatch.setattr(mailer.httpx,'post',send)
    row={'id':'w','updated_at':'v1','kind':'Homework','title':'Title','subject':'Science','due_date':'2026-10-07','status':'pending','review_state':'half_done','score':8,'remarks':'Keep going'}
    mailer.send_teacher_remarks('student',row)
    mailer.send_teacher_remarks('student',row)
    assert calls[0]['json']['to']==['sun.srs86@gmail.com']
    assert '8/10' in calls[0]['json']['text']
    assert 'Status: Half Done' in calls[0]['json']['text']
    assert calls[0]['headers']['Idempotency-Key']==calls[1]['headers']['Idempotency-Key']
    monkeypatch.delenv('RESEND_API_KEY')
    with pytest.raises(RuntimeError): mailer.send_teacher_remarks('student',row)
