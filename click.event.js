export class ClickEvent {
  clickEvent = new Map();
  constructor(session, rateLimiter, eventStart, eventDuration) {
    this.eventStart = eventStart;
    this.eventEnd = eventStart + eventDuration;
    this.session = session;
    this.rateLimiter = rateLimiter;
  }

  isValid(userId, currentTime) {
    return (
      currentTime > this.eventStart &&
      currentTime < this.eventEnd &&
      this.session.has(userId) &&
      !this.isBanned(userId)
    );
  }

  isParticipated(userId) {
    return this.clickEvent.has(userId);
  }

  participate(userId, currentTime) {
    if (this.isBanned(userId)) return;

    this.rateLimiter.addEntry(userId, currentTime);
    this.clickEvent.set(userId, 1);
  }

  increaseCount(userId, currentTime) {
    this.rateLimiter.addRecord(userId, currentTime);
    this.clickEvent.set(userId, this.clickEvent.get(userId) + 1);
  }

  ban(userId) {
    this.clickEvent.set(userId, -1);
  }

  isBanned(userId) {
    return this.clickEvent.get(userId) === -1;
  }

  isRateValid(userId, currentTime) {
    return !(
      this.rateLimiter.isRateLimited(userId) ||
      this.rateLimiter.isIdler(userId, currentTime)
    );
  }

  mergeEvents(...maps) {
    maps.forEach((map) => {
      for (const [k, v] of map) {
        this.clickEvent.set(k, (this.clickEvent.get(k) ?? 0) + v);
      }
    });
  }

  mergeRateRecords(...records) {
    this.rateLimiter.mergeRecords(...records);
  }

  getWinner() {
    const qualifiers = [...this.clickEvent].filter(([userId, _]) => {
      const idleTime =
        this.eventEnd - (this.rateLimiter.getRecords(userId).at(-1) ?? 0);
      return idleTime < this.rateLimiter.idleDuration;
    });

    if (!qualifiers.length) return null;

    const max = Math.max(...qualifiers.map(([_, count]) => count));

    if (max === -Infinity || max < 1) return null;

    const winners = [...qualifiers]
      .filter(([_, count]) => count === max)
      .map(([userId]) => userId);

    if (winners.length === 1) return winners[0];

    return winners
      .map((userId) => {
        const requests = this.rateLimiter.getRecords(userId);
        return { userId, lastRecord: requests.at(-1) };
      })
      .sort((a, b) => a.lastRecord - b.lastRecord)[0].userId;
  }
}
