async function verifySupabaseUser(req) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) {
    const error = new Error('Authorization Bearer token eksik.');
    error.statusCode = 401;
    throw error;
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    const error = new Error('Supabase server environment eksik.');
    error.statusCode = 500;
    throw error;
  }

  const response = await fetch(`${url}/auth/v1/user`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    const error = new Error('Geçersiz veya süresi dolmuş oturum.');
    error.statusCode = 401;
    throw error;
  }

  return await response.json();
}

module.exports = { verifySupabaseUser };
