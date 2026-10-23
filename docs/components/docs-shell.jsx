'use client';

import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {useDeferredValue, useEffect, useRef, useState} from 'react';
import {ArrowRight, BookOpen, ChevronRight, Github, List, Menu, Search, Terminal, X} from 'lucide-react';

export function DocsShell({children, navigation, searchIndex, repositoryUrl}) {
  const pathname = usePathname().replace(/\/$/, '') || '/';
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());
  const [menuOpen, setMenuOpen] = useState(false);
  const [headings, setHeadings] = useState([]);
  const [activeHeading, setActiveHeading] = useState('');
  const menuButton = useRef(null);
  const searchInput = useRef(null);
  const searchArea = useRef(null);
  const sidebar = useRef(null);
  const isPluginPage = pathname === '/plugins' || pathname.startsWith('/plugins/');
  const terms = deferredQuery.split(/\s+/).filter(Boolean);
  const matches = terms.length ? searchIndex.filter(page => terms.every(term => `${page.title} ${page.group} ${page.text}`.toLowerCase().includes(term))).sort((left, right) => Number(right.title.toLowerCase().includes(deferredQuery)) - Number(left.title.toLowerCase().includes(deferredQuery))) : [];
  const normalized = href => href.replace(/\/$/, '') || '/';

  function close() {
    setMenuOpen(false);
    setQuery('');
  }

  useEffect(() => {
    const elements = [...document.querySelectorAll('.prose h2[id], .prose h3[id]')];
    setHeadings(elements.map(element => ({id: element.id, title: element.textContent, nested: element.tagName === 'H3'})));
    setActiveHeading(elements[0]?.id ?? '');
    const observer = new IntersectionObserver(entries => {
      const visible = entries.find(entry => entry.isIntersecting);
      if (visible) setActiveHeading(visible.target.id);
    }, {rootMargin: '-100px 0px -65% 0px'});
    elements.forEach(element => observer.observe(element));
    return () => observer.disconnect();
  }, [pathname]);

  useEffect(() => {
    function keydown(event) {
      if (event.key === 'Escape') {
        setMenuOpen(false);
        setQuery('');
        if (menuOpen) menuButton.current?.focus();
      }
      if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
        event.preventDefault();
        searchInput.current?.focus();
      }
      if (event.key === 'Tab' && menuOpen) {
        const links = [...sidebar.current.querySelectorAll('a')];
        const first = links[0];
        const last = links.at(-1);
        if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); menuButton.current?.focus(); }
        if (event.shiftKey && document.activeElement === menuButton.current) { event.preventDefault(); last?.focus(); }
        if (!event.shiftKey && document.activeElement === menuButton.current) { event.preventDefault(); first?.focus(); }
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); menuButton.current?.focus(); }
      }
    }
    function pointerdown(event) {
      if (!searchArea.current?.contains(event.target)) setQuery('');
    }
    document.addEventListener('keydown', keydown);
    document.addEventListener('pointerdown', pointerdown);
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => {
      document.removeEventListener('keydown', keydown);
      document.removeEventListener('pointerdown', pointerdown);
      document.body.style.overflow = '';
    };
  }, [menuOpen]);

  return <>
    <a className="skip-link" href="#content">Skip to content</a>
    <header className="site-header">
      <div className="header-main">
        <Link href="/" className="wordmark" onClick={close}><span className="brand-icon"><Terminal size={21} aria-hidden="true" /></span><span>agent<span className="wordmark-light">toolkit</span></span></Link>
        <span className="header-divider" /><span className="header-label">Documentation</span>
        <div className="header-search" ref={searchArea} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setQuery(''); }}>
          <label className="search-field"><Search size={16} aria-hidden="true" /><input ref={searchInput} value={query} onChange={event => setQuery(event.target.value)} placeholder="Search documentation..." aria-label="Search documentation" aria-controls={query.trim() ? 'search-results' : undefined} type="search" /></label>
          {query.trim() && <nav id="search-results" className="search-results" aria-label="Search results"><div className="search-caption" role="status">{matches.length} {matches.length === 1 ? 'result' : 'results'}</div>{matches.map(page => <Link key={page.href} href={page.href} onClick={close}><BookOpen size={16} aria-hidden="true" /><span><strong>{page.title}</strong><small>{page.group}</small></span><ArrowRight size={15} aria-hidden="true" /></Link>)}{!matches.length && <p>No pages found.</p>}</nav>}
        </div>
        <a className="github-link" href={repositoryUrl} aria-label="Agent Toolkit on GitHub" title="View repository on GitHub"><Github size={21} aria-hidden="true" /></a>
        <button ref={menuButton} className="menu-button" type="button" onClick={() => setMenuOpen(value => !value)} aria-expanded={menuOpen} aria-controls="docs-navigation" aria-label={menuOpen ? 'Close navigation' : 'Open navigation'} title={menuOpen ? 'Close navigation' : 'Open navigation'}>{menuOpen ? <X size={21} /> : <Menu size={21} />}</button>
      </div>
      <nav className="header-tabs" aria-label="Top navigation"><Link href="/" onClick={close} aria-current={!isPluginPage ? 'true' : undefined}><BookOpen size={15} aria-hidden="true" />Documentation</Link><Link href="/plugins/" onClick={close} aria-current={isPluginPage ? 'true' : undefined}>Plugins <ChevronRight size={14} aria-hidden="true" /></Link><a href={`${repositoryUrl}/discussions`}>Community</a></nav>
    </header>
    <div className="docs-layout">
      {menuOpen && <button className="navigation-backdrop" type="button" onClick={() => { setMenuOpen(false); menuButton.current?.focus(); }} aria-label="Close navigation" tabIndex={-1} />}
      <aside ref={sidebar} id="docs-navigation" className={`sidebar${menuOpen ? ' is-open' : ''}`} aria-label="Documentation navigation">
        <div className="navigation-groups">{navigation.map(group => <section key={group.title}><h2>{group.title}</h2><nav aria-label={group.title}>{group.pages.map(page => <Link key={page.slug} href={page.slug ? `/${page.slug}/` : '/'} onClick={close} aria-current={pathname === normalized(`/${page.slug}`) ? 'page' : undefined}>{page.title}</Link>)}</nav></section>)}</div>
        <a className="sidebar-source" href={repositoryUrl}><Github size={15} aria-hidden="true" />Open source on GitHub<ArrowRight size={14} aria-hidden="true" /></a>
      </aside>
      <main id="content" tabIndex={-1} className="docs-main">{children}</main>
      <aside className="page-outline" aria-label="On this page">{headings.length > 0 && <><h2><List size={14} aria-hidden="true" />On this page</h2><nav>{headings.map(heading => <a key={heading.id} className={heading.nested ? 'is-nested' : undefined} href={`#${heading.id}`} aria-current={activeHeading === heading.id ? 'location' : undefined}>{heading.title}</a>)}</nav></>}<div className="outline-note"><Terminal size={18} aria-hidden="true" /><strong>Built for coding agents.</strong><span>Shared plugins. Native hosts.</span></div></aside>
    </div>
  </>;
}