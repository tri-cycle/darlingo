// /api/getStations.js

// fetch API를 사용하기 위해 node-fetch를 import합니다.
// Vercel 환경에서는 기본적으로 fetch가 지원될 수 있으나, 명시적으로 포함하는 것이 안전합니다.
// 프로젝트에 node-fetch를 추가해야 합니다: npm install node-fetch
import fetch from 'node-fetch';

export default async function handler(request, response) {
  // 1. 요청에서 API 키와 페이지 정보를 가져옵니다.
  const API_KEY = process.env.VITE_SEOUL_API_KEY; 
  const { from, to } = request.query;

  // 2. 서울시 API의 실제 주소 (http와 8088 포트 사용)
  const targetUrl = `http://openapi.seoul.go.kr:8088/${API_KEY}/json/bikeList/${from}/${to}/`;

  try {
    // 3. 우리 서버(Vercel)에서 서울시 API 서버로 요청을 보냅니다.
    const apiResponse = await fetch(targetUrl);
    
    if (!apiResponse.ok) {
      // API 서버가 에러를 반환한 경우
      throw new Error(`API server responded with status: ${apiResponse.status}`);
    }

    const data = await apiResponse.json();
    
    // 4. 성공적으로 받은 데이터를 클라이언트(브라우저)에게 전달합니다.
    response.status(200).json(data);

  } catch (error) {
    console.error('Proxy API Error:', error);
    response.status(500).json({ error: 'Failed to fetch data from Seoul API', details: error.message });
  }
}
