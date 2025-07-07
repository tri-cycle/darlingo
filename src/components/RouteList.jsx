import React from 'react';

export default function RouteList({ routes, selectedIndex, setSelectedRouteIndex }) {
  if (!routes || routes.length === 0) return null;

  return (
    <div className="mt-6">
      <h3 className="text-lg font-semibold mb-2">경로 선택</h3>
      <ul className="space-y-2">
        {routes.map((r, idx) => (
          <li key={idx}>
            <button
              onClick={() => setSelectedRouteIndex(idx)}
              className={`w-full text-left p-2 rounded ${selectedIndex === idx ? 'bg-blue-100' : 'hover:bg-gray-100'}`}
            >
              <span className="font-bold mr-2">{idx + 1}.</span>
              <span>{r.summary?.info?.totalTime ?? '?'}분 예상</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
