import { signIn } from 'next-auth/react';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/router';

export default function LoginPage() {
  const router = useRouter();
  const [username, setU] = useState('');
  const [password, setP] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr('');
    setLoading(true);

    const res = await signIn('credentials', {
      redirect: false,          // <- no dejes que NextAuth redirija
      username,
      password,
    });

    setLoading(false);

    if (res?.ok) {
      // <- siempre al dashboard
      router.replace('/');
    } else {
      setErr('Credenciales incorrectas o error de servidor.');
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4 border rounded-xl p-6 bg-white">
        <h1 className="text-xl font-semibold">Iniciar sesión</h1>
        <input
          className="w-full border rounded p-2"
          placeholder="Usuario"
          value={username}
          onChange={e => setU(e.target.value)}
        />
        <input
          className="w-full border rounded p-2"
          type="password"
          placeholder="Contraseña"
          value={password}
          onChange={e => setP(e.target.value)}
        />
        {err && <p className="text-red-600 text-sm">{err}</p>}
        <button
          className="w-full rounded bg-black text-white py-2 disabled:opacity-60"
          disabled={loading}
          type="submit"
        >
          {loading ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </main>
  );
}
