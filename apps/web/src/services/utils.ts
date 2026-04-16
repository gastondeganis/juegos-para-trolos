export const getOrCreatePlayerId = (): string => {
  let id = localStorage.getItem("playerId");
  if (!id) {
    id = Math.random().toString(36).substring(2, 15);
    localStorage.setItem("playerId", id);
  }
  return id;
};
