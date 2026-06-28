// api/me.js
// Ritorna i dati del personaggio autenticato dalla sessione
// Usato dal frontend per sapere chi è loggato e che ruolo ha

export default async function handler(req, res) {
  const cookies = parseCookies(req.headers.cookie || '');
  const sessionCookie = cookies.eve_session;

  if (!sessionCookie) {
    return res.status(401).json({ authenticated: false });
  }

  try {
    const session = JSON.parse(Buffer.from(sessionCookie, 'base64').toString('utf8'));

    // Controlla scadenza token
    if (Date.now() > session.expires - 60000) {
      // Token scaduto — prova refresh
      const refreshed = await refreshToken(session.refreshToken);
      if (!refreshed) {
        return res.status(401).json({ authenticated: false, reason: 'token_expired' });
      }
      session.accessToken = refreshed.access_token;
      session.expires = Date.now() + (refreshed.expires_in * 1000);
      session.refreshToken = refreshed.refresh_token || session.refreshToken;

      // Aggiorna cookie
      const encoded = Buffer.from(JSON.stringify(session)).toString('base64');
      res.setHeader('Set-Cookie', `eve_session=${encoded}; HttpOnly; Secure; SameSite=Lax; Max-Age=3600; Path=/`);
    }

    return res.status(200).json({
      authenticated: true,
      characterId:   session.characterId,
      characterName: session.characterName,
      isCeo:         session.isCeo,
      accessToken:   session.accessToken,
    });

  } catch (err) {
    console.error('Session parse error:', err);
    return res.status(401).json({ authenticated: false, reason: 'invalid_session' });
  }
}

async function refreshToken(token) {
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

    if (!res.ok) return null;
    return await res.json();
  } catch {
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
