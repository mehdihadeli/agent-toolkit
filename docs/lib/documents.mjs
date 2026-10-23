import {existsSync, readFileSync} from 'node:fs';
import {posix, resolve} from 'node:path';

const root = existsSync(resolve(process.cwd(), 'agent-toolkit.slnx')) ? process.cwd() : resolve(process.cwd(), '..');
export const repositoryUrl = 'https://github.com/mehdihadeli/agent-toolkit';

export const navigation = [
  {title: 'Get Started', pages: [
    {slug: '', title: 'Introduction', source: 'README.md'},
    {slug: 'usage', title: 'Installation & Usage', source: 'docs/usage.md'},
    {slug: 'plugins', title: 'Plugin Catalog', source: 'docs/plugins.md'},
    {slug: 'harnesses', title: 'Hosts & Integrations', source: 'docs/harnesses.md'},
  ]},
  {title: 'Plugins', pages: [
    {slug: 'plugins/search', title: 'Search', source: 'plugins/search/README.md'},
    {slug: 'plugins/dotnet-quality', title: 'Dotnet Quality', source: 'plugins/dotnet-quality/README.md'},
    {slug: 'plugins/docs-research', title: 'Docs Research', source: 'plugins/docs-research/README.md'},
    {slug: 'plugins/skill-guide', title: 'Skill Guide', source: 'plugins/skill-guide/README.md'},
    {slug: 'plugins/planning', title: 'Planning', source: 'plugins/planning/README.md'},
  ]},
  {title: 'Build & Extend', pages: [
    {slug: 'architecture', title: 'Architecture', source: 'docs/architecture.md'},
    {slug: 'authoring', title: 'Authoring Plugins', source: 'docs/authoring.md'},
    {slug: 'agent-skills', title: 'Skills', source: 'docs/agent-skills.md'},
    {slug: 'agents', title: 'Agents', source: 'docs/agents.md'},
    {slug: 'packaging', title: 'Packaging', source: 'docs/packaging.md'},
    {slug: 'versioning', title: 'Versioning & Releases', source: 'docs/versioning.md'},
  ]},
  {title: 'Validation', pages: [
    {slug: 'plugin-eval', title: 'Evaluations', source: 'docs/plugin-eval.md'},
    {slug: 'round-trip-results', title: 'Discovery & Round Trips', source: 'docs/round-trip-results.md'},
    {slug: 'ci', title: 'Continuous Integration', source: 'docs/ci.md'},
    {slug: 'contributing', title: 'Contributing', source: 'CONTRIBUTING.md'},
    {slug: 'website', title: 'Documentation Website', source: 'docs/website.md'},
  ]},
];

export const pages = navigation.flatMap(group => group.pages.map(page => ({...page, group: group.title, href: page.slug ? `/${page.slug}/` : '/'})));

export function getDocument(slug = '') {
  const page = pages.find(page => page.slug === slug);
  return page ? {...page, content: readFileSync(resolve(root, page.source), 'utf8')} : undefined;
}

export function resolveLink(source, href = '') {
  if (!href || /^(?:[a-z][a-z\d+.-]*:|\/\/|#|\/)/i.test(href)) return href;
  const [, relative, suffix] = href.match(/^([^?#]*)(.*)$/);
  if (!relative) return href;
  const target = posix.normalize(posix.join(posix.dirname(source), relative));
  const page = pages.find(page => page.source === target);
  if (page) return `${page.href}${suffix}`;
  return `${repositoryUrl}/blob/main/${target.split('/').map(encodeURIComponent).join('/')}${suffix}`;
}

export function getSearchIndex() {
  return pages.map(page => ({title: page.title, href: page.href, group: page.group, text: getDocument(page.slug).content}));
}