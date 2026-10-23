import Link from 'next/link';
import {notFound} from 'next/navigation';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSlug from 'rehype-slug';
import {ArrowLeft, ArrowRight, ExternalLink, Blocks, Bot, Plug, BookOpen} from 'lucide-react';
import {CodeBlock} from '../../components/code-block';
import {getDocument, pages, repositoryUrl, resolveLink} from '../../lib/documents.mjs';

export const dynamicParams = false;

export function generateStaticParams() {
  return pages.map(page => ({slug: page.slug ? page.slug.split('/') : []}));
}

export async function generateMetadata({params}) {
  const {slug = []} = await params;
  const document = getDocument(slug.join('/'));
  return {title: document?.title ?? 'Not Found'};
}

function MarkdownContent({document, children}) {
  return <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSlug]} components={{
    a: ({href, children}) => {
      const resolved = resolveLink(document.source, href);
      return resolved.startsWith('/') && !resolved.startsWith('//')
        ? <Link href={resolved}>{children}</Link>
        : <a href={resolved}>{children}</a>;
    },
    pre: ({children}) => <CodeBlock>{children}</CodeBlock>,
    table: ({children}) => <div className="table-scroll" role="region" aria-label="Documentation table" tabIndex={0}><table>{children}</table></div>,
  }}>{children}</Markdown>;
}

function Overview() {
  return <div className="toolkit-map" aria-label="Plugin architecture: one canonical plugin tree exposes MCPs, agents, and skills to coding hosts">
    <div className="map-source"><Blocks size={23} aria-hidden="true" /><div><strong>plugins/</strong><span>One source of truth</span></div></div>
    <div className="map-surfaces">
      {[{icon: Plug, title: 'MCP servers', detail: 'Portable tools'}, {icon: Bot, title: 'Agents', detail: 'Typed orchestration'}, {icon: BookOpen, title: 'Skills', detail: 'Reusable guidance'}].map(({icon: Icon, title, detail}) => <div key={title}><Icon size={18} aria-hidden="true" /><strong>{title}</strong><span>{detail}</span></div>)}
    </div>
    <div className="map-hosts"><span>Claude Code</span><span>OpenAI Codex</span><span>GitHub Copilot</span></div>
  </div>;
}

export default async function Page({params}) {
  const {slug = []} = await params;
  const document = getDocument(slug.join('/'));
  if (!document) notFound();
  const index = pages.findIndex(page => page.slug === document.slug);
  const previous = pages[index - 1];
  const next = pages[index + 1];
  const introductionEnd = document.slug === '' ? document.content.indexOf('## Quick Start') : -1;

  return <>
    <div className="page-eyebrow"><span>{document.group}</span><span>/</span>{document.title}</div>
    <article className="prose">
      {introductionEnd >= 0 ? <>
        <MarkdownContent document={document}>{document.content.slice(0, introductionEnd)}</MarkdownContent>
        <Overview />
        <MarkdownContent document={document}>{document.content.slice(introductionEnd)}</MarkdownContent>
      </> : <MarkdownContent document={document}>{document.content}</MarkdownContent>}
    </article>
    <a className="source-link" href={`${repositoryUrl}/blob/main/${document.source}`}><ExternalLink size={14} aria-hidden="true" />View source on GitHub</a>
    <nav className="page-pagination" aria-label="Page navigation">
      {previous ? <Link href={previous.href}><ArrowLeft size={17} aria-hidden="true" /><span><small>Previous</small>{previous.title}</span></Link> : <span />}
      {next && <Link href={next.href}><span><small>Next</small>{next.title}</span><ArrowRight size={17} aria-hidden="true" /></Link>}
    </nav>
    <footer className="page-footer"><span>Agent Toolkit</span><span>Open source. Plugin first.</span></footer>
  </>;
}