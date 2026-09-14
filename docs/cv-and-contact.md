# Public CV and contacts

The homepage exposes a CV card, contact links and direct access to /cv.
The CV route is lazy-loaded and renders selectable HTML in English or Czech.
It does not embed a PDF viewer or change the site's content-security policy.

The PDF in frontend/src/assets/cv/David_Palynskyj_CV.pdf is a byte-for-byte copy
of David's approved one-page graphic CV from 12 September 2026 (196,016 bytes).
It was inspected for readable layout, contacts and annotations: it includes
email, telephone, GitHub and LinkedIn, and no home address or date of birth.
Only link annotations are present. The private Word files and review drafts
are not bundled. The PDF itself remains English, clearly marked EN in both UIs.

Vite gives the PDF a content-hashed asset URL. Reading the website only loads
HTML/JS; the PDF is fetched when a visitor opens or downloads it. The downloaded
filename stays David_Palynskyj_CV.pdf. Contact links use mailto, tel and HTTPS;
there is no contact form, new backend endpoint or third-party embed.

## Updating

- Review a replacement CV for content, private details and PDF annotations.
- Replace the public PDF, not the private source documents.
- Keep src/pages/cvContent.js, src/content/profile.js and both translation catalogs
  aligned with the approved CV, preserving dates and experience qualifiers.
- Update the expected SHA-256 in cvContent.test.js and e2e/support/cv-scenarios.js.
- Run frontend unit tests, lint, build and the CV browser scenario. Review both
  languages on mobile and check that the PDF still downloads without eager loading.

Adding these files does not commit, push or deploy them.
