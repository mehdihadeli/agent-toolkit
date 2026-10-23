import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/600.css';
import '@fontsource/ibm-plex-mono/400.css';
import {DocsShell} from '../components/docs-shell';
import {getSearchIndex, navigation, repositoryUrl} from '../lib/documents.mjs';
import './globals.css';

export const metadata = {
  title: {default: 'Agent Toolkit', template: '%s | Agent Toolkit'},
  description: 'Documentation for Agent Toolkit plugins, MCP servers, agents, reusable skills, and durable planning.',
};

export default function RootLayout({children}) {
  return <html lang="en" data-scroll-behavior="smooth"><body><DocsShell navigation={navigation} searchIndex={getSearchIndex()} repositoryUrl={repositoryUrl}>{children}</DocsShell></body></html>;
}