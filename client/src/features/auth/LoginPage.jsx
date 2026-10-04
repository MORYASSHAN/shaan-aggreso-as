import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { Arrow, Button } from '../../components/Button.jsx';
import { ErrorBanner } from '../../components/ErrorBanner.jsx';
import { Field, Input } from '../../components/Field.jsx';
import { ROLE_LABEL, ROLES } from '../../lib/constants.js';
import { homeFor } from '../../lib/nav.js';
import { useLogin, useSession } from './session.js';

const DEMO_ACCOUNTS = [
  { email: 'author@example.com', role: ROLES.AUTHOR, name: 'Alex' },
  { email: 'author2@example.com', role: ROLES.AUTHOR, name: 'Blake' },
  { email: 'moderator@example.com', role: ROLES.MODERATOR, name: 'Morgan' },
  { email: 'senior@example.com', role: ROLES.SENIOR, name: 'Sam' },
  { email: 'admin@example.com', role: ROLES.ADMIN, name: 'Ari' },
];

// Optional: when set at build time, the demo buttons log in with one click. Otherwise they fill the email.
const DEMO_PASSWORD = import.meta.env.VITE_DEMO_PASSWORD;

export function LoginPage() {
  const { data: user } = useSession();
  const login = useLogin();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [touched, setTouched] = useState(false);

  if (user) return <Navigate to={homeFor(user.role)} replace />;

  const errors = {
    email: /^\S+@\S+\.\S+$/.test(email) ? null : 'Enter a valid email address',
    password: password ? null : 'Password is required',
  };
  const valid = !errors.email && !errors.password;

  const submit = (credentials) =>
    login.mutate(credentials, {
      onSuccess: ({ user: me }) => navigate(location.state?.from ?? homeFor(me.role), { replace: true }),
    });

  const onSubmit = (e) => {
    e.preventDefault();
    setTouched(true);
    if (valid) submit({ email, password });
  };

  const pickDemo = (account) => {
    setEmail(account.email);
    if (DEMO_PASSWORD) submit({ email: account.email, password: DEMO_PASSWORD });
    else document.getElementById('login-password')?.focus();
  };

  return (
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-col justify-center px-4 py-12 fade-in">
      <p className="label mb-4">Moderation Workbench</p>
      <h1 className="font-serif text-5xl leading-[0.95] tracking-tight">
        The AI recommends.
        <br />
        <span className="text-muted">Humans decide.</span>
      </h1>

      <form onSubmit={onSubmit} noValidate className="card mt-10 flex flex-col gap-4 p-6">
        {login.error && <ErrorBanner error={login.error} />}
        <Field label="Email" error={touched && errors.email}>
          {(a11y) => (
            <Input
              {...a11y}
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          )}
        </Field>
        <Field label="Password" error={touched && errors.password}>
          {(a11y) => (
            <Input
              {...a11y}
              id="login-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          )}
        </Field>
        <Button
          type="submit"
          variant="primary"
          busy={login.isPending}
          busyLabel="Signing in…"
          disabled={touched && !valid}
        >
          Sign in <Arrow />
        </Button>
      </form>

      <div className="mt-8">
        <p className="label mb-3">Demo accounts</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {DEMO_ACCOUNTS.map((account) => (
            <button
              key={account.email}
              type="button"
              onClick={() => pickDemo(account)}
              disabled={login.isPending}
              className="card card-hover flex items-center justify-between px-3.5 py-2.5 text-left disabled:opacity-50"
            >
              <span className="text-sm">{account.name}</span>
              <span className="font-mono text-[10.5px] uppercase tracking-[0.06em] text-subtle">
                {ROLE_LABEL[account.role]}
              </span>
            </button>
          ))}
        </div>
        {!DEMO_PASSWORD && (
          <p className="mt-3 text-xs text-subtle">Choose an account, then enter the demo password.</p>
        )}
      </div>
    </div>
  );
}
