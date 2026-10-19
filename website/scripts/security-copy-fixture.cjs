// Offline review fixture: compile the real pages with synthetic session/locale inputs.
// This module is never imported by the application and creates no routes or users.
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const root = path.resolve(__dirname, '..');
const messages = require('../src/localization/messages.json');

function renderState(options = {}) {
  const { locale, user, tier, status, authLoading, admin } = { locale: 'en', user: { id: 'synthetic-review-user' }, tier: 'hospital', status: 'authenticated', authLoading: false, admin: false, ...options };
  const redirects = [];
  const text = value => locale === 'en' ? value : messages[value]?.[locale] ?? value;
  const mocks = {
    react: { ...React, useEffect: callback => callback() },
    '@/localization/LanguageProvider': { LocalizedText: ({ text: value }) => text(value) },
    '@/contexts/AuthContext': { useAuth: () => ({ user, loading: authLoading }) },
    'next-auth/react': { useSession: () => ({ data: user ? { user: { subscriptionTier: tier } } : null, status }) },
    'next/navigation': { useRouter: () => ({ replace: target => redirects.push(target) }) },
  };
  const file = admin ? 'src/app/admin/dashboard/policy/page.tsx' : 'src/app/(site)/compliance/page.tsx';
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', code)(name => mocks[name] ?? require(name), mod, mod.exports);
  return { html: renderToStaticMarkup(React.createElement(mod.exports.default)), redirects };
}
module.exports = { renderState, messages, root };
