// Client-side Mermaid renderer.
//
// A Notion code block that's flagged as Mermaid (see lib/mermaid.ts) reaches the
// browser as raw text — highlight.js never touches it (the server enricher skips
// it), so there's no __codeHtml. This component lazy-loads the mermaid library
// on the client and renders the source into an inline SVG, then re-renders when
// the site theme flips so light/dark palettes track [data-theme] on <html>.
//
// Runs only in the browser: mermaid needs DOM + layout, so SSR renders a blank
// placeholder and the effect fills it in after hydration.

import { useEffect, useState } from 'react';

type MermaidApi = typeof import('mermaid')['default'];

// One shared, lazily-created module instance. initialize() is idempotent, so we
// call it again on each render with the current theme — cheap, and guarantees
// the in-flight diagram uses the live palette.
let mermaidPromise: Promise<MermaidApi> | null = null;

async function getMermaid(): Promise<MermaidApi> {
  if (!mermaidPromise) {
    mermaidPromise = import('mermaid').then((m) => m.default);
  }
  return mermaidPromise;
}

let counter = 0;

export function Mermaid({ code }: { code: string }) {
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // runId gates stale async work: only the most recent run is allowed to
    // commit state. This matters when the theme flips while a render is in
    // flight — the older render is ignored rather than overwriting the new one.
    let runId = 0;
    let disposed = false;
    let lastTheme: string | undefined;

    const run = async () => {
      const myRun = ++runId;
      try {
        const mermaid = await getMermaid();
        if (disposed || myRun !== runId) return;
        const dark = document.documentElement.dataset.theme === 'dark';
        lastTheme = dark ? 'dark' : 'default';
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'loose',
          theme: dark ? 'dark' : 'default',
        });
        // Stable, unique id so mermaid's temp DOM node never collides.
        const id = `mermaid-${++counter}`;
        const { svg } = await mermaid.render(id, code.trim());
        if (disposed || myRun !== runId) return;
        setError(null);
        setSvg(svg);
      } catch (e) {
        if (disposed || myRun !== runId) return;
        setError(e instanceof Error ? e.message : String(e));
      }
    };

    run();

    // Re-render when the site theme flips between light and dark.
    const obs = new MutationObserver(() => {
      const next = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'default';
      if (next !== lastTheme) run();
    });
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });

    return () => {
      disposed = true;
      obs.disconnect();
    };
  }, [code]);

  if (error) {
    return (
      <>
        <pre className="mermaid-error">{error}</pre>
        <pre className="mermaid-source">{code}</pre>
      </>
    );
  }
  return (
    <div
      className="mermaid"
      dangerouslySetInnerHTML={svg ? { __html: svg } : undefined}
    />
  );
}
