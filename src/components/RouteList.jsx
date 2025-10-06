import React from 'react';

export default function RouteList({ routes, selectedIndex, setSelectedRouteIndex }) {
  if (!routes || routes.length === 0) return null;

  const getRouteTypeIcon = (route) => {
    const subPaths = route?.summary?.subPath || [];
    const hasBike = subPaths.some(path => path?.trafficType === 4);
    const hasTransit = subPaths.some(path => path?.trafficType === 1 || path?.trafficType === 2);

    if (hasBike && hasTransit) {
      return (
        <div className="flex items-center space-x-1">
          <span className="text-base">🚲</span>
          <span className="text-base">🚇</span>
        </div>
      );
    } else if (hasBike) {
      return <span className="text-lg">🚲</span>;
    } else {
      return <span className="text-lg">🚇</span>;
    }
  };

  const getRouteTypeLabel = (route) => {
    const subPaths = route?.summary?.subPath || [];
    const hasBike = subPaths.some(path => path?.trafficType === 4);
    const hasTransit = subPaths.some(path => path?.trafficType === 1 || path?.trafficType === 2);

    if (hasBike && hasTransit) return "복합 경로";
    else if (hasBike) return "자전거 전용";
    else return "대중교통";
  };

  const getBadgeColor = (route) => {
    const subPaths = route?.summary?.subPath || [];
    const hasBike = subPaths.some(path => path?.trafficType === 4);
    const hasTransit = subPaths.some(path => path?.trafficType === 1 || path?.trafficType === 2);

    if (hasBike && hasTransit) {
      return "bg-gradient-to-r from-emerald-500 to-green-500 text-white";
    } else if (hasBike) {
      return "bg-emerald-500 text-white";
    } else {
      return "bg-green-600 text-white";
    }
  };

  return (
    <div className="space-y-3">
      {/* 헤더 */}
      <div className="flex items-center space-x-2">
        <div className="w-5 h-5 bg-emerald-100 rounded-lg flex items-center justify-center">
          <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
        </div>
        <h3 className="text-base font-bold text-gray-900">경로 선택</h3>
        <div className="flex-1 h-px bg-gradient-to-r from-gray-300 to-transparent"></div>
      </div>

      {/* 경로 목록 */}
      <div className="space-y-2.5">
        {routes.map((route, idx) => (
          <button
            key={idx}
            onClick={() => setSelectedRouteIndex(idx)}
            className={`w-full text-left p-4 rounded-xl transition-all duration-300 border-2 group ${
              selectedIndex === idx
                ? 'bg-gradient-to-r from-emerald-50 to-green-50 border-emerald-300 shadow-md scale-[1.01]'
                : 'bg-white/80 backdrop-blur-sm border-gray-200 hover:border-emerald-200 hover:bg-emerald-50/50 shadow-sm hover:shadow'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                {/* 아이콘 박스 */}
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    selectedIndex === idx ? 'bg-white shadow' : 'bg-gray-50 group-hover:bg-white'
                  } transition-all duration-300`}
                >
                  {getRouteTypeIcon(route)}
                </div>

                {/* 라벨 */}
                <div>
                  <div className="flex items-center space-x-2.5">
                    <span className="text-base font-bold text-gray-900">경로 {idx + 1}</span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium ${getBadgeColor(route)}`}
                    >
                      {getRouteTypeLabel(route)}
                    </span>
                  </div>
                  <div className="flex items-center space-x-3 mt-1.5">
                    <div className="flex items-center space-x-1">
                      <svg className="w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-xs text-gray-600 font-medium">
                        {route.summary?.info?.totalTime ?? '?'}분
                      </span>
                    </div>
                    {route.summary?.subPath?.some(path => path?.trafficType === 4) && (
                      <div className="flex items-center space-x-1">
                        <span className="text-xs">🚲</span>
                        <span className="text-xs text-emerald-600 font-medium">
                          {route.summary.subPath
                            .filter(path => path?.trafficType === 4)
                            .reduce((sum, path) => sum + (path.sectionTime || 0), 0)}분
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 화살표 */}
              <div
                className={`transition-transform duration-300 ${
                  selectedIndex === idx
                    ? 'text-emerald-600 scale-110'
                    : 'text-gray-400 group-hover:text-emerald-500'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
