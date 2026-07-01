// api/me.js

export default async function handler(req, res) {
  const cookies = parseCookies(req.headers.cookie || '');
  const sessionCookie = cookies.eve_session;

  if (!sessionCookie) {
    return res.status(401).json({ authenticated: false, reason: 'no_cookie' });
  }

  let session;
  try {
    session = JSON.parse(Buffer.from(sessionCookie, 'base64').toString('utf8'));
  } catch {
    return res.status(401).json({ authenticated: false, reason: 'bad_cookie' });
  }

  // Se accessToken mancante o scaduto → refresh
  const needsRefresh = !session.accessToken || Date.now() > (session.expires - 60000);

  if (needsRefresh) {
    if (!session.refreshToken) {
      return res.status(401).json({ authenticated: false, reason: 'no_refresh_token' });
    }

    const refreshed = await doRefresh(session.refreshToken);
    if (!refreshed) {
      return res.status(401).json({ authenticated: false, reason: 'refresh_failed' });
    }

    session.accessToken = refreshed.access_token;
    session.refreshToken = refreshed.refresh_token || session.refreshToken;
    session.expires = Date.now() + ((refreshed.expires_in || 1200) * 1000);

    const encoded = Buffer.from(JSON.stringify(session)).toString('base64');
    res.setHeader('Set-Cookie', `eve_session=${encoded}; HttpOnly; Secure; SameSite=Lax; Max-Age=3600; Path=/`);
  }

  return res.status(200).json({
    authenticated: true,
    characterId:   session.characterId,
    characterName: session.characterName,
    isCeo:         session.isCeo,
    isDirector:    session.isDirector,
    accessToken:   session.accessToken,
  });
}

async function doRefresh(token) {
  try {
    const clientId     = process.env.EVE_CLIENT_ID;
    const clientSecret = process.env.EVE_CLIENT_SECRET;

    const res = await fetch('https://login.eveonline.com/v2/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64'),
      },
      body: new URLSearchParams({
        grant_type:    'refresh_token',
        refresh_token: token,
      }),
    });

    if (!res.ok) {
      console.error('Refresh failed:', await res.text());
      return null;
    }
    return await res.json();
  } catch (e) {
    console.error('Refresh error:', e.message);
    return null;
  }
}

function parseCookies(cookieHeader) {
  const cookies = {};
  cookieHeader.split(';').forEach(part => {
    const [key, ...val] = part.trim().split('=');
    if (key) cookies[key.trim()] = decodeURIComponent(val.join('='));
  });
  return cookies;
}
