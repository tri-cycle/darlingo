import assert from "assert";
import { prioritizeRoutes } from "../src/utils/routeCalculator/prioritizeRoutes.js";

const routes = [
  { id: "transit-1", summary: { subPath: [{ trafficType: 1 }, { trafficType: 3 }] } },
  { id: "hybrid-1", summary: { subPath: [{ trafficType: 4 }, { trafficType: 1 }] } },
  { id: "bike-1", summary: { subPath: [{ trafficType: 4 }] } },
  { id: "transit-2", summary: { subPath: [{ trafficType: 2 }] } },
  { id: "hybrid-2", summary: { subPath: [{ trafficType: 4 }, { trafficType: 2 }] } },
  { id: "bike-2", summary: { subPath: [{ trafficType: 4 }] } },
];

const prioritized = prioritizeRoutes(routes).slice(0, 5);
const ids = prioritized.map(route => route.id);

assert.deepStrictEqual(ids.slice(0, 2), ["hybrid-1", "hybrid-2"]);
assert.deepStrictEqual(ids.slice(2), ["transit-1", "transit-2", "bike-1"]);

console.log("복합 경로 우선 정렬 테스트 통과");
