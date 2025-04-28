import { useState, useEffect, useRef } from 'react';

export default function AutoCompleteInput({ value, onSelect, placeholder }) {
  const [keyword, setKeyword] = useState(value);
  const [items, setItems] = useState([]);
  const timer = useRef(null);

  // 🔍 키 입력할 때마다 300 ms 디바운스-요청
  useEffect(() => {
    clearTimeout(timer.current);
    if (!keyword.trim()) {
      setItems([]);
      return;
    }
    timer.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://oapi.map.naver.com/search?query=${encodeURIComponent(keyword)}&display=5&key=${import.meta.env.VITE_NAVER_KEY}`,
        );
        const json = await res.json();
        setItems(json.items || []); // { title, category, roadAddress }
      } catch (e) {
        console.error('autocomplete error:', e);
        setItems([]);
      }
    }, 300);
  }, [keyword]);

  // 항목 클릭 시 선택
  const handleSelect = item => {
    setKeyword(item.title.replace(/<[^>]+>/g, '')); // 태그 제거
    setItems([]);
    onSelect(item); // 상위 컴포넌트에 { title, ... } 반환
  };

  return (
    <div className="relative">
      <input
        className="w-full rounded border px-3 py-2"
        value={keyword}
        onChange={e => setKeyword(e.target.value)}
        placeholder={placeholder}
        required
      />
      {items.length > 0 && (
        <ul className="absolute z-10 mt-1 w-full rounded border bg-white shadow">
          {items.map(item => (
            <li
              key={item.id + item.title}
              className="cursor-pointer px-3 py-1 hover:bg-gray-100"
              onClick={() => handleSelect(item)}
              dangerouslySetInnerHTML={{ __html: item.title }}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
