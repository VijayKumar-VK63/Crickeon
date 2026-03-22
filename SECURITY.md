# Reporting Security Vulnerabilities

If you discover a security vulnerability in Crickeon, please report it responsibly by emailing `security@crickeon.app` instead of using the public issue tracker.

## What to Include

Please provide:

1. **Description**: Clear explanation of the vulnerability
2. **Steps to reproduce**: Clear instructions to trigger the issue
3. **Impact**: What could go wrong if exploited?
4. **Suggested fix** (optional): Your proposed solution
5. **Your contact info**: So we can follow up

## What Happens Next

1. We acknowledge receipt within 24 hours
2. We assess the severity and impact
3. We develop and test a fix
4. We release a patch and credit you (unless you prefer anonymity)

## Security Considerations

Crickeon is built with security in mind:

- **JWT tokens**: Validated on every request with refresh rotation
- **Rate limiting**: Redis-backed per-user, per-endpoint protection
- **Input validation**: All API inputs validated via Zod schemas
- **Database encryption**: TLS in transit, encryption at rest on production
- **Secrets management**: Never committed to git (use .env or platform secrets)
- **ACID compliance**: Distributed locks prevent race conditions in financial operations

## Responsible Disclosure

Please do not:
- Publicly disclose the vulnerability before we confirm it's fixed
- Exploit the vulnerability in production systems
- Attempt to access data not intended for you
- Test on systems you don't own

We will:
- Respond promptly to your report
- Work diligently to fix the issue
- Provide credit in the security report (unless you prefer anonymity)

## Attribution

Thank you for helping keep Crickeon secure for all users. Your responsible disclosure is greatly appreciated.

---

Email: `security@crickeon.app`
