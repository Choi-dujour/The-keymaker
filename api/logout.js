// api/logout.js
export default function handler(req, res) {
  res.setHeader('Set-Cookie', 'eve_session=; HttpOnly; Secure; SameSite=Lax; Max-Age=0; Path=/');
  res.redirect(302, '/');
}
