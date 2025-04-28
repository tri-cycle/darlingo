const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json()); // body-parser 내장
app.use(express.urlencoded({ extended: true }));

app.post('/geocode', async (req, res) => {
  const { address } = req.body;

  if (!address) {
    return res.status(400).json({ error: '주소를 입력하세요.' });
  }

  try {
    const response = await axios.get('https://maps.apigw.ntruss.com/map-geocode/v2/geocode', {
      params: { query: address },
      headers: {
        'X-NCP-APIGW-API-KEY-ID': process.env.NAVER_CLIENT_ID,
        'X-NCP-APIGW-API-KEY': process.env.NAVER_CLIENT_SECRET,
      }
    });

    console.log('✅ 네이버 응답 데이터:', response.data);

    res.json(response.data); // addresses 배열 그대로 반환
  } catch (error) {
    console.error(error.response?.data || error.message);
    res.status(500).json({ error: 'Geocoding failed' });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server is running on port ${PORT}`);
});
