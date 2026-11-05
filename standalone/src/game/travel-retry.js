// The caller owns the busy lock and cancellation scope for the entire operation.
// Only an explicitly rejected travel is retried, never an uncertain request.
export async function sendWithTravelRetry(kind, send, stillCurrent, wait = ms => new Promise(resolve => setTimeout(resolve, ms))) {
  try { return await send(); }
  catch (error) {
    if (kind !== 'travel' || error?.status !== 429 || error?.code !== 'MOVE_COOLDOWN') throw error;
    await wait(180);
    if (!stillCurrent()) return null;
    return send(); // Exactly one retry; another rejection goes to the caller.
  }
}
