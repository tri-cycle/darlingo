/* global process */
import assert from 'assert';
process.env.VITE_ORS_API_KEY = 'test';
const { ensureRateLimit, __test } = await import('../src/utils/fetchBikeRoute.js');

const { callTimes } = __test;

// callTimes를 LIMIT_PER_MINUTE만큼 채운 뒤, 가장 오래된 호출이 1분에 거의 도달하도록 설정
callTimes.length = 0;
const now = Date.now();
for (let i = 0; i < 40; i += 1) {
  callTimes.push(now - 59950);
}

const start = Date.now();
await ensureRateLimit();
const elapsed = Date.now() - start;

// 약간의 대기 시간이 발생했는지 확인
assert(elapsed >= 50, `expected wait >=50ms, got ${elapsed}`);
assert.strictEqual(callTimes.length, 1);

console.log('Rate limit enforcement test passed:', elapsed);
