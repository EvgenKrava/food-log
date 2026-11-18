import { tr } from './i18n';
import { useEffect, useRef } from 'react';
import { useAuth } from 'react-oidc-context';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, BookOpen, CalendarDays, Plus, User } from 'lucide-react';
import { api, setTokenSource } from './api';
import { config } from './config';
import { navigate, useLocation } from './router';
import { TodayPage } from './pages/Today';
import { AddPage } from './pages/Add';
import { ProductFormPage } from './pages/ProductForm';
import { AdminPage } from './pages/Admin';
import { CatalogPage } from './pages/Catalog';
import { DishBuilderPage } from './pages/DishBuilder';
import { StatsPage } from './pages/Stats';
import { ProfilePage } from './pages/Profile';

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="grid h-full place-items-center p-6 text-center">{children}</div>;
}

export function App() {
  const auth = useAuth();
  const { path } = useLocation();
  const redirecting = useRef(false);
  // Local UI work against apps/api/src/dev-server.ts: no sign-in at all.
  const fakeAuth = import.meta.env.DEV && import.meta.env.VITE_FAKE_AUTH === '1';
  const authed = fakeAuth || auth.isAuthenticated;

  // Keep a live token for the API client; a failed refresh sends the user back to the shared sign-in.
  useEffect(() => {
    setTokenSource({
      token: async () => {
        let user = auth.user;
        if (user?.expired) user = await auth.signinSilent().catch(() => null);
        return user?.id_token ?? null;
      },
      onUnauthorized: () => void auth.signinRedirect({ state: { returnTo: window.location.pathname } }),
    });
  }, [auth]);

  const signedOut = !fakeAuth && !auth.isLoading && !auth.isAuthenticated && !auth.activeNavigator && path !== '/callback';
  useEffect(() => {
    if (!signedOut || redirecting.current) return;
    const hasRefresh = !!auth.user?.refresh_token;
    redirecting.current = true;
    const go = () => void auth.signinRedirect({ state: { returnTo: window.location.pathname + window.location.search } });
    if (hasRefresh) auth.signinSilent().then((u) => (u ? (redirecting.current = false) : go()), go);
    else go();
  }, [signedOut, auth]);

  const me = useQuery({ queryKey: ['me'], queryFn: api.me, enabled: authed });

  if (auth.error && !authed) {
    return (
      <Centered>
        <div className="ot-card max-w-sm">
          <p className="ot-h3">{tr('Не вдалося увійти')}</p>
          <p className="ot-text">{auth.error.message}</p>
          <button className="ot-btn" onClick={() => void auth.signinRedirect()}>{tr('Спробувати ще раз')}</button>
        </div>
      </Centered>
    );
  }
  if (!authed || !me.data) {
    return <Centered><p className="ot-muted">{tr('Завантаження…')}</p></Centered>;
  }
  if (!me.data.hasAccess) {
    return (
      <Centered>
        <div className="ot-card max-w-sm">
          <p className="ot-h3">{tr('FoodLog поки недоступний для вашого акаунта')}</p>
          <p className="ot-text">{tr('Попросіть адміністратора Only Tools відкрити доступ.')}</p>
          <a className="ot-btn" href={config.hubUrl}>{tr('До Only Tools')}</a>
        </div>
      </Centered>
    );
  }

  const tabs = [
    { to: '/', label: tr('Сьогодні'), icon: CalendarDays },
    { to: '/catalog', label: tr('Каталог'), icon: BookOpen },
    { to: '/stats', label: tr('Статистика'), icon: BarChart3 },
    { to: '/profile', label: tr('Профіль'), icon: User },
  ];
  const isActive = (to: string) => (to === '/' ? path === '/' : path.startsWith(to));
  const link = (to: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    navigate(to);
  };

  let page: React.ReactNode;
  if (path === '/add') page = <AddPage />;
  else if (path === '/products/new') page = <ProductFormPage />;
  else if (path === '/catalog') page = <CatalogPage />;
  else if (path.startsWith('/dishes/')) page = <DishBuilderPage />;
  else if (path === '/stats') page = <StatsPage />;
  else if (path === '/profile') page = <ProfilePage me={me.data} />;
  else if (path === '/admin' && me.data.isAdmin) page = <AdminPage />;
  else page = <TodayPage />;

  const navItem = (t: (typeof tabs)[number]) => (
    <a key={t.to} href={t.to} onClick={link(t.to)} className={`ot-nav__item${isActive(t.to) ? ' is-active' : ''}`} aria-current={isActive(t.to) ? 'page' : undefined}>
      <span className="ot-nav__pill"><t.icon className="ot-icon" /></span>
      {t.label}
    </a>
  );

  return (
    <div className="ot-shell">
      <div className="ot-layout">
        <nav className="ot-nav" aria-label={tr('Розділи')}>
          <a className="ot-nav__brand ot-brand" href={config.hubUrl}>
            <span className="ot-logo"><i /><i /><i /><i /></span>
            <span>FoodLog</span>
          </a>
          {tabs.slice(0, 2).map(navItem)}
          <a className="ot-nav__add" href="/add" onClick={link('/add')} aria-label={tr('Додати їжу')}>
            <span className="ot-fab"><Plus className="ot-icon" /></span>
            <span className="ot-btn ot-btn--block"><Plus className="ot-icon" />{tr('Додати їжу')}</span>
          </a>
          {tabs.slice(2).map(navItem)}
          <span className="ot-nav__spacer" />
        </nav>
        <main className="ot-main">{page}</main>
      </div>
    </div>
  );
}
