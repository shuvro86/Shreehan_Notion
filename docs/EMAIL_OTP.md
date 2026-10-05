# Email OTP setup

Updated 2026-10-05 (Asia/Dhaka).

## Delivery architecture

FastAPI creates a random six-digit signup code, stores its salted challenge hash in the account database, and sends it through Resend's HTTPS API. The browser never receives the code or provider key. The user enters the emailed code, then chooses a password using a short-lived, single-use verification ticket. Codes expire after ten minutes; five incorrect attempts exhaust a challenge. Resending is limited to once per minute per eligible account and replaces the previous code. Password recovery uses the same mailer with a separate purpose and subject.

Resend is selected when either Resend setting is present; both are required. A failed Resend send returns a safe 503 response without provider details or OTPs. It does not silently switch providers. A failed initial send rolls back user creation so signup can be retried. SMTP remains supported when no Resend settings exist. Console OTP delivery is only available in local development and is always prohibited on Vercel.

## Free service configuration

Resend's free transactional allowance is 3,000 emails/month with a 100/day limit, checked on 2026-10-05: https://resend.com/pricing. This is a hosted email delivery service, not a mailbox. Owning a sender domain is a separate prerequisite and may have a cost.

1. Verify a domain you control in https://resend.com/domains by adding the DNS records Resend supplies. Do not change unrelated DNS records.
2. Use a sending-access API key scoped to that domain.
3. Set these server-only environment variables in the existing **shreehan-notion** Vercel project, Production environment:
   - `RESEND_API_KEY`: the secret key. Never commit it or put it in chat/browser code.
   - `RESEND_FROM`: `Shreehan HQ <otp@your-verified-domain>`.
4. Redeploy after changing Vercel variables. For local execution, put them in the environment file passed to `uv run --env-file ...`.
5. Test signup with an inbox you own: confirm email arrival, enter the code, choose a password, sign out and sign back in. Check resend, wrong/expired codes and recovery.

`onboarding@resend.dev` is restricted testing infrastructure; it is not a production sender for arbitrary users. API acceptance is not proof of inbox delivery. Check Resend email events and the recipient inbox before claiming delivery is verified. Do not enable paid upgrades automatically when a free quota is exhausted.

API reference: https://resend.com/docs/api-reference/emails/send-email

## Observed status

The signed-in Resend account has an existing sending-access key named **Onboarding**, but no verified domains. No Resend or SMTP credentials were configured in the inspected project environment files. A usable key and verified sender are still needed for live delivery. Automated tests use a mocked provider; they do not send email or prove inbox delivery.

Implementation and deployment verification results are recorded in `PIVOT_PROJECT.md`.
