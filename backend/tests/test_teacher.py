import pytest
from fastapi.testclient import TestClient
from backend.main import app
from backend.db import connection, now
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
    def fail(*args): raise RuntimeError('Delivery failed')
    monkeypatch.setattr(teacher,'send_teacher_remarks',fail)
    assert c.post(f'/api/coursework/{item}/email').status_code==503
    assert c.get('/api/coursework').json()['items'][0]['remarks']=='Good progress'

def test_remarks_provider_is_fixed_recipient_and_idempotent(monkeypatch):
    monkeypatch.setenv('RESEND_API_KEY','test-key')
    monkeypatch.setenv('RESEND_FROM','onboarding@resend.dev')
    calls=[]
    import httpx
    def send(url,**kwargs):
        calls.append(kwargs)
        return httpx.Response(200,json={'id':'test-id'},request=httpx.Request('POST',url))
    monkeypatch.setattr(mailer.httpx,'post',send)
    row={'id':'w','updated_at':'v1','kind':'Homework','title':'Title','subject':'Science','due_date':'2026-10-07','status':'completed','score':8,'remarks':'Keep going'}
    mailer.send_teacher_remarks('student',row)
    mailer.send_teacher_remarks('student',row)
    assert calls[0]['json']['to']==['sun.srs86@gmail.com']
    assert '8/10' in calls[0]['json']['text']
    assert calls[0]['headers']['Idempotency-Key']==calls[1]['headers']['Idempotency-Key']
    monkeypatch.delenv('RESEND_API_KEY')
    with pytest.raises(RuntimeError): mailer.send_teacher_remarks('student',row)
