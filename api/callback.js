// api/callback.js

export default async function handler(req, res) {
  const { code, state } = req.query;

  if (!state || state.length < 5) {
    return res.status(400).send('Missing state parameter.');
  }
  if (!code) {
    return res.status(400).send('Missing authorization code.');
  }

  const clientId     = process.env.EVE_CLIENT_ID;
  const clientSecret = process.env.EVE_CLIENT_SECRET;
  const callbackUrl  = process.env.EVE_CALLBACK_URL;
  const ceoId        = process.env.CEO_CHARACTER_ID;
  const whitelist    = (process.env.WHITELIST_CHARACTER_IDS || '').split(',').map(s => s.trim());

  try {
    // 1. Scambia code → tokens
    const tokenRes = await fetch('https://login.eveonline.com/v2/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64'),
      },
      body: new URLSearchParams({
        grant_type:   'authorization_code',
        code,
        redirect_uri: callbackUrl,
      }),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      console.error('Token exchange failed:', err);
      return res.status(500).send(`Token exchange failed: ${err}`);
    }

    const tokenData = await tokenRes.json();
    const accessToken  = tokenData.access_token;
    const refreshToken = tokenData.refresh_token;
    const expiresIn    = tokenData.expires_in || 1200;

    // 2. Decodifica JWT per ottenere character info (senza chiamate extra)
    const jwtPayload = JSON.parse(
      Buffer.from(accessToken.split('.')[1], 'base64').toString('utf8')
    );

    // ESI v2 JWT: sub = "CHARACTER:EVE:12345678"
    const characterId   = String(jwtPayload.sub).split(':').pop();
    const characterName = jwtPayload.name || 'Unknown';

    // 3. Controlla whitelist
    const isAllowed = whitelist.includes(characterId);
    const isCeo     = characterId === String(ceoId);

    if (!isAllowed) {
      return res.redirect(302, '/?auth=denied&name=' + encodeURIComponent(characterName));
    }

    // 4. Sessione leggera — NO access_token nel cookie (troppo grande)
    // Salviamo solo l'essenziale, il refresh token ci basta per rigenerare
    const sessionData = JSON.stringify({
      characterId,
      characterName,
      accessToken,   // ~500 chars, ok
      refreshToken,
      isCeo,
      expires: Date.now() + (expiresIn * 1000),
    });

    const encoded = Buffer.from(sessionData).toString('base64');

    // Controlla dimensione cookie (max ~4000 bytes sicuri)
    if (encoded.length > 3800) {
      // Sessione troppo grande: salva senza accessToken (verrà refreshato da me.js)
      const slim = JSON.stringify({ characterId, characterName, refreshToken, isCeo, expires: 0 });
      const slimEncoded = Buffer.from(slim).toString('base64');
      res.setHeader('Set-Cookie', `eve_session=${slimEncoded}; HttpOnly; Secure; SameSite=Lax; Max-Age=3600; Path=/`);
    } else {
      res.setHeader('Set-Cookie', `eve_session=${encoded}; HttpOnly; Secure; SameSite=Lax; Max-Age=3600; Path=/`);
    }

    return res.redirect(302, '/dashboard.html');

  } catch (err) {
    console.error('Callback error:', err.message, err.stack);
    return res.status(500).send(`Auth error: ${err.message}`);
  }
}
