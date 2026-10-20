# Security Policy

## Supported Versions

Only the `main` branch and the live deployment at https://www.kefkenahsap.com receive security fixes. There are no versioned releases.

| Target | Supported |
|--------|-----------|
| `main` branch / live site | Yes |
| Anything else (old branches, forks) | No |

## Scope

In scope: the live site (https://www.kefkenahsap.com, including the admin at `/admin`) and the code in this repository.

Out of scope: third-party services the site uses (Cloudflare, Dokploy, Resend, OpenRouter), social engineering, and denial-of-service testing against the live site.

## Reporting a Vulnerability

We appreciate responsible disclosure.

### Preferred: GitHub Private Security Advisory

1. Navigate to https://github.com/senrecep/kefkenahsap/security/advisories
2. Click "Report a vulnerability"
3. Provide details:
   - Description of the issue
   - Affected URL or file
   - Steps to reproduce
   - Suggested fix (if you have one)

### Fallback: Email

If you prefer email or cannot use GitHub:
- Send to: **me@senrecep.com**
- Subject line: `[SECURITY] kefkenahsap`
- Include the same details as above

### Response SLA

We aim to respond to all security reports within **48 hours**. We will:
1. Acknowledge receipt of your report
2. Confirm or dispute the vulnerability
3. Provide a timeline for a fix
4. Discuss coordinated disclosure if applicable

Please do not disclose the vulnerability publicly until a fix is deployed.

## Please Don't

- Access, modify, or delete data that is not yours. The site stores customer inquiries and photos.
- Include real personal data in a report. Describe the problem instead.

## Questions?

For non-security questions, open an issue on [GitHub](https://github.com/senrecep/kefkenahsap/issues) or contact me@senrecep.com.
