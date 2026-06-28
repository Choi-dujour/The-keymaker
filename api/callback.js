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
  const callbackUrl  = process.env.EVE_CALLBACK_URL; // deve essere https://the-keymaker-ruby.vercel.app/api/callback

  try {
    // 1. Scambia il code per un token
    const tokenRes = await fetch('https://login.eveonline.com/v2/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64'),
        'Host': 'login.eveonline.com',
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
      return res.status(500).send('Token exchange failed: ' + err);
    }

    const tokenData   = await tokenRes.json();
    const accessToken = tokenData.access_token;

    // 2. Decodifica il JWT per ottenere i dati del personaggio
    //    EVE SSO v2 restituisce l'access_token come JWT firmato — niente chiamata /verify
    const jwtPayload = JSON.parse(
      Buffer.from(accessToken.split('.')[1], 'base64url').toString('utf8')
    );

    // Il sub è nel formato "CHARACTER:EVE:<id>"
    const subParts    = (jwtPayload.sub || '').split(':');
    const characterId = subParts[2] || null;
    const characterName = jwtPayload.name || '';

    if (!characterId) {
      console.error('Could not extract characterId from JWT sub:', jwtPayload.sub);
      return res.status(500).send('Could not identify character.');
    }

    // 3. Controlla whitelist
    const whitelist = (process.env.WHITELIST_CHARACTER_IDS || '')
      .split(',')
      .map(id => id.trim())
      .filter(Boolean);

    const ceoId    = (process.env.CEO_CHARACTER_ID || '').trim();
    const isAllowed = whitelist.includes(String(characterId));
    const isCeo     = String(characterId) === String(ceoId);

    if (!isAllowed) {
      return res.redirect(302, '/?auth=denied&name=' + encodeURIComponent(characterName));
    }

    // 4. Crea sessione firmata con HMAC-SHA256
    const sessionPayload = JSON.stringify({
      characterId,
      characterName,
      accessToken,
      refreshToken: tokenData.refresh_token,
      isCeo,
      expires: Date.now() + (tokenData.expires_in * 1000),
    });

    // Firma HMAC per evitare manomissioni del cookie
    const secret = process.env.SESSION_SECRET || 'changeme-use-a-real-secret';
    const { createHmac } = await import('crypto');
    const encoded   = Buffer.from(sessionPayload).toString('base64');
    const signature = createHmac('sha256', secret).update(encoded).digest('hex');
    const cookieValue = `${encoded}.${signature}`;

    res.setHeader('Set-Cookie', [
      `eve_session=${cookieValue}; HttpOnly; Secure; SameSite=Lax; Max-Age=3600; Path=/`,
    ]);

    // 5. Redirect alla dashboard
    return res.redirect(302, '/dashboard.html');

  } catch (err) {
    console.error('Callback error:', err);
    return res.status(500).send('Internal server error during authentication.');
  }
}
