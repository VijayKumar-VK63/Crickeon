import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 40,
  duration: '2m',
  thresholds: {
    http_req_duration: ['p(95)<250'],
    http_req_failed: ['rate<0.02']
  }
};

const base = __ENV.BASE_URL || 'http://localhost:3000/api/v1';

export default function () {
  const payload = JSON.stringify({
    roomId: __ENV.ROOM_ID,
    auctionId: __ENV.AUCTION_ID,
    cricketPlayerId: __ENV.PLAYER_ID || 'cric-001',
    ownerId: __ENV.OWNER_ID,
    amount: Number(__ENV.BID_AMOUNT || 550000)
  });

  const response = http.post(`${base}/auction/bid`, payload, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${__ENV.ACCESS_TOKEN || ''}`
    }
  });

  check(response, {
    'status is 200 or 4xx anti-cheat': (r) => r.status === 200 || r.status === 400 || r.status === 429
  });

  sleep(0.2);
}
