import assert from 'assert';
import React, { useState, useEffect, useMemo } from 'react';
import { act } from 'react-dom/test-utils';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>');
globalThis.window = dom.window;
globalThis.document = dom.window.document;
Object.defineProperty(globalThis, 'navigator', {
  value: { userAgent: 'node.js' },
  configurable: true,
});

const calls = [];
globalThis.naver = {
  maps: {
    Event: {
      trigger: (...args) => {
        calls.push(args);
      },
    },
  },
};

function TestComponent() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const mapInstance = useMemo(() => ({}), []);

  useEffect(() => {
    if (!mapInstance) return;
    const timer = setTimeout(() => {
      naver.maps.Event.trigger(mapInstance, 'resize');
    }, 300);
    return () => clearTimeout(timer);
  }, [isSidebarOpen, mapInstance]);

  return (
    <button className="toggle" onClick={() => setIsSidebarOpen(prev => !prev)}>
      toggle
    </button>
  );
}

const container = document.createElement('div');
document.body.appendChild(container);
const root = createRoot(container);

act(() => {
  root.render(<TestComponent />);
});

const btn = container.querySelector('button.toggle');
act(() => {
  btn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
});

await new Promise(resolve => setTimeout(resolve, 350));

assert.strictEqual(calls.length, 1);
assert.strictEqual(calls[0][1], 'resize');

console.log('Map resize test passed');
