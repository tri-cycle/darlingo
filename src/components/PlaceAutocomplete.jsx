import React, { useEffect, useRef, useState } from 'react';
import { loadGoogleMapsScript } from "../utils/loadGoogleMaps";

// 로컬 스토리지에 사용할 키와 저장할 최대 검색어 개수를 상수로 정의합니다.
const RECENT_SEARCHES_KEY = 'recentSearches';
const MAX_RECENT_SEARCHES = 10;

export default function PlaceAutocomplete({ placeholder, onPlaceSelected }) {
  // --- Ref 정의 ---
  const inputRef = useRef(null); // 우리가 직접 제어할 input DOM 요소를 가리킵니다.
  // Google의 최신 Place 클래스를 사용하기 위해, 로드되었는지 확인하는 용도
  const googlePlacesApi = useRef(null); 
  
  // --- State 정의 ---
  const [inputValue, setInputValue] = useState(''); // React가 직접 제어하는 input의 값
  const [predictions, setPredictions] = useState([]); // Google이 제안하는 장소 목록
  const [recentSearches, setRecentSearches] = useState([]); // 최근 검색어 목록
  const [isFocused, setIsFocused] = useState(false); // 입력창 포커스 여부

  // --- useEffect: 컴포넌트 초기화 ---
  useEffect(() => {
    // 1. 로컬 스토리지에서 최근 검색어 불러오기
    try {
      const storedSearches = localStorage.getItem(RECENT_SEARCHES_KEY);
      if (storedSearches) {
        setRecentSearches(JSON.parse(storedSearches));
      }
    } catch (error) {
      console.error('로컬 스토리지 파싱 실패:', error);
    }

    // 2. Google Maps API 스크립트 로드
    const initGoogleServices = async () => {
      try {
        const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
        await loadGoogleMapsScript(apiKey);
        if (window.google) {
          // 최신 Place API가 로드되었음을 저장
          googlePlacesApi.current = window.google.maps.places;
        }
      } catch (err) {
        console.error("Google Maps API 로딩 실패:", err);
      }
    };
    
    initGoogleServices();
  }, []); // 컴포넌트가 처음 마운트될 때 한 번만 실행됩니다.

  /**
   * ✨ 핵심 수정 1: 최근 검색어를 추가하는 함수
   * 컴포넌트의 자체 상태(prev) 대신, 항상 로컬 스토리지에서 최신 목록을 직접 읽어와서 작업합니다.
   * 이렇게 하면 다른 입력창에서 추가한 내역이 유실되지 않습니다.
   * @param {object} place - 추가할 장소 객체
   */
  const addRecentSearch = (place) => {
    // 1. 로컬 스토리지에서 현재 저장된 '공용 수첩'을 가져옵니다.
    const currentSearches = JSON.parse(localStorage.getItem(RECENT_SEARCHES_KEY) || '[]');
    
    // 2. 가져온 최신 목록을 기준으로 새로운 장소를 추가하고 중복을 제거합니다.
    const updatedSearches = [place, ...currentSearches.filter(p => p.name !== place.name)].slice(0, MAX_RECENT_SEARCHES);
    
    // 3. 업데이트된 목록을 로컬 스토리지와 현재 컴포넌트의 상태에 모두 반영합니다.
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updatedSearches));
    setRecentSearches(updatedSearches);
  };

  /**
   * ✨ 핵심 수정 2: 최근 검색어를 삭제하는 함수
   * 추가와 마찬가지로, 항상 로컬 스토리지에서 최신 목록을 먼저 읽어옵니다.
   * @param {string} placeName - 삭제할 장소의 이름
   */
  const removeRecentSearch = (placeName) => {
    const currentSearches = JSON.parse(localStorage.getItem(RECENT_SEARCHES_KEY) || '[]');
    const updatedSearches = currentSearches.filter(p => p.name !== placeName);
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updatedSearches));
    setRecentSearches(updatedSearches);
  };

  // --- 입력 및 선택 처리 핸들러 ---

  // 입력창의 값이 변경될 때마다 실행되는 함수
  const handleInputChange = async (e) => {
    const value = e.target.value;
    setInputValue(value);

    // 입력값이 없으면 추천 목록을 비우고 종료합니다.
    if (!value) {
      setPredictions([]);
      return;
    }

    // 최신 Autocomplete 웹 서비스를 직접 호출합니다.
    try {
      const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
      const response = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
        },
        body: JSON.stringify({
          input: value,
          languageCode: 'ko',
          includedRegionCodes: ['kr'],
          locationRestriction: {
            rectangle: {
              low: { latitude: 37.428270, longitude: 126.764582 },
              high: { latitude: 37.701749, longitude: 127.183155 },
            }
          }
        }),
      });

      if (!response.ok) {
        throw new Error('Autocomplete API 요청 실패');
      }

      const data = await response.json();
      setPredictions(data.suggestions || []);
    } catch (error) {
      console.error(error);
      setPredictions([]);
    }
  };
  
  // Google 추천 목록의 항목을 클릭했을 때 실행되는 함수
  const handlePredictionClick = async (prediction) => {
    const placePrediction = prediction.placePrediction;
    const placeId = placePrediction.placeId;
    const mainText = placePrediction.structuredFormat.mainText.text;

    if (googlePlacesApi.current && placeId) {
      try {
        const place = new googlePlacesApi.current.Place({ id: placeId });
        await place.fetchFields({ fields: ['formattedAddress', 'location'] });
        
        if (place) {
          const newPlace = {
            name: mainText,
            address: place.formattedAddress,
            lat: place.location.lat(),
            lng: place.location.lng(),
          };
          
          setInputValue(newPlace.name);
          onPlaceSelected?.(newPlace);
          addRecentSearch(newPlace);
          
          setPredictions([]);
          inputRef.current?.blur();
        }
      } catch (error) {
        console.error("장소 상세 정보 가져오기 실패:", error);
      }
    }
  };

  // 최근 검색어 목록의 항목을 클릭했을 때 실행되는 함수
  const handleRecentClick = (place) => {
    setInputValue(place.name);
    onPlaceSelected?.(place);
    addRecentSearch(place);
    inputRef.current?.blur();
  };

  /**
   * ✨ 핵심 수정 3: 입력창에 포커스가 들어올 때 실행되는 함수
   * 다른 입력창에서 목록을 변경했을 수 있으므로, 포커스 될 때마다
   * 로컬 스토리지에서 최신 목록을 다시 읽어와 화면을 동기화합니다.
   */
  const handleFocus = () => {
    const storedSearches = localStorage.getItem(RECENT_SEARCHES_KEY);
    if (storedSearches) {
      setRecentSearches(JSON.parse(storedSearches));
    }
    setIsFocused(true);
  };

  // 포커스가 나갔을 때, 클릭 이벤트를 위해 약간의 딜레이 후 목록을 숨깁니다.
  const handleBlur = () => {
    setTimeout(() => {
      setIsFocused(false);
    }, 200);
  };

  return (
    <div className="relative w-full">
      <input
        ref={inputRef}
        type="text"
        placeholder={placeholder || "장소를 입력하세요"}
        value={inputValue}
        onChange={handleInputChange}
        onFocus={handleFocus} // 수정된 포커스 핸들러 연결
        onBlur={handleBlur}
        className="w-full p-2 border rounded-md"
      />

      {/* 포커스가 있을 때만 목록을 보여줍니다. */}
      {isFocused && (
        <ul className="absolute w-full bg-white border border-gray-300 rounded-md mt-1 shadow-lg" style={{zIndex: 1000}}>
          {/* 입력값이 없을 때는 최근 검색어, 있을 때는 추천 검색어를 보여줍니다. */}
          {inputValue.length === 0 && recentSearches.length > 0 ? (
            <>
              <li className="px-4 py-2 text-sm text-gray-500">최근 검색</li>
              {recentSearches.map((place) => (
                <li key={place.name} onMouseDown={() => handleRecentClick(place)} className="px-4 py-2 cursor-pointer hover:bg-gray-100 flex justify-between items-center">
                  <span>{place.name}</span>
                  <button onMouseDown={(e) => { e.stopPropagation(); removeRecentSearch(place.name);}} className="text-gray-400 hover:text-gray-700 text-xl">×</button>
                </li>
              ))}
            </>
          ) : (
            predictions.map((prediction) => (
              <li key={prediction.placePrediction.placeId} onMouseDown={() => handlePredictionClick(prediction)} className="px-4 py-2 cursor-pointer hover:bg-gray-100">
                <div>
                  <span className="font-semibold">{prediction.placePrediction.structuredFormat.mainText.text}</span>
                  <span className="text-sm text-gray-500 ml-2">{prediction.placePrediction.structuredFormat.secondaryText.text}</span>
                </div>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
