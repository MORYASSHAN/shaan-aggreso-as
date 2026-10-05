import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router';
import { useLogout, useSession } from '../features/auth/session.js';
import { ROLE_LABEL } from '../lib/constants.js';
import { linksFor } from '../lib/nav.js';

function Logo() {
  return (
    <svg width="18" height="16" viewBox="0 0 18 16" aria-hidden="true" className="text-fg">
      <path
        d="M1 15V5l5-4v14zM8 15V7l4-3v11zM14 15V9l3-2.5V15z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
      />
    </svg>
  );
}

const linkClass = ({ isActive }) =>
  `rounded-md px-2.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.08em] transition-colors duration-150 ${
    isActive ? 'text-fg bg-white/[0.06]' : 'text-subtle hover:text-fg'
  }`;

export function Layout() {
  const { data: user } = useSession();
  const logout = useLogout();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const links = user ? linksFor(user.role) : [];

  const signOut = () => logout.mutate(undefined, { onSettled: () => navigate('/login') });

  return (
    <div className="min-h-screen">
      <div className="sticky top-0 z-40 px-3 pt-3 sm:px-5">
        <nav className="mx-auto flex max-w-6xl items-center justify-between gap-3 rounded-xl border border-line bg-black/70 px-3 py-2 shadow-[inset_0_1px_0_rgb(255_255_255/0.05)] backdrop-blur-md">
          <NavLink to="/" className="flex items-center gap-2.5 px-1.5" aria-label="Moderation Workbench home">
            <Logo />
            <span className="hidden font-mono text-[11px] uppercase tracking-[0.08em] text-muted sm:inline">
              Workbench
            </span>
          </NavLink>

          {user && (
            <>
              <div className="hidden items-center gap-1 md:flex">
                {links.map((l) => (
                  <NavLink key={l.to} to={l.to} end={l.to === '/'} className={linkClass}>
                    {l.label}
                  </NavLink>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <span className="hidden text-right leading-tight sm:block">
                  <span className="block text-xs text-fg">{user.name}</span>
                  <span className="block font-mono text-[10px] uppercase tracking-[0.06em] text-subtle">
                    {ROLE_LABEL[user.role]}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={signOut}
                  className="h-7 rounded-md border border-line px-2.5 font-mono text-[11px] uppercase tracking-[0.08em] text-muted transition-colors duration-150 hover:border-line-strong hover:text-fg"
                >
                  Log out
                </button>
                <button
                  type="button"
                  className="h-7 rounded-md border border-line px-2 text-muted md:hidden"
                  aria-expanded={open}
                  aria-label="Menu"
                  onClick={() => setOpen((v) => !v)}
                >
                  ☰
                </button>
              </div>
            </>
          )}
        </nav>
        {user && open && (
          <div className="mx-auto mt-2 flex max-w-6xl flex-col gap-1 rounded-xl border border-line bg-black/90 p-2 backdrop-blur-md md:hidden fade-in">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.to === '/'}
                className={linkClass}
                onClick={() => setOpen(false)}
              >
                {l.label}
              </NavLink>
            ))}
          </div>
        )}
      </div>

      <main className="mx-auto max-w-6xl px-4 pb-24 pt-10 sm:px-6">
        <Outlet />
      </main>

      <a
        href="https://moryasshan.vercel.app"
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-4 right-4 z-40 inline-flex h-8 items-center gap-1.5 rounded-full border border-line bg-black/70 px-3.5 font-mono text-[11px] uppercase tracking-[0.08em] text-muted shadow-[inset_0_1px_0_rgb(255_255_255/0.05)] backdrop-blur-md transition-colors duration-150 hover:border-line-strong hover:text-fg"
      >
        Portfolio <span aria-hidden="true">↗</span>
      </a>
    </div>
  );
}
