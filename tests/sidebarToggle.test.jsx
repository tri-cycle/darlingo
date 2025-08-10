import assert from 'assert';
import React, { useState } from 'react';
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

function SidebarLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  return (
    <div className="flex">
      <aside className={isSidebarOpen ? 'w-1/3' : 'w-0'}>
        <button className="toggle" onClick={() => setIsSidebarOpen(prev => !prev)}>
          toggle
        </button>
      </aside>
    </div>
  );
}

const container = document.createElement('div');
document.body.appendChild(container);
const root = createRoot(container);

act(() => {
  root.render(<SidebarLayout />);
});

let aside = container.querySelector('aside');
assert(aside.className.includes('w-1/3'));

const toggleBtn = container.querySelector('button.toggle');
act(() => {
  toggleBtn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
});

aside = container.querySelector('aside');
assert(aside.className.includes('w-0'));

console.log('Sidebar toggle test passed');
