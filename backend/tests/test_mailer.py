from backend import mailer


def test_smtp_sends_code_to_requested_address(monkeypatch):
    sent = []

    class FakeSMTP:
        def __init__(self, host, port, timeout):
            assert (host, port, timeout) == ("smtp.example.test", 587, 15)

        def __enter__(self):
            return self

        def __exit__(self, *_args):
            pass

        def starttls(self):
            pass

        def login(self, username, password):
            assert (username, password) == ("sender", "app-password")

        def send_message(self, message):
            sent.append(message)

    monkeypatch.setenv("SMTP_HOST", "smtp.example.test")
    monkeypatch.setenv("SMTP_PORT", "587")
    monkeypatch.setenv("SMTP_USERNAME", "sender")
    monkeypatch.setenv("SMTP_PASSWORD", "app-password")
    monkeypatch.setenv("SMTP_FROM", "Shreehan HQ <sender@example.test>")
    monkeypatch.setattr(mailer.smtplib, "SMTP", FakeSMTP)

    assert mailer.send_code("child@example.test", "123456", "signup") == "email"
    assert sent[0]["To"] == "child@example.test"
    assert "123456" in sent[0].get_content()


import httpx
import pytest


@pytest.fixture(autouse=True)
def clean_email_env(monkeypatch):
    for key in ('RESEND_API_KEY', 'RESEND_FROM', 'SMTP_HOST', 'VERCEL', 'APP_ENV'):
        monkeypatch.delenv(key, raising=False)


def test_resend_delivery(monkeypatch):
    monkeypatch.setenv('RESEND_API_KEY', 'test-secret')
    monkeypatch.setenv('RESEND_FROM', 'Shreehan HQ <otp@example.test>')
    def send(url, **kwargs):
        assert url == 'https://api.resend.com/emails'
        assert kwargs['headers']['Authorization'] == 'Bearer test-secret'
        assert kwargs['json']['to'] == ['recipient@example.test']
        assert '123456' in kwargs['json']['text']
        assert '123456' in kwargs['json']['html']
        assert kwargs['timeout'] == 15
        return httpx.Response(200, json={'id':'accepted'}, request=httpx.Request('POST',url))
    monkeypatch.setattr(mailer.httpx, 'post', send)
    assert mailer.send_code('recipient@example.test','123456','signup') == 'email'


@pytest.mark.parametrize('status', [401,403,422,429,500])
def test_resend_failures_are_safe(monkeypatch,status,capsys):
    monkeypatch.setenv('RESEND_API_KEY','secret')
    monkeypatch.setenv('RESEND_FROM','otp@example.test')
    monkeypatch.setattr(mailer.httpx,'post',lambda *a,**kw:httpx.Response(status,json={'message':'secret 123456'},request=httpx.Request('POST',a[0])))
    with pytest.raises(RuntimeError,match='could not send') as error:
        mailer.send_code('recipient@example.test','123456','signup')
    assert '123456' not in str(error.value)
    assert not capsys.readouterr().out


def test_timeout_and_invalid_receipt(monkeypatch):
    monkeypatch.setenv('RESEND_API_KEY','secret')
    monkeypatch.setenv('RESEND_FROM','otp@example.test')
    def timeout(*a,**kw): raise httpx.ReadTimeout('secret')
    monkeypatch.setattr(mailer.httpx,'post',timeout)
    with pytest.raises(RuntimeError,match='could not send'): mailer.send_code('a@example.test','123456','signup')
    monkeypatch.setattr(mailer.httpx,'post',lambda *a,**kw:httpx.Response(200,json={},request=httpx.Request('POST',a[0])))
    with pytest.raises(RuntimeError,match='could not send'): mailer.send_code('a@example.test','123456','signup')


@pytest.mark.parametrize('settings',[{'VERCEL':'1'},{'APP_ENV':'production'},{'RESEND_API_KEY':'secret'},{'RESEND_FROM':'otp@example.test'}])
def test_missing_config_never_logs_production_codes(monkeypatch,capsys,settings):
    for key,value in settings.items(): monkeypatch.setenv(key,value)
    with pytest.raises(RuntimeError,match='temporarily unavailable'): mailer.send_code('a@example.test','123456','signup')
    assert not capsys.readouterr().out
