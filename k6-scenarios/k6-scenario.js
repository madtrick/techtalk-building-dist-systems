import http from 'k6/http'
import { sleep } from 'k6'

export const options = {
  scenarios: {
    first_wave: {
      executor: 'per-vu-iterations',
      vus: 100,
      iterations: 50,
      maxDuration: '30s'
    },
    second_wave: {
      startTime: '10s',
      executor: 'constant-arrival-rate',
      preAllocatedVUs: 200,
      rate: 25,
      timeUnit: '1s',
      duration: '20s'
    }
  },
}

export default function () {
  http.get('http://coordinator:3000')
}
