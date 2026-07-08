'use client';

import { useEffect, useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import {
  AppData,
  DailyMinimum,
  Idea,
  IdeaCategory,
  IdeaStatus,
  KanbanColumn,
  Metrics,
  Review,
  STORAGE_KEY,
  Task,
  defaultDailyMinimum,
  demoData,
  emptyMetrics,
  todayISO,
} from '@/lib/data';
import { hasSupabaseConfig, supabase } from '@/lib/supabase';

const columns: Record<KanbanColumn, string> = {
  ideas: 'Идеи',
  week: 'На этой неделе',
  today: 'Сегодня',
  doing: 'В работе',
  done: 'Готово',
};

const metricLabels: Record<keyof Metrics, string> = {
  calls: 'звонки новым клиентам',
  messages: 'сообщения новым клиентам',
  followUps: 'follow-up',
  scripts: 'сценарии для рилса',
  content: 'единицы контента',
  touches: 'новые касания',
  money: 'деньги',
  leads: 'лиды',
  meetings: 'встречи',
  activeClients: 'клиенты в работе',
};

const minimumKeys: (keyof DailyMinimum)[] = ['calls', 'messages', 'followUps', 'scripts', 'content'];
const factsKeys: (keyof Metrics)[] = ['calls', 'messages', 'followUps', 'scripts', 'content', 'money', 'leads', 'meetings', 'activeClients'];
const cats: IdeaCategory[] = ['деньги', 'недвижимость', 'контент', 'фото', '3D', 'другое'];
const statuses: IdeaStatus[] = ['новая', 'отложена', 'выбрана', 'закрыта'];
const uid = () => crypto.randomUUID();
const pct = (a: number, b: number) => Math.min(100, Math.round((a / Math.max(1, b)) * 100));
const money = (n: number) => new Intl.NumberFormat('ru-RU').format(n);

type UpdateFn = (fn: (d: AppData) => AppData, msg?: string) => void;

function normalizeData(raw: AppData): AppData {
  const d = structuredClone(raw);
  const minimum = defaultDailyMinimum();
  d.dailyMinimum = { ...minimum, ...(d.dailyMinimum || {}) };
  d.sprint.dailyMetrics ||= {};
  d.sprint.dayMarks ||= {};
  d.sprint.taskIds ||= [];
  d.okr ||= demoData().okr;
  d.okr.objective = 'Денежный ориентир и рабочие цифры на 4 недели.';

  const defaultKrs = demoData().okr.keyResults;
  d.okr.keyResults = defaultKrs.map((def) => {
    const existing = d.okr.keyResults?.find((kr) => kr.id === def.id);
    return { ...def, current: existing?.current ?? def.current, target: def.id === 'kr5' ? 3000000 : existing?.target ?? def.target };
  });

  Object.keys(d.sprint.dailyMetrics).forEach((day) => {
    d.sprint.dailyMetrics[day] = { ...emptyMetrics(), ...d.sprint.dailyMetrics[day] };
  });

  return d;
}

function isDayComplete(metrics: Metrics, minimum: DailyMinimum) {
  return minimumKeys.every((k) => (metrics[k] ?? 0) >= (minimum[k] ?? 0));
}

function completedMinimumCount(metrics: Metrics, minimum: DailyMinimum) {
  return minimumKeys.filter((k) => (metrics[k] ?? 0) >= (minimum[k] ?? 0)).length;
}

function calcStreak(data: AppData) {
  let streak = 0;
  const cursor = new Date(todayISO());
  for (let i = 0; i < 60; i++) {
    const day = cursor.toISOString().slice(0, 10);
    const metrics = data.sprint.dailyMetrics[day] || emptyMetrics();
    if (!isDayComplete(metrics, data.dailyMinimum)) break;
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function syncDayMark(d: AppData, day: string) {
  const metrics = { ...emptyMetrics(), ...(d.sprint.dailyMetrics[day] || {}) };
  d.sprint.dailyMetrics[day] = metrics;
  d.sprint.dayMarks[day] = isDayComplete(metrics, d.dailyMinimum) ? 1 : 0;
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-[28px] border border-white/5 bg-card p-5 shadow-2xl shadow-black/20 ${className}`}>{children}</section>;
}

function Button({ children, onClick, type = 'button', className = '', disabled = false }: { children: React.ReactNode; onClick?: () => void; type?: 'button' | 'submit'; className?: string; disabled?: boolean }) {
  return (
    <button disabled={disabled} type={type} onClick={onClick} className={`rounded-2xl px-4 py-3 font-semibold transition ${disabled ? 'cursor-not-allowed bg-white/5 text-muted' : 'bg-accent text-white hover:scale-[1.02] hover:bg-orange-500'} ${className}`}>
      {children}
    </button>
  );
}

function GhostButton({ children, onClick, className = '' }: { children: React.ReactNode; onClick?: () => void; className?: string }) {
  return <button type="button" onClick={onClick} className={`rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10 ${className}`}>{children}</button>;
}

function Field(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-white placeholder:text-muted ${props.className || ''}`} />;
}

function Area(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className="min-h-24 w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-white placeholder:text-muted" />;
}

function Progress({ value }: { value: number }) {
  return (
    <div className="h-3 rounded-full bg-white/10">
      <div className="h-3 rounded-full bg-good" style={{ width: `${value}%` }} />
    </div>
  );
}

export default function Home() {
  const [data, setData] = useState<AppData>(demoData());
  const [tab, setTab] = useState('dashboard');
  const [toast, setToast] = useState('');
  const [hydrated, setHydrated] = useState(false);
  const [cloudReady, setCloudReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const notify = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(''), 6000);
  };

  const loadCloudData = async (userId: string) => {
    if (!supabase) return;
    setCloudReady(false);
    const { data: row, error } = await supabase.from('app_state').select('data').eq('user_id', userId).maybeSingle();
    if (error) notify(`Ошибка загрузки облака: ${error.message}`);

    if (row?.data) {
      setData(normalizeData(row.data as AppData));
    } else {
      const local = localStorage.getItem(STORAGE_KEY);
      const initial = normalizeData(local ? (JSON.parse(local) as AppData) : demoData());
      setData(initial);
      await supabase.from('app_state').upsert({ user_id: userId, data: initial, updated_at: new Date().toISOString() });
    }

    setCloudReady(true);
  };

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) setData(normalizeData(JSON.parse(raw)));
    setHydrated(true);

    if (!supabase) return;

    supabase.auth.getSession().then(({ data: sessionData }) => {
      const currentUser = sessionData.session?.user ?? null;
      setUser(currentUser);
      if (currentUser) loadCloudData(currentUser.id);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) loadCloudData(currentUser.id);
      else setCloudReady(false);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (hydrated) localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data, hydrated]);

  useEffect(() => {
    if (!supabase || !user || !cloudReady) return;
    const client = supabase;
    const userId = user.id;
    const timer = setTimeout(() => {
      client.from('app_state').upsert({ user_id: userId, data, updated_at: new Date().toISOString() }).then(({ error }) => {
        if (error) notify(`Ошибка сохранения в облако: ${error.message}`);
      });
    }, 500);
    return () => clearTimeout(timer);
  }, [data, user, cloudReady]);

  const update: UpdateFn = (fn, msg) =>
    setData((current) => {
      const next = normalizeData(fn(structuredClone(current)));
      if (msg) setTimeout(() => notify(msg), 0);
      return next;
    });

  const resetData = () => {
    const fresh = demoData();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
    setData(fresh);
    setTab('dashboard');
    notify('Данные сброшены');
  };

  const signIn = async () => {
    if (!supabase) return notify('Supabase не подключен');
    if (!email.trim()) return notify('Введи email');
    if (password.length < 6) return notify('Пароль минимум 6 символов');
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    notify(error ? `Ошибка входа: ${error.message}` : 'Вход выполнен');
  };

  const signOut = async () => {
    if (supabase) await supabase.auth.signOut();
    setUser(null);
    setCloudReady(false);
    notify('Выход выполнен');
  };

  const today = todayISO();
  const todayTasks = data.tasks.filter((t) => t.column === 'today');
  const doing = data.tasks.filter((t) => t.column === 'doing');
  const doneWeek = data.tasks.filter((t) => data.sprint.taskIds.includes(t.id) && t.done).length;
  const weekPct = pct(doneWeek, data.sprint.taskIds.length);
  const todayMetrics = { ...emptyMetrics(), ...(data.sprint.dailyMetrics[today] || {}) };
  const streak = calcStreak(data);
  const todayComplete = isDayComplete(todayMetrics, data.dailyMinimum);
  const todayMinimumCount = completedMinimumCount(todayMetrics, data.dailyMinimum);
  const weekDays = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const d = new Date(data.sprint.startDate);
        d.setDate(d.getDate() + i);
        return d.toISOString().slice(0, 10);
      }),
    [data.sprint.startDate],
  );

  const addTask = (title: string, column: KanbanColumn = 'ideas', description = '') =>
    update((d) => {
      if (column === 'doing' && d.tasks.filter((t) => t.column === 'doing').length >= 3) {
        notify('Сначала заверши или убери одну задачу. СДВГ не любит перегруз.');
        return d;
      }
      const task: Task = { id: uid(), title, description, column, done: false, createdAt: todayISO() };
      d.tasks.unshift(task);
      d.sprint.taskIds.push(task.id);
      return d;
    }, 'Задача добавлена');

  const moveTask = (id: string, column: KanbanColumn) =>
    update((d) => {
      if (column === 'doing' && d.tasks.filter((t) => t.column === 'doing' && t.id !== id).length >= 3) {
        notify('Сначала заверши или убери одну задачу. СДВГ не любит перегруз.');
        return d;
      }
      const task = d.tasks.find((x) => x.id === id);
      if (task) task.column = column;
      return d;
    }, 'Задача перенесена');

  const editMainGoal = () => {
    const value = prompt('Главная цель на 4 недели', data.mainGoal);
    if (!value?.trim()) return;
    update((d) => {
      d.mainGoal = value.trim();
      return d;
    }, 'Главная цель обновлена');
  };

  const editSprint = () => {
    const title = prompt('Название недельного спринта', data.sprint.title);
    if (title === null) return;
    const goal = prompt('Цель спринта на эту неделю', data.sprint.goal);
    if (goal === null) return;
    update((d) => {
      d.sprint.title = title.trim() || d.sprint.title;
      d.sprint.goal = goal.trim();
      return d;
    }, 'Спринт обновлён');
  };

  return (
    <main className="min-h-screen bg-base p-4 md:p-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[.35em] text-accent">ADHD Focus OS</p>
            <h1 className="mt-2 text-4xl font-black md:text-6xl">План без шума</h1>
          </div>
          <div className="flex flex-col gap-3 md:w-[360px]">
            <AuthPanel email={email} setEmail={setEmail} password={password} setPassword={setPassword} user={user} cloudReady={cloudReady} signIn={signIn} signOut={signOut} />
            <Button onClick={resetData} className="bg-white/10 hover:bg-white/20">Сброс данных</Button>
          </div>
        </header>

        <nav className="mb-6 flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
          {[
            ['dashboard', 'Дашборд'],
            ['inbox', 'Инбокс'],
            ['kanban', 'Kanban'],
            ['sprint', 'Спринт'],
            ['review', 'Ревью'],
          ].map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)} className={`whitespace-nowrap rounded-2xl px-4 py-3 font-bold ${tab === id ? 'bg-accent' : 'bg-card text-muted'}`}>{label}</button>
          ))}
        </nav>

        {toast && <div className="fixed right-4 top-4 z-50 max-w-xl rounded-2xl bg-accent px-5 py-3 font-bold shadow-xl">{toast}</div>}

        {tab === 'dashboard' && <Dashboard data={data} update={update} todayTasks={todayTasks} doing={doing} todayMetrics={todayMetrics} weekPct={weekPct} setTab={setTab} addTask={addTask} editMainGoal={editMainGoal} editSprint={editSprint} streak={streak} todayComplete={todayComplete} todayMinimumCount={todayMinimumCount} />}
        {tab === 'inbox' && <Inbox data={data} update={update} />}
        {tab === 'kanban' && <Kanban data={data} update={update} moveTask={moveTask} addTask={addTask} />}
        {tab === 'sprint' && <Sprint data={data} update={update} weekDays={weekDays} />}
        {tab === 'review' && <ReviewView data={data} update={update} weekPct={weekPct} />}
      </div>
    </main>
  );
}

function AuthPanel({ email, setEmail, password, setPassword, user, cloudReady, signIn, signOut }: { email: string; setEmail: (v: string) => void; password: string; setPassword: (v: string) => void; user: User | null; cloudReady: boolean; signIn: () => void; signOut: () => void }) {
  if (!hasSupabaseConfig) return <Card><p className="text-sm text-muted">Облако не подключено. Работает только это устройство.</p></Card>;
  if (user) return <Card><p className="text-sm text-muted">Облако: {cloudReady ? 'синхронизировано' : 'загрузка...'}</p><p className="mt-1 truncate font-bold">{user.email}</p><Button onClick={signOut} className="mt-3 w-full bg-white/10 hover:bg-white/20">Выйти</Button></Card>;
  return <Card><p className="text-sm text-muted">Вход для синхронизации</p><div className="mt-3 grid gap-2"><Field type="email" placeholder="email" value={email} onChange={(e) => setEmail(e.target.value)} /><Field type="password" placeholder="пароль" value={password} onChange={(e) => setPassword(e.target.value)} /><Button onClick={signIn}>Войти</Button></div></Card>;
}

function Empty({ text }: { text: string }) {
  return <p className="mt-4 rounded-2xl border border-dashed border-white/10 p-5 text-muted">{text}</p>;
}

function TaskRow({ t, update }: { t: Task; update: UpdateFn }) {
  return (
    <div className="mt-3 rounded-2xl bg-black/20 p-3">
      <label className="flex items-center gap-3">
        <input type="checkbox" checked={t.done} onChange={() => update((d) => { const x = d.tasks.find((a) => a.id === t.id); if (x) { x.done = !x.done; if (x.done) x.column = 'done'; } return d; }, 'Сохранено')} />
        <span className={t.done ? 'text-muted line-through' : ''}>{t.title}</span>
      </label>
    </div>
  );
}

function Dashboard({ data, update, todayTasks, doing, todayMetrics, weekPct, setTab, addTask, editMainGoal, editSprint, streak, todayComplete, todayMinimumCount }: { data: AppData; update: UpdateFn; todayTasks: Task[]; doing: Task[]; todayMetrics: Metrics; weekPct: number; setTab: (tab: string) => void; addTask: (title: string, column: KanbanColumn) => void; editMainGoal: () => void; editSprint: () => void; streak: number; todayComplete: boolean; todayMinimumCount: number }) {
  const today = todayISO();
  const dopaminePoints = minimumKeys.reduce((sum, k) => sum + Math.min(100, Math.round(((todayMetrics[k] ?? 0) / Math.max(1, data.dailyMinimum[k])) * 20)), 0);

  return (
    <section className="grid gap-5 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="max-w-3xl"><p className="text-muted">Главная цель на 4 недели</p><h2 className="mt-2 text-3xl font-black">{data.mainGoal}</h2></div>
          <GhostButton onClick={editMainGoal}>Редактировать цель</GhostButton>
        </div>

        <div className="mt-6 rounded-3xl border border-white/5 bg-black/20 p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div><p className="text-sm uppercase tracking-[0.2em] text-muted">Недельный спринт</p><p className="mt-1 text-xl font-black">{data.sprint.title}</p><p className="mt-2 text-sm text-muted">Цель спринта</p><p className="text-base font-medium">{data.sprint.goal || 'Цель спринта пока не задана'}</p><p className="mt-2 text-xs text-muted">{data.sprint.startDate} — {data.sprint.endDate}</p></div>
            <GhostButton onClick={editSprint}>Редактировать спринт</GhostButton>
          </div>
          <div className="mt-5"><div className="mb-2 flex justify-between"><b>{data.sprint.title}</b><b>{weekPct}%</b></div><Progress value={weekPct} /></div>
        </div>
      </Card>

      <Card>
        <p className="text-muted">Рабочая серия</p>
        <div className="mt-2 text-7xl font-black text-accent">{streak}</div>
        <p className="mt-3 font-bold">Сегодня: {todayComplete ? 'минимум выполнен' : 'минимум не выполнен'}</p>
        <p className="mt-1 text-muted">{todayMinimumCount}/5 пунктов закрыто автоматически</p>
        <Progress value={pct(todayMinimumCount, 5)} />
      </Card>

      <Card className="lg:col-span-2">
        <h3 className="text-2xl font-black">Цели и цифры</h3>
        <p className="mt-1 text-muted">Бывший OKR. Теперь просто план / факт.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {data.okr.keyResults.map((kr) => (
            <div key={kr.id} className="rounded-2xl bg-black/20 p-4">
              <div className="flex justify-between gap-3"><b>{kr.title}</b><span className="text-muted">{kr.unit === '₽' ? money(kr.current) : kr.current} / {kr.unit === '₽' ? money(kr.target) : kr.target} {kr.unit}</span></div>
              <div className="mt-3"><Progress value={pct(kr.current, kr.target)} /></div>
              <div className="mt-3 grid grid-cols-2 gap-2"><Field type="number" value={kr.current} onChange={(e) => update((d) => { d.okr.keyResults.find((x) => x.id === kr.id)!.current = +e.target.value; return d; })} /><Field type="number" value={kr.target} onChange={(e) => update((d) => { d.okr.keyResults.find((x) => x.id === kr.id)!.target = +e.target.value; return d; })} /></div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <h3 className="text-2xl font-black">Дофамин</h3>
        <div className="mt-3 text-5xl font-black text-accent">{dopaminePoints}</div>
        <p className="mt-2 text-muted">очков за сегодняшний минимум</p>
        <p className="mt-4 rounded-2xl bg-black/20 p-3 font-bold">{todayComplete ? 'Минимум закрыт. День не слит.' : 'Закрой 5 пунктов — день засчитается сам.'}</p>
      </Card>

      <Card>
        <h3 className="text-2xl font-black">Сегодня</h3>
        {todayTasks.length ? todayTasks.map((t) => <TaskRow key={t.id} t={t} update={update} />) : <Empty text="Нет задач на сегодня" />}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button onClick={() => { const title = prompt('Идея'); if (title) update((d) => { d.ideas.unshift({ id: uid(), title, description: '', createdAt: today, category: 'другое', status: 'новая', qMoney: null, qGoal: null, qStart: null }); return d; }, 'Идея добавлена'); }}>Добавить идею</Button>
          <Button onClick={() => { const title = prompt('Задача'); if (title) addTask(title, 'today'); }}>Добавить задачу</Button>
        </div>
      </Card>

      <Card><h3 className="text-2xl font-black">В работе 1–3</h3>{doing.length ? doing.map((t) => <TaskRow key={t.id} t={t} update={update} />) : <Empty text="Фокус пуст. Выбери одну задачу." />}</Card>

      <Card>
        <h3 className="text-2xl font-black">Минимум сегодня</h3>
        {minimumKeys.map((k) => <p key={k} className="mt-3 flex justify-between border-b border-white/5 pb-2"><span className="text-muted">{metricLabels[k]}</span><b>{todayMetrics[k]} / {data.dailyMinimum[k]}</b></p>)}
      </Card>

      <Card><h3 className="text-2xl font-black">Быстрые действия</h3><Button onClick={() => setTab('sprint')} className="mt-4 w-full">Заполнить факт дня</Button><Button onClick={() => setTab('review')} className="mt-3 w-full bg-white/10 hover:bg-white/20">Завершить спринт</Button></Card>
    </section>
  );
}

function Inbox({ data, update }: { data: AppData; update: UpdateFn }) {
  const [title, setTitle] = useState('');
  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <Card><h2 className="text-3xl font-black">Новая идея</h2><Field placeholder="Название" value={title} onChange={(e) => setTitle(e.target.value)} /><Button className="mt-3 w-full" onClick={() => { if (!title) return; update((d) => { d.ideas.unshift({ id: uid(), title, description: '', createdAt: todayISO(), category: 'другое', status: 'новая', qMoney: null, qGoal: null, qStart: null }); return d; }, 'Идея в инбоксе'); setTitle(''); }}>Записать</Button></Card>
      <div className="grid gap-4 lg:col-span-2">{data.ideas.map((i) => <IdeaCard key={i.id} idea={i} update={update} />)}</div>
    </div>
  );
}

function IdeaCard({ idea, update }: { idea: Idea; update: UpdateFn }) {
  const yes = [idea.qMoney, idea.qGoal, idea.qStart].filter(Boolean).length;
  const answered = [idea.qMoney, idea.qGoal, idea.qStart].every((v) => v !== null);
  const rec = yes >= 2 ? 'делать сейчас' : answered ? 'отложить' : 'оценить';
  const sendToKanban = (d: AppData, id: string) => {
    const selected = d.ideas.find((x) => x.id === id);
    if (!selected) return;
    selected.status = 'выбрана';
    if (!d.tasks.some((t) => t.description === `idea:${id}`)) {
      const task: Task = { id: uid(), title: selected.title, description: `idea:${id}`, column: 'week', done: false, createdAt: todayISO() };
      d.tasks.unshift(task);
      d.sprint.taskIds.push(task.id);
    }
  };

  return (
    <Card>
      <div className="flex flex-col gap-3 md:flex-row md:justify-between"><div><h3 className="text-2xl font-black">{idea.title}</h3><p className="text-muted">{idea.createdAt} · {idea.category} · {idea.status}</p></div><b className="text-accent">{rec}</b></div>
      <div className="mt-4 grid gap-2 md:grid-cols-3">
        {([
          ['qMoney', 'деньги за 14 дней?'],
          ['qGoal', 'вяжется с целью?'],
          ['qStart', 'без подготовки?'],
        ] as const).map(([k, label]) => <label key={k} className="rounded-2xl bg-black/20 p-3"><span className="block text-muted">{label}</span><select value={String(idea[k])} onChange={(e) => update((d) => { const x = d.ideas.find((a) => a.id === idea.id)!; (x as any)[k] = e.target.value === 'null' ? null : e.target.value === 'true'; return d; }, 'Оценка сохранена')} className="mt-2 w-full bg-transparent"><option value="null">—</option><option value="true">да</option><option value="false">нет</option></select></label>)}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <select value={idea.status} onChange={(e) => update((d) => { const status = e.target.value as IdeaStatus; d.ideas.find((x) => x.id === idea.id)!.status = status; if (status === 'выбрана') sendToKanban(d, idea.id); return d; }, status === 'выбрана' ? 'Идея ушла в Kanban' : 'Статус изменён')} className="rounded-2xl bg-black/30 p-3">{statuses.map((s) => <option key={s}>{s}</option>)}</select>
        <select value={idea.category} onChange={(e) => update((d) => { d.ideas.find((x) => x.id === idea.id)!.category = e.target.value as IdeaCategory; return d; }, 'Категория изменена')} className="rounded-2xl bg-black/30 p-3">{cats.map((c) => <option key={c}>{c}</option>)}</select>
        <GhostButton onClick={() => update((d) => { sendToKanban(d, idea.id); return d; }, 'Идея ушла в Kanban')}>В работу → Kanban</GhostButton>
      </div>
    </Card>
  );
}

function Kanban({ data, update, moveTask, addTask }: { data: AppData; update: UpdateFn; moveTask: (id: string, c: KanbanColumn) => void; addTask: (title: string, c: KanbanColumn) => void }) {
  return (
    <div className="grid gap-4 xl:grid-cols-5">
      {(Object.keys(columns) as KanbanColumn[]).map((c) => <Card key={c} className="min-h-80"><div className="mb-4 flex items-center justify-between"><h2 className="text-xl font-black">{columns[c]}</h2><button onClick={() => { const title = prompt('Новая задача'); if (title) addTask(title, c); }} className="rounded-xl bg-white/10 px-3 py-1">+</button></div>{data.tasks.filter((t) => t.column === c).map((t) => <div key={t.id} className="mb-3 rounded-2xl bg-black/25 p-3"><Field value={t.title} onChange={(e) => update((d) => { d.tasks.find((x) => x.id === t.id)!.title = e.target.value; return d; })} /><div className="mt-2 flex gap-2"><select value={t.column} onChange={(e) => moveTask(t.id, e.target.value as KanbanColumn)} className="w-full rounded-xl bg-card p-2">{Object.entries(columns).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select><button onClick={() => update((d) => { d.tasks = d.tasks.filter((x) => x.id !== t.id); d.sprint.taskIds = d.sprint.taskIds.filter((taskId) => taskId !== t.id); return d; }, 'Удалено')} className="rounded-xl bg-bad/20 px-3">×</button></div></div>)}{!data.tasks.some((t) => t.column === c) && <Empty text="Пусто" />}</Card>)}
    </div>
  );
}

function Sprint({ data, update, weekDays }: { data: AppData; update: UpdateFn; weekDays: string[] }) {
  const today = todayISO();
  const metrics = { ...emptyMetrics(), ...(data.sprint.dailyMetrics[today] || {}) };
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card><h2 className="text-3xl font-black">{data.sprint.title}</h2><p className="mt-2 text-muted">{data.sprint.startDate} — {data.sprint.endDate}</p><label className="mt-4 block text-sm text-muted">Название спринта</label><Field value={data.sprint.title} onChange={(e) => update((d) => { d.sprint.title = e.target.value; return d; })} /><label className="mt-4 block text-sm text-muted">Цель спринта на неделю</label><Field value={data.sprint.goal} onChange={(e) => update((d) => { d.sprint.goal = e.target.value; return d; })} /><h3 className="mt-6 text-2xl font-black">Минимум дня</h3><div className="mt-3 grid gap-2 md:grid-cols-2">{minimumKeys.map((k) => <label key={k} className="text-muted">{metricLabels[k]}<Field type="number" value={data.dailyMinimum[k]} onChange={(e) => update((d) => { d.dailyMinimum[k] = +e.target.value; syncDayMark(d, today); return d; })} /></label>)}</div></Card>
      <Card><h3 className="text-2xl font-black">Календарь недели</h3><p className="mt-1 text-muted">Дни отмечаются автоматически по минимуму.</p><div className="mt-4 grid grid-cols-7 gap-2">{weekDays.map((day) => { const dayMetrics = { ...emptyMetrics(), ...(data.sprint.dailyMetrics[day] || {}) }; const complete = isDayComplete(dayMetrics, data.dailyMinimum); return <div key={day} className="rounded-2xl bg-black/25 p-3 text-center"><span className="block text-xs text-muted">{day.slice(5)}</span><b className={`text-2xl ${complete ? 'text-good' : 'text-muted'}`}>{complete ? '✓' : '—'}</b></div>; })}</div></Card>
      <Card className="lg:col-span-2"><h3 className="text-2xl font-black">Факт за сегодня</h3><p className="mt-1 text-muted">Заполни 5 обязательных пунктов — день засчитается сам.</p><div className="mt-3 grid gap-3 md:grid-cols-3">{factsKeys.map((k) => <label key={k} className="text-muted">{metricLabels[k]}<Field type="number" value={metrics[k]} onChange={(e) => update((d) => { d.sprint.dailyMetrics[today] ||= emptyMetrics(); d.sprint.dailyMetrics[today] = { ...emptyMetrics(), ...d.sprint.dailyMetrics[today], [k]: +e.target.value }; syncDayMark(d, today); return d; })} /></label>)}</div></Card>
    </div>
  );
}

function ReviewView({ data, update, weekPct }: { data: AppData; update: UpdateFn; weekPct: number }) {
  const r = data.sprint.review || { worked: '', failed: '', money: '', trash: '', next: '', remove: '' };
  const set = (k: keyof Review, v: string) => update((d) => { d.sprint.review ||= { worked: '', failed: '', money: '', trash: '', next: '', remove: '' }; d.sprint.review[k] = v; return d; });
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card><h2 className="text-3xl font-black">Еженедельное ревью</h2>{([['worked', 'что сработало?'], ['failed', 'что не сработало?'], ['money', 'что принесло деньги или ответы?'], ['trash', 'что было мусором?'], ['next', 'что беру в следующий спринт?'], ['remove', 'что убираю?']] as const).map(([k, label]) => <label key={k} className="mt-4 block text-muted">{label}<Area value={r[k]} onChange={(e) => set(k, e.target.value)} /></label>)}</Card>
      <Card><h2 className="text-3xl font-black">Итог недели</h2><div className="mt-4 text-6xl font-black text-accent">{weekPct}%</div><Progress value={weekPct} /><p className="mt-5"><b>Лучшие действия:</b> {r.worked || 'заполни ревью'}</p><p className="mt-3"><b>Слабые места:</b> {r.failed || 'пока не указано'}</p><p className="mt-3 text-muted">Рекомендация: оставь только действия, которые дали ответы, деньги или движение. Остальное — в мусор или отложенные.</p><Button className="mt-6 w-full" onClick={() => update((d) => d, 'Спринт завершён')}>Завершить спринт</Button></Card>
    </div>
  );
}
