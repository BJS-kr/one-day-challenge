export const makeEventHandler =
  (clickEvent) => (socket, userId, currentTime) => {
    if (clickEvent.isValid(userId, currentTime)) {
      if (!clickEvent.isParticipated(userId)) {
        return clickEvent.participate(userId, currentTime);
      }

      clickEvent.increaseCount(userId, currentTime);

      if (!clickEvent.isRateValid(userId)) {
        clickEvent.ban(userId);
        socket.destroy();
      }
    }
  };
