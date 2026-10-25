async function request(path, body) {
  const response = await fetch(path, {
    method: body === undefined ? 'GET' : 'POST',
    credentials: 'same-origin',
    headers: body === undefined
      ? { Accept: 'application/json' }
      : { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let data;
  try {
    data = await response.json();
  } catch {
    throw Error('The realm is temporarily unavailable. Please reconnect.');
  }
  if (!response.ok) {
    const failure = Object.assign(
      Error(data.error || 'Unable to complete that action.'),
      { status: response.status, code: data.code, response: { status: response.status, data } },
    );
    throw failure;
  }
  return { data };
}

export const api = {
  get: path => request(path),
  post: (path, body) => request(path, body),
};