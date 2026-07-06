'use client';

import { useEffect, useMemo, useState } from 'react';
import { AppData, DayMark, Idea, IdeaCategory, IdeaStatus, KanbanColumn, Metrics, Review, STORAGE_KEY, Task, demoData, emptyMetrics, todayISO } from '@/lib/data';

const columns: Record<KanbanColumn, string> = {
  ideas: 'Идеи',
  week: 'На этой неделе',
  today: 'Сегодня',
  doing: 'В работе',
  done: 'Готово',
};

const metricLabels: Record<keyof Metrics, string> = {
  touches: 'новые касания',
  followUps: 'follow-up',
  calls: 'звонки',
  content: 'контент',
  money: 'деньги',
  leads: 'лиды',
  meetings: 'встречи',
  activeClients: 'клиенты в работе',
};

const cats: IdeaCategory[] = ['деньги', 'недвижимость', 'контент', 'фото', '3D', 'другое'];
const statuses: IdeaStatus[] = ['новая', 'отложена', 'выбрана', 'закрыта'];
const uid = () => crypto.randomUUID();
const pct = (a: number, b: number) => Math.min(100, Math.round((a / Math.max(1, b)) * 100));

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-[28px] border border-white/5 bg-card p-5 shadow-2xl shadow-black/20 ${className}`}>{children}</section>;
}

function Button({ children, onClick, type = 'button', className = '', disabled = false }: { children: React.ReactNode; onClick?: () => void; type?: 'button' | 'submit'; className?: string; disabled?: boolean }) {
  return <button disabled={disabled} type={type} onClick={onClick} className={`rounded-2xl px-4 py-3 font-semibold transition ${disabled ? 'cursor-not-allowed bg-white/5 text-muted' : 'bg-accent text-white hover:scale-[1.02] hover:bg-orange-500'} ${className}`}>{children}</button>;
}

function Field(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-white placeholder:text-muted ${props.className || ''}`} />;
}

function Area(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className="min-h-24 w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-white placeholder:text-muted" />;
}

function Progress({ value }: { value: number }) {
  return <div className="h-3 rounded-full bg-white/10"><div className="h-3 rounded-full bg-good" style={{ width: `${value}%` }} /></div>;
}

export default function Home() {
  const [data, setData] = useState<AppData>(demoData());
  const [tab, setTab] = useState('dashboard');
  const [toast, setToast] = useState('');
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) setData(JSON.parse(raw));
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data, hydrated]);

  const notify = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(''), 2400);
  };

  const update = (fn: (d: AppData) => AppData, msg?: string) => setData(d => {
    const next = fn(structuredClone(d));
    if (msg) setTimeout(() => notify(msg), 0);
    return next;
  });

  const resetData = () => {
    const fresh = demoData();
    localStorage.removeItem(STORAGE_KEY);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
    setData(fresh);
    setTab('dashboard');
    notify('Демо-данные сброшены');
  };

  const today = todayISO();
  const todayTasks = data.tasks.filter(t => t.column === 'today');
  const doing = data.tasks.filter(t => t.column === 'doing');
  const doneWeek = data.tasks.filter(t => data.sprint.taskIds.includes(t.id) && t.done).length;
  const weekPct = pct(doneWeek, data.sprint.taskIds.length);
  const todayMetrics = data.sprint.dailyMetrics[today] || emptyMetrics();
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const d = new Date(data.sprint.startDate);
    d.setDate(d.getDate() + i);
    return d.toISOString().slice(0, 10);
  }), [data.sprint.startDate]);

  const addTask = (title: string, column: KanbanColumn = 'ideas') => update(d => {
    if (column === 'doing' && d.tasks.filter(t => t.column === 'doing').length >= 3) {
      notify('Сначала заверши или убери одну задачу. СДВГ не любит перегруз.');
      return d;
    }
    const task: Task = { id: uid(), title, description: '', column, done: false, createdAt: todayISO() };
    d.tasks.unshift(task);
    d.sprint.taskIds.push(task.id);
    return d;
  }, 'Задача добавлена');

  const moveTask = (id: string, column: KanbanColumn) => update(d => {
    if (column === 'doing' && d.tasks.filter(t => t.column === 'doing' && t.id !== id).length >= 3) {
      notify('Сначала заверши или убери одну задачу. СДВГ не любит перегруз.');
      return d;
    }
    const t = d.tasks.find(x => x.id === id);
    if (t) t.column = column;
    return d;
  }, 'Задача перенесена');

  return <main className="min-h-screen bg-base p-4 md:p-8">
    <div className="mx-auto max-w-7xl">
      <header className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-bold uppercase tracking-[.35em] text-accent">ADHD Focus OS</p>
          <h1 className="mt-2 text-4xl font-black md:text-6xl">План без шума</h1>
        </div>
        <Button onClick={resetData} className="bg-white/10 hover:bg-white/20">Сброс демо-данных</Button>
      </header>

      <nav className="mb-6 flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
        {[['dashboard', 'Дашборд'], ['inbox', 'Инбокс'], ['kanban', 'Kanban'], ['sprint', 'Спринт'], ['okr', 'OKR'], ['review', 'Ревью']].map(([id, label]) =>
          <button key={id} onClick={() => setTab(id)} className={`whitespace-nowrap rounded-2xl px-4 py-3 font-bold ${tab === id ? 'bg-accent' : 'bg-card text-muted'}`}>{label}</button>
        )}
      </nav>

      {toast && <div className="fixed right-4 top-4 z-50 rounded-2xl bg-accent px-5 py-3 font-bold shadow-xl">{toast}</div>}

      {tab === 'dashboard' && <Dashboard data={data} update={update} todayTasks={todayTasks} doing={doing} todayMetrics={todayMetrics} weekPct={weekPct} setTab={setTab} addTask={addTask} />}
      {tab === 'inbox' && <Inbox data={data} update={update} />}
      {tab === 'kanban' && <Kanban data={data} update={update} moveTask={moveTask} addTask={addTask} />}
      {tab === 'sprint' && <Sprint data={data} update={update} weekDays={weekDays} />}
      {tab === 'okr' && <OKRView data={data} update={update} />}
      {tab === 'review' && <ReviewView data={data} update={update} weekPct={weekPct} />}
    </div>
  </main>;
}

function Empty({ text }: { text: string }) {
  return <p className="mt-4 rounded-2xl border border-dashed border-white/10 p-5 text-muted">{text}</p>;
}

function TaskRow({ t, update }: { t: Task; update: (fn: (d: AppData) => AppData, msg?: string) => void }) {
  return <div className="mt-3 rounded-2xl bg-black/20 p-3">
    <label className="flex items-center gap-3">
      <input type="checkbox" checked={t.done} onChange={() => update(d => {
        const x = d.tasks.find(a => a.id === t.id);
        if (x) {
          x.done = !x.done;
          if (x.done) x.column = 'done';
        }
        return d;
      }, 'Сохранено')} />
      <span className={t.done ? 'text-muted line-through' : ''}>{t.title}</span>
    </label>
  </div>;
}

function Dashboard({ data, update, todayTasks, doing, todayMetrics, weekPct, setTab, addTask }: { data: AppData; update: (fn: (d: AppData) => AppData, msg?: string) => void; todayTasks: Task[]; doing: Task[]; todayMetrics: Metrics; weekPct: number; setTab: (tab: string) => void; addTask: (title: string, column: KanbanColumn) => void }) {
  const today = todayISO();
  return <section className="grid gap-5 lg:grid-cols-3">
    <Card className="lg:col-span-2"><p className="text-muted">Главная цель на 4 недели</p><h2 className="mt-2 text-3xl font-black">{data.mainGoal}</h2><div className="mt-6"><div className="mb-2 flex justify-between"><b>{data.sprint.title}</b><b>{weekPct}%</b></div><Progress value={weekPct} /></div></Card>
    <Card><p className="text-muted">Дней не слито</p><div className="mt-2 text-7xl font-black text-accent">{data.noWasteDays}</div><Button onClick={() => update(d => { d.noWasteDays++; d.sprint.dayMarks[today] = Math.max(d.sprint.dayMarks[today] || 0, 1) as DayMark; return d; }, 'День отмечен')} className="mt-4 w-full">Отметить день</Button></Card>
    <Card><h3 className="text-2xl font-black">Сегодня</h3>{todayTasks.length ? todayTasks.map(t => <TaskRow key={t.id} t={t} update={update} />) : <Empty text="Нет задач на сегодня" />}<div className="mt-4 grid grid-cols-2 gap-2"><Button onClick={() => { const title = prompt('Идея'); if (title) update(d => { d.ideas.unshift({ id: uid(), title, description: '', createdAt: today, category: 'другое', status: 'новая', qMoney: null, qGoal: null, qStart: null }); return d; }, 'Идея добавлена'); }}>Добавить идею</Button><Button onClick={() => { const title = prompt('Задача'); if (title) addTask(title, 'today'); }}>Добавить задачу</Button></div></Card>
    <Card><h3 className="text-2xl font-black">В работе 1–3</h3>{doing.length ? doing.map(t => <TaskRow key={t.id} t={t} update={update} />) : <Empty text="Фокус пуст. Выбери одну задачу." />}</Card>
    <Card><h3 className="text-2xl font-black">Ключевые метрики сегодня</h3>{(['touches', 'followUps', 'content', 'leads'] as (keyof Metrics)[]).map(k => <p key={k} className="mt-3 flex justify-between border-b border-white/5 pb-2"><span className="text-muted">{metricLabels[k]}</span><b>{todayMetrics[k]}</b></p>)}</Card>
    <Card><h3 className="text-2xl font-black">Быстрые действия</h3><Button onClick={() => setTab('review')} className="mt-4 w-full">Завершить спринт</Button></Card>
  </section>;
}

function Inbox({ data, update }: { data: AppData; update: (fn: (d: AppData) => AppData, msg?: string) => void }) {
  const [title, setTitle] = useState('');
  return <div className="grid gap-5 lg:grid-cols-3"><Card><h2 className="text-3xl font-black">Новая идея</h2><Field placeholder="Название" value={title} onChange={e => setTitle(e.target.value)} /><Button className="mt-3 w-full" onClick={() => { if (title) { update(d => { d.ideas.unshift({ id: uid(), title, description: '', createdAt: todayISO(), category: 'другое', status: 'новая', qMoney: null, qGoal: null, qStart: null }); return d; }, 'Идея в инбоксе'); setTitle(''); } }}>Записать</Button></Card><div className="grid gap-4 lg:col-span-2">{data.ideas.map(i => <IdeaCard key={i.id} idea={i} update={update} />)}</div></div>;
}

function IdeaCard({ idea, update }: { idea: Idea; update: (fn: (d: AppData) => AppData, msg?: string) => void }) {
  const yes = [idea.qMoney, idea.qGoal, idea.qStart].filter(Boolean).length;
  const rec = yes >= 2 ? 'делать сейчас' : yes < 2 && [idea.qMoney, idea.qGoal, idea.qStart].every(v => v !== null) ? 'отложить' : 'оценить';
  return <Card><div className="flex flex-col gap-3 md:flex-row md:justify-between"><div><h3 className="text-2xl font-black">{idea.title}</h3><p className="text-muted">{idea.createdAt} · {idea.category} · {idea.status}</p></div><b className="text-accent">{rec}</b></div><div className="mt-4 grid gap-2 md:grid-cols-3">{[['qMoney', 'деньги за 14 дней?'], ['qGoal', 'вяжется с целью?'], ['qStart', 'без подготовки?']].map(([k, l]) => <label key={k} className="rounded-2xl bg-black/20 p-3"><span className="block text-muted">{l}</span><select value={String((idea as any)[k])} onChange={e => update(d => { (d.ideas.find(x => x.id === idea.id) as any)[k] = e.target.value === 'null' ? null : e.target.value === 'true'; return d; }, 'Оценка сохранена')} className="mt-2 w-full bg-transparent"><option value="null">—</option><option value="true">да</option><option value="false">нет</option></select></label>)}</div><div className="mt-3 flex gap-2"><select value={idea.status} onChange={e => update(d => { d.ideas.find(x => x.id === idea.id)!.status = e.target.value as IdeaStatus; return d; }, 'Статус изменён')} className="rounded-2xl bg-black/30 p-3">{statuses.map(s => <option key={s}>{s}</option>)}</select><select value={idea.category} onChange={e => update(d => { d.ideas.find(x => x.id === idea.id)!.category = e.target.value as IdeaCategory; return d; }, 'Категория изменена')} className="rounded-2xl bg-black/30 p-3">{cats.map(c => <option key={c}>{c}</option>)}</select></div></Card>;
}

function Kanban({ data, update, moveTask, addTask }: { data: AppData; update: (fn: (d: AppData) => AppData, msg?: string) => void; moveTask: (id: string, c: KanbanColumn) => void; addTask: (title: string, c: KanbanColumn) => void }) {
  return <div className="grid gap-4 xl:grid-cols-5">{(Object.keys(columns) as KanbanColumn[]).map(c => <Card key={c} className="min-h-80"><div className="mb-4 flex items-center justify-between"><h2 className="text-xl font-black">{columns[c]}</h2><button onClick={() => { const title = prompt('Новая задача'); if (title) addTask(title, c); }} className="rounded-xl bg-white/10 px-3 py-1">+</button></div>{data.tasks.filter(t => t.column === c).map(t => <div key={t.id} className="mb-3 rounded-2xl bg-black/25 p-3"><Field value={t.title} onChange={e => update(d => { d.tasks.find(x => x.id === t.id)!.title = e.target.value; return d; })} /><div className="mt-2 flex gap-2"><select value={t.column} onChange={e => moveTask(t.id, e.target.value as KanbanColumn)} className="w-full rounded-xl bg-card p-2">{Object.entries(columns).map(([id, l]) => <option key={id} value={id}>{l}</option>)}</select><button onClick={() => update(d => { d.tasks = d.tasks.filter(x => x.id !== t.id); return d; }, 'Удалено')} className="rounded-xl bg-bad/20 px-3">×</button></div></div>)}{!data.tasks.some(t => t.column === c) && <Empty text="Пусто" />}</Card>)}</div>;
}

function Sprint({ data, update, weekDays }: { data: AppData; update: (fn: (d: AppData) => AppData, msg?: string) => void; weekDays: string[] }) {
  const today = todayISO();
  const metrics = data.sprint.dailyMetrics[today] || emptyMetrics();
  return <div className="grid gap-5 lg:grid-cols-2"><Card><h2 className="text-3xl font-black">{data.sprint.title}</h2><p className="mt-2 text-muted">{data.sprint.startDate} — {data.sprint.endDate}</p><Field className="mt-4" value={data.sprint.goal} onChange={e => update(d => { d.sprint.goal = e.target.value; return d; })} /><h3 className="mt-6 text-2xl font-black">Минимум дня</h3><div className="mt-3 grid grid-cols-3 gap-2">{(['touches', 'followUps', 'content'] as const).map(k => <label key={k} className="text-muted">{metricLabels[k]}<Field type="number" value={data.dailyMinimum[k]} onChange={e => update(d => { d.dailyMinimum[k] = +e.target.value; return d; })} /></label>)}</div></Card><Card><h3 className="text-2xl font-black">Календарь недели</h3><div className="mt-4 grid grid-cols-7 gap-2">{weekDays.map(day => <button key={day} onClick={() => update(d => { d.sprint.dayMarks[day] = (((d.sprint.dayMarks[day] || 0) + 1) % 4) as DayMark; return d; }, 'День обновлён')} className="rounded-2xl bg-black/25 p-3"><span className="block text-xs text-muted">{day.slice(5)}</span><b className="text-2xl text-accent">{data.sprint.dayMarks[day] ?? 0}</b></button>)}</div></Card><Card className="lg:col-span-2"><h3 className="text-2xl font-black">Факт за сегодня</h3><div className="mt-3 grid gap-3 md:grid-cols-4">{(Object.keys(metricLabels) as (keyof Metrics)[]).map(k => <label key={k} className="text-muted">{metricLabels[k]}<Field type="number" value={metrics[k]} onChange={e => update(d => { d.sprint.dailyMetrics[today] ||= emptyMetrics(); d.sprint.dailyMetrics[today][k] = +e.target.value; return d; })} /></label>)}</div></Card></div>;
}

function OKRView({ data, update }: { data: AppData; update: (fn: (d: AppData) => AppData, msg?: string) => void }) {
  return <div className="grid gap-5"><Card><p className="text-muted">Objective</p><Field value={data.okr.objective} onChange={e => update(d => { d.okr.objective = e.target.value; return d; })} /></Card>{data.okr.keyResults.map(kr => <Card key={kr.id}><div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><b className="text-xl">{kr.title}</b><span className="text-muted">{kr.current} / {kr.target} {kr.unit}</span></div><div className="mt-3"><Progress value={pct(kr.current, kr.target)} /></div><div className="mt-3 grid grid-cols-2 gap-2"><Field type="number" value={kr.current} onChange={e => update(d => { d.okr.keyResults.find(x => x.id === kr.id)!.current = +e.target.value; return d; })} /><Field type="number" value={kr.target} onChange={e => update(d => { d.okr.keyResults.find(x => x.id === kr.id)!.target = +e.target.value; return d; })} /></div></Card>)}</div>;
}

function ReviewView({ data, update, weekPct }: { data: AppData; update: (fn: (d: AppData) => AppData, msg?: string) => void; weekPct: number }) {
  const r = data.sprint.review || { worked: '', failed: '', money: '', trash: '', next: '', remove: '' };
  const set = (k: keyof Review, v: string) => update(d => { d.sprint.review ||= { worked: '', failed: '', money: '', trash: '', next: '', remove: '' }; d.sprint.review[k] = v; return d; });
  return <div className="grid gap-5 lg:grid-cols-2"><Card><h2 className="text-3xl font-black">Еженедельное ревью</h2>{[['worked', 'что сработало?'], ['failed', 'что не сработало?'], ['money', 'что принесло деньги или ответы?'], ['trash', 'что было мусором?'], ['next', 'что беру в следующий спринт?'], ['remove', 'что убираю?']].map(([k, l]) => <label key={k} className="mt-4 block text-muted">{l}<Area value={(r as any)[k]} onChange={e => set(k as keyof Review, e.target.value)} /></label>)}</Card><Card><h2 className="text-3xl font-black">Итог недели</h2><div className="mt-4 text-6xl font-black text-accent">{weekPct}%</div><Progress value={weekPct} /><p className="mt-5"><b>Лучшие действия:</b> {r.worked || 'заполни ревью'}</p><p className="mt-3"><b>Слабые места:</b> {r.failed || 'пока не указано'}</p><p className="mt-3 text-muted">Рекомендация: оставь только действия, которые дали ответы, деньги или движение. Остальное — в мусор или отложенные.</p><Button className="mt-6 w-full" onClick={() => update(d => { d.noWasteDays = 0; return d; }, 'Спринт завершён')}>Завершить спринт</Button></Card></div>;
}
