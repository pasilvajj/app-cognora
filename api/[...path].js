/**
 * Proxy /api/* → EC2 sem repassar Origin/Referer (evita 403 "Invalid CORS request" no Spring).
 */
const API_ORIGIN = process.env.COGNORA_API_ORIGIN || 'http://3.141.199.149:8080';

const STRIP_REQUEST_HEADERS = new Set(['host', 'origin', 'referer', 'connection', 'content-length']);

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

module.exports = async (req, res) => {
  const pathParam = req.query.path;
  const pathSuffix = Array.isArray(pathParam) ? pathParam.join('/') : pathParam || '';
  const queryStart = req.url?.indexOf('?') ?? -1;
  const queryString = queryStart >= 0 ? req.url.slice(queryStart) : '';
  const targetUrl = `${API_ORIGIN}/api/${pathSuffix}${queryString}`;

  const headers = {};
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined || STRIP_REQUEST_HEADERS.has(key.toLowerCase())) {
      continue;
    }
    headers[key] = Array.isArray(value) ? value.join(', ') : value;
  }

  let body;
  if (req.method && !['GET', 'HEAD'].includes(req.method.toUpperCase())) {
    body = await readBody(req);
  }

  try {
    const upstream = await fetch(targetUrl, {
      method: req.method,
      headers,
      body: body?.length ? body : undefined,
    });

    res.status(upstream.status);
    upstream.headers.forEach((value, key) => {
      if (key.toLowerCase() === 'transfer-encoding') {
        return;
      }
      res.setHeader(key, value);
    });

    const responseBody = Buffer.from(await upstream.arrayBuffer());
    res.send(responseBody);
  } catch (error) {
    res.status(502).json({
      error: 'Bad Gateway',
      message: error instanceof Error ? error.message : String(error),
    });
  }
};
