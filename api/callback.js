// api/callback.js
// CCP reindirizza qui dopo il login ESI
// Scambia il code con access_token e verifica l'identità

export default async function handler(req, res) {
  const { code, state } = req.query;

  // Verifica state CSRF
  const cookies = parseCookies(req.headers.cookie || '');
  if (!state || state !== cookies.eve_state) {
    return res.status(400).send('Invalid state parameter. Possible CSRF attack.');
  }

  if (!code) {
    return res.status(400).send('Missing authorization code.');
  }

  const clientId     = process.env.EVE_CLIENT_ID;
  const clientSecret = process.env.EVE_CLIENT_SECRET;
  const callbackUrl  = process.env.EVE_CALLBACK_URL;

  try {
    // 1. Scambia code → access_token
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
      return res.status(500).send('Token exchange failed.');
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    // 2. Verifica identità del personaggio
    const verifyRes = await fetch('https://login.eveonline.com/oauth/verify', {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });

    if (!verifyRes.ok) {
      return res.status(500).send('Could not verify character.');
    }

    const charData = await verifyRes.json();
    const characterId   = charData.CharacterID;
    const characterName = charData.CharacterName;

    // 3. Controlla whitelist
    const whitelist = (process.env.WHITELIST_CHARACTER_IDS || '')
      .split(',')
      .map(id => id.trim());
    const ceoId = process.env.CEO_CHARACTER_ID;

    const isAllowed = whitelist.includes(String(characterId));
    const isCeo     = String(characterId) === String(ceoId);

    if (!isAllowed) {
      // Non autorizzato — redirect alla pagina pubblica con messaggio
      return res.redirect(302, '/?auth=denied&name=' + encodeURIComponent(characterName));
    }

    // 4. Crea sessione — salva token e ruolo in cookie HttpOnly
    const sessionData = JSON.stringify({
      characterId,
      characterName,
      accessToken,
      refreshToken: tokenData.refresh_token,
      isCeo,
      expires: Date.now() + (tokenData.expires_in * 1000),
    });

    const encoded = Buffer.from(sessionData).toString('base64');

    res.setHeader('Set-Cookie', [
      `eve_session=${encoded}; HttpOnly; Secure; SameSite=Lax; Max-Age=3600; Path=/`,
      `eve_state=; HttpOnly; Secure; SameSite=Lax; Max-Age=0; Path=/`, // cancella state
    ]);

    // 5. Redirect alla dashboard
    return res.redirect(302, '/dashboard.html');

  } catch (err) {
    console.error('Callback error:', err);
    return res.status(500).send('Internal server error during authentication.');
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
