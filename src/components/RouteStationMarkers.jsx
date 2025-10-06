// src/components/RouteStationMarkers.jsx
import { useEffect } from "react";
import useMarkers from "../hooks/useMarkers";
import haversine from "../utils/haversine";

const STATION_SEARCH_RADIUS = 300;

export default function RouteStationMarkers({ map, selectedRoute, allStations }) {
    const setMarkers = useMarkers(map);

    useEffect(() => {
        if (!map || !selectedRoute?.summary?.subPath || !allStations) {
            setMarkers([]);
            return;
        }

        // 자전거 구간 찾기
        const bikeSegments = selectedRoute.summary.subPath.filter(path => path.trafficType === 4);
        if (bikeSegments.length === 0) {
            setMarkers([]);
            return;
        }

        // 출발역과 도착역 찾기
        const startStationName = bikeSegments[0].startName;
        const endStationName = bikeSegments[bikeSegments.length - 1].endName;

        const startStation = allStations.find(s => s.stationName.includes(startStationName));
        const endStation = allStations.find(s => s.stationName.includes(endStationName));

        // 검색할 지점들 설정
        const searchPoints = [];
        if (startStation) searchPoints.push({ station: startStation, type: 'start' });
        if (endStation && startStation?.stationId !== endStation?.stationId) {
            searchPoints.push({ station: endStation, type: 'end' });
        }

        const markers = [];
        const addedStationIds = new Set();
        let currentInfoWindow = null;

        // 각 검색 지점 주변의 대여소들 처리
        searchPoints.forEach(({ station, type }) => {
            const centerLat = parseFloat(station.stationLatitude);
            const centerLng = parseFloat(station.stationLongitude);

            allStations.forEach(s => {
                if (addedStationIds.has(s.stationId)) return;

                const lat = parseFloat(s.stationLatitude);
                const lng = parseFloat(s.stationLongitude);
                if (isNaN(lat) || isNaN(lng)) return;

                const distance = haversine(centerLat, centerLng, lat, lng);
                if (distance > STATION_SEARCH_RADIUS) return;

                const bikeCount = Number(s.parkingBikeTotCnt) || 0;
                const isMainStation = s.stationId === station.stationId;
                
                // 스타일 설정
                const style = getStationStyle(type, isMainStation);
                const markerIcon = createStationMarkerIcon(style, bikeCount);
                
                // 마커 생성
                const marker = new window.naver.maps.Marker({
                    position: new window.naver.maps.LatLng(lat, lng),
                    title: `${s.stationName} (${bikeCount}대)`,
                    icon: {
                        content: markerIcon,
                        anchor: new window.naver.maps.Point(style.size / 2, style.size / 2),
                    },
                    zIndex: isMainStation ? 150 : 101
                });

                // 인포윈도우 생성
                const infoWindow = new window.naver.maps.InfoWindow({
                    content: createInfoWindowContent(s, style, bikeCount, type),
                    borderWidth: 0,
                    backgroundColor: 'transparent',
                });

                // 클릭 이벤트
                window.naver.maps.Event.addListener(marker, 'click', () => {
                    if (currentInfoWindow) {
                        currentInfoWindow.close();
                    }
                    infoWindow.open(map, marker);
                    currentInfoWindow = infoWindow;
                });

                markers.push(marker);
                addedStationIds.add(s.stationId);
            });
        });

        // 지도 클릭 시 인포윈도우 닫기
        const mapClickListener = window.naver.maps.Event.addListener(map, 'click', () => {
            if (currentInfoWindow) {
                currentInfoWindow.close();
                currentInfoWindow = null;
            }
        });

        setMarkers(markers);

        // 클린업
        return () => {
            window.naver.maps.Event.removeListener(mapClickListener);
        };

    }, [map, selectedRoute, allStations, setMarkers]);

    return null;
}

// 스타일 설정 함수
function getStationStyle(type, isMainStation) {
    const baseStyle = {
        size: isMainStation ? 44 : 32,
        fontSize: isMainStation ? '20px' : '16px',
        badgeSize: isMainStation ? '20px' : '16px',
        badgeFontSize: isMainStation ? '10px' : '8px',
        border: isMainStation ? '4px' : '3px',
        zIndex: isMainStation ? 150 : 101
    };

    if (type === 'start') {
        return {
            ...baseStyle,
            bgColor: '#10b981', // emerald-500
            borderColor: '#059669', // emerald-600
            label: isMainStation ? '출발역' : '근처',
            emoji: isMainStation ? '🚀' : '🚲',
            role: '따릉이 대여'
        };
    } else {
        return {
            ...baseStyle,
            bgColor: '#f59e0b', // amber-500
            borderColor: '#d97706', // amber-600
            label: isMainStation ? '도착역' : '근처',
            emoji: isMainStation ? '🎯' : '🚲',
            role: '따릉이 반납'
        };
    }
}

// 마커 아이콘 생성 함수
function createStationMarkerIcon(style, bikeCount) {
    return `
        <div style="
            position: relative;
            width: ${style.size}px; 
            height: ${style.size}px; 
            background: linear-gradient(135deg, ${style.bgColor} 0%, ${style.borderColor} 100%);
            border-radius: 50%; 
            display: flex; 
            align-items: center; 
            justify-content: center; 
            color: white; 
            font-size: ${style.fontSize}; 
            font-weight: bold; 
            border: ${style.border} solid white; 
            box-shadow: 0 6px 16px rgba(0,0,0,0.2), 0 2px 4px rgba(0,0,0,0.1);
            cursor: pointer;
            transition: all 0.3s ease;
        "
        onmouseover="this.style.transform='scale(1.15)'; this.style.zIndex='200'"
        onmouseout="this.style.transform='scale(1)'; this.style.zIndex='${style.zIndex}'"
        >
            ${style.emoji}
            
            <!-- 자전거 수량 뱃지 -->
            <div style="
                position: absolute;
                top: -6px;
                right: -6px;
                background: ${style.borderColor};
                color: white;
                border-radius: 50%;
                width: ${style.badgeSize};
                height: ${style.badgeSize};
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: ${style.badgeFontSize};
                font-weight: bold;
                border: 2px solid white;
                box-shadow: 0 2px 6px rgba(0,0,0,0.2);
            ">
                ${bikeCount}
            </div>
            
            <!-- 메인 역 라벨 -->
            ${style.label && style.size > 32 ? `
                <div style="
                    position: absolute;
                    bottom: -24px;
                    left: 50%;
                    transform: translateX(-50%);
                    background: linear-gradient(135deg, ${style.bgColor}, ${style.borderColor});
                    color: white;
                    padding: 4px 8px;
                    border-radius: 8px;
                    font-size: 10px;
                    font-weight: bold;
                    white-space: nowrap;
                    border: 2px solid white;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
                ">
                    ${style.label}
                </div>
            ` : ''}
        </div>
    `;
}

// 인포윈도우 콘텐츠 생성 함수
function createInfoWindowContent(station, style, bikeCount, type) {
    return `
        <div style="
            padding: 16px;
            background: linear-gradient(135deg, ${style.bgColor}, ${style.borderColor});
            color: white;
            border-radius: 16px;
            box-shadow: 0 8px 24px rgba(0,0,0,0.2);
            border: none;
            min-width: 220px;
            max-width: 280px;
        ">
            <!-- 헤더 -->
            <div style="
                display: flex;
                align-items: center;
                gap: 8px;
                margin-bottom: 12px;
            ">
                <span style="font-size: 18px;">${style.emoji}</span>
                <div>
                    <div style="font-weight: bold; font-size: 14px;">
                        ${style.label} 대여소
                    </div>
                    <div style="font-size: 11px; opacity: 0.8;">
                        ${style.role}
                    </div>
                </div>
            </div>
            
            <!-- 대여소 이름 -->
            <div style="
                background: rgba(255,255,255,0.2);
                padding: 8px 12px;
                border-radius: 12px;
                margin-bottom: 12px;
            ">
                <div style="
                    font-size: 13px; 
                    font-weight: bold; 
                    line-height: 1.3;
                ">
                    ${station.stationName}
                </div>
            </div>
            
            <!-- 자전거 현황 -->
            <div style="
                display: flex;
                gap: 8px;
            ">
                <div style="
                    background: rgba(255,255,255,0.3);
                    padding: 8px 12px;
                    border-radius: 8px;
                    font-size: 12px;
                    font-weight: bold;
                    flex: 1;
                    text-align: center;
                ">
                    <div style="margin-bottom: 2px; font-size: 10px; opacity: 0.8;">
                        이용가능
                    </div>
                    <div style="font-size: 16px;">
                        ${bikeCount}대
                    </div>
                </div>
                <div style="
                    background: rgba(0,0,0,0.2);
                    padding: 8px 12px;
                    border-radius: 8px;
                    font-size: 12px;
                    flex: 1;
                    text-align: center;
                ">
                    <div style="margin-bottom: 2px; font-size: 10px; opacity: 0.8;">
                        전체
                    </div>
                    <div style="font-size: 16px;">
                        ${station.rackTotCnt || 0}대
                    </div>
                </div>
            </div>
        </div>
    `;
}