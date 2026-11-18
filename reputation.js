const STORE_KEY = 'wisp_reputation';
const TTL = 3600000; // 1 hour

async function getReputation(origin) {
  const store = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
  const entry = store[origin];
  if (!entry) return null;
  if (Date.now() - entry.timestamp > TTL) {
    delete store[origin];
    localStorage.setItem(STORE_KEY, JSON.stringify(store));
    return null;
  }
  return entry.winner;
}

async function setReputation(origin, winner) {
  const store = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
  store[origin] = {
    winner,
    timestamp: Date.now()
  };
  localStorage.setItem(STORE_KEY, JSON.stringify(store));
}

export { getReputation, setReputation };