'use client';

import {useRef, useState} from 'react';
import {Check, Copy} from 'lucide-react';

export function CodeBlock({children}) {
  const code = useRef(null);
  const [status, setStatus] = useState('idle');
  const language = children?.props?.className?.replace('language-', '') ?? 'text';

  async function copy() {
    try {
      await navigator.clipboard.writeText(code.current.textContent);
      setStatus('copied');
    } catch {
      setStatus('failed');
    }
  }

  return <div className="code-block">
    <div className="code-toolbar"><span>{language}</span><button type="button" onClick={copy} aria-label={status === 'copied' ? 'Copy again' : 'Copy code'} title={status === 'copied' ? 'Copied' : 'Copy code'}>{status === 'copied' ? <Check size={15} /> : <Copy size={15} />}</button><span className="sr-only" role="status">{status === 'copied' ? 'Code copied.' : status === 'failed' ? 'Copy failed. Select the code to copy it manually.' : ''}</span></div>
    <pre ref={code}>{children}</pre>
  </div>;
}