import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const root = new URL('../', import.meta.url);
const pages = [
  ['index.html', 'Max Encrypted Backup', 'https://backup.studio772.com/'],
  ['privacy/index.html', 'Privacy Policy', 'https://backup.studio772.com/privacy/'],
  ['terms/index.html', 'Terms of Use', 'https://backup.studio772.com/terms/'],
  ['404.html', 'Page not found', null],
];

async function html(file) {
  return readFile(new URL(file, root), 'utf8');
}

test('publishes every required OAuth identity page', async () => {
  for (const [file, heading, canonical] of pages) {
    assert.equal(existsSync(new URL(file, root)), true, `${file} must exist`);
    const source = await html(file);
    assert.match(source, new RegExp(`<h1[^>]*>[^<]*${heading}[^<]*</h1>`, 'i'));
    if (canonical) assert.match(source, new RegExp(`<link rel="canonical" href="${canonical.replaceAll('.', '\\.')}">`));
  }
});

test('homepage truthfully describes the private backup utility and links policies', async () => {
  const source = await html('index.html');
  for (const phrase of ['private, owner-operated utility', 'encrypted backup data', 'Google Drive', 'no public registration']) {
    assert.match(source.toLowerCase(), new RegExp(phrase.toLowerCase().replaceAll('.', '\\.')));
  }
  assert.match(source, /href="\/privacy\/"/);
  assert.match(source, /href="\/terms\/"/);
});

test('privacy policy discloses access, storage, sharing, retention, security, and revocation', async () => {
  const source = (await html('privacy/index.html')).toLowerCase();
  for (const phrase of ['google drive', 'encrypted', 'oauth', 'does not sell', 'retention', 'revoke', 'chris@studio772.com']) {
    assert.match(source, new RegExp(phrase));
  }
});

test('site contains no collection or third-party runtime code', async () => {
  for (const [file] of pages) {
    const source = await html(file);
    assert.doesNotMatch(source, /<script\b/i);
    assert.doesNotMatch(source, /<form\b/i);
    assert.doesNotMatch(source, /https?:\/\/(?!backup\.studio772\.com|studio772\.com)/i);
  }
});

test('all root-relative page links resolve to published files', async () => {
  for (const [file] of pages) {
    const source = await html(file);
    for (const href of source.matchAll(/href="(\/[^"]*)"/g)) {
      const clean = href[1].split(/[?#]/)[0];
      if (clean === '/') assert.equal(existsSync(new URL('index.html', root)), true);
      else {
        const target = clean.endsWith('/') ? `${clean.slice(1)}index.html` : clean.slice(1);
        assert.equal(existsSync(new URL(target, root)), true, `${file} links to missing ${clean}`);
      }
    }
  }
});

test('deployment metadata includes security headers and custom domain', async () => {
  const headers = await readFile(new URL('_headers', root), 'utf8');
  assert.match(headers, /Content-Security-Policy:/);
  assert.match(headers, /X-Content-Type-Options: nosniff/);
  assert.match(headers, /Referrer-Policy: no-referrer/);
  assert.equal((await readFile(new URL('CNAME', root), 'utf8')).trim(), 'backup.studio772.com');
});
