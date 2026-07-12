import type { GetServerSideProps } from 'next';
import blogConfig from '../blog.config';
import { getSiteConfig } from '../lib/notion';

// Static-ish robots.txt: lets crawlers in and points them at the dynamic
// sitemap. The base URL follows the configured site link (same source as the
// sitemap), so it stays correct when the domain changes.
export default function Robots() {
  return null;
}

export const getServerSideProps: GetServerSideProps = async ({ res }) => {
  const site = await getSiteConfig();
  const base = (site.link || blogConfig.link || '').replace(/\/$/, '');
  const body = `User-agent: *
Allow: /
Disallow: /api/

Sitemap: ${base}/sitemap.xml
`;
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate');
  res.write(body);
  res.end();
  return { props: {} };
};
