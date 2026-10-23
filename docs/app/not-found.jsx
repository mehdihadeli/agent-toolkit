import Link from 'next/link';

export default function NotFound() {
  return <div className="prose"><p className="page-eyebrow">404</p><h1>Page Not Found</h1><p>This documentation page does not exist.</p><p><Link href="/">Return to documentation</Link></p></div>;
}