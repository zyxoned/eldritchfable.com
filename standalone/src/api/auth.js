export async function authRequest(action, body, signal) {
  const response = await fetch('/api/auth/' + action, {
    method: body === undefined ? 'GET' : 'POST',
    credentials: 'same-origin',
    headers: body === undefined ? { Accept: 'application/json' } : { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal
  });
  let result;
  try { result = await response.json(); } catch { throw Error('The account service is unavailable. Please try again.'); }
  if (!response.ok) throw Object.assign(Error(result.error || 'Unable to process your request.'), { status: response.status, code: result.code });
  return result;
}
