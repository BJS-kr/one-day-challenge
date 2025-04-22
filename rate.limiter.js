export class RateLimiter {
  records = {};
  constructor(timeUnit, windowLimit, tolerance, idleDuration) {
    this.idleDuration = timeUnit * idleDuration;
    this.windowLimit = timeUnit * windowLimit;
    this.tolerance = tolerance;
  }

  getRecords(userId) {
    return this.records[userId].requests;
  }

  mergeRecords(...records) {
    records.forEach((r) => {
      for (const [k, v] of Object.entries(r)) {
        this.records[k] = v;
      }
    });
  }

  addEntry(userId, currentTime) {
    this.records[userId] = {
      requests: [currentTime],
      head: 0,
    };
  }

  isRateLimited(userId) {
    const { head, requests } = this.records[userId];

    return requests.length - head > this.tolerance;
  }

  isIdler(userId, currentTime) {
    const { requests } = this.records[userId];
    return currentTime - requests.at(-1) >= this.idleDuration;
  }

  addRecord(userId, requestedTime) {
    let { head, requests } = this.records[userId];
    requests.push(requestedTime);
    const windowStart = requestedTime - this.windowLimit;

    while (requests[head] < windowStart) {
      if (head === requests.length - 1) {
        break;
      }
      head++;
    }

    this.records[userId].head = head;
  }
}
