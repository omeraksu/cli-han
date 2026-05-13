import { useEffect, useState } from 'react';
import { Agentation } from 'agentation';

const RAIL_KEY = 'deck-stage.railVisible';
const DEFAULT_APPLIED_KEY = 'han-pitch.rail-default-applied.v1';

let bootstrapped = false;

function bootstrapDeck() {
  if (bootstrapped) return;
  bootstrapped = true;

  try {
    if (localStorage.getItem(DEFAULT_APPLIED_KEY) !== '1') {
      localStorage.setItem(RAIL_KEY, '0');
      localStorage.setItem(DEFAULT_APPLIED_KEY, '1');
    }
  } catch (_e) {}

  fetch('/deck.html')
    .then((r) => r.text())
    .then((html) => {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      doc.querySelectorAll('link[rel="stylesheet"]').forEach((link) => {
        const href = link.getAttribute('href');
        if (href && !document.querySelector(`link[href="${href}"]`)) {
          const newLink = document.createElement('link');
          newLink.rel = 'stylesheet';
          newLink.href = href;
          document.head.appendChild(newLink);
        }
      });

      const mount = document.createElement('div');
      mount.id = 'deck-mount';
      mount.innerHTML = doc.body.innerHTML;

      const root = document.getElementById('root');
      document.body.insertBefore(mount, root);

      mount.querySelectorAll('script').forEach((oldScript) => {
        const newScript = document.createElement('script');
        if (oldScript.src) {
          newScript.src = oldScript.src;
        } else {
          newScript.textContent = oldScript.textContent;
        }
        if (oldScript.type) newScript.type = oldScript.type;
        document.body.appendChild(newScript);
        oldScript.remove();
      });
    });
}

function readRailVisible(): boolean {
  try {
    return localStorage.getItem(RAIL_KEY) === '1';
  } catch (_e) {
    return false;
  }
}

export default function App() {
  const [railVisible, setRailVisible] = useState<boolean>(false);

  useEffect(() => {
    bootstrapDeck();
    setRailVisible(readRailVisible());
  }, []);

  const toggleRail = () => {
    const next = !railVisible;
    setRailVisible(next);
    window.postMessage({ type: '__deck_rail_visible', on: next }, '*');
  };

  return (
    <>
      <button
        onClick={toggleRail}
        aria-label={railVisible ? 'hide slide rail' : 'show slide rail'}
        style={{
          position: 'fixed',
          bottom: 16,
          left: 16,
          zIndex: 9000,
          background: 'rgba(18, 18, 18, 0.85)',
          color: '#f5f1e8',
          border: '1px solid #2a2a2a',
          padding: '6px 12px',
          fontFamily:
            'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
          fontSize: 12,
          letterSpacing: '0.04em',
          cursor: 'pointer',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
          userSelect: 'none',
        }}
      >
        {railVisible ? '◂ hide rail' : '▸ rail'}
      </button>
      {import.meta.env.DEV && <Agentation />}
    </>
  );
}
