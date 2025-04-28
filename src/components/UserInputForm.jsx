import { useState } from 'react';
import axios from 'axios';
import { useRoute } from '../context/RouteContext';

export default function UserInputForm() {
  const { setRoute } = useRoute();
  const [startTxt, setStartTxt] = useState('');
  const [endTxt, setEndTxt] = useState('');
  const [time, setTime] = useState('');

  const geocodeAddress = async (address) => {
    const response = await axios.post('http://localhost:3001/geocode', { address });
    const data = response.data;

    if (!data.addresses || data.addresses.length === 0) {
      throw new Error('좌표를 찾을 수 없습니다.');
    }

    const { x, y } = data.addresses[0];
    return { lat: Number(y), lon: Number(x) };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log('🚀 handleSubmit 호출됨');

    try {
      const [startCoord, endCoord] = await Promise.all([
        geocodeAddress(startTxt),
        geocodeAddress(endTxt),
      ]);

      setRoute({
        start: { title: startTxt, ...startCoord },
        end: { title: endTxt, ...endCoord },
        time,
      });

      console.log('✅ 전역 상태 저장 완료:', {
        start: { title: startTxt, ...startCoord },
        end: { title: endTxt, ...endCoord },
        time,
      });
    } catch (error) {
      console.error(error);
      alert('주소를 변환하는 데 실패했습니다.');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-md mx-auto p-4">
      <h2 className="text-xl font-bold text-center mb-4">경로 입력</h2>

      <input
        type="text"
        value={startTxt}
        onChange={(e) => setStartTxt(e.target.value)}
        placeholder="출발지를 입력하세요"
        className="w-full rounded border px-3 py-2"
        required
      />

      <input
        type="text"
        value={endTxt}
        onChange={(e) => setEndTxt(e.target.value)}
        placeholder="도착지를 입력하세요"
        className="w-full rounded border px-3 py-2"
        required
      />

      <input
        type="number"
        value={time}
        onChange={(e) => setTime(e.target.value)}
        placeholder="따릉이 이용 시간(분)"
        className="w-full rounded border px-3 py-2"
        min={1}
      />

      <button
        type="submit"
        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded"
      >
        경로 계산하기
      </button>
    </form>
  );
}
