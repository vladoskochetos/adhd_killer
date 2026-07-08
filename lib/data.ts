export type IdeaCategory = 'деньги' | 'недвижимость' | 'контент' | 'фото' | '3D' | 'другое';
export type IdeaStatus = 'новая' | 'отложена' | 'выбрана' | 'закрыта';
export type KanbanColumn = 'ideas' | 'week' | 'today' | 'doing' | 'done';
export type DayMark = 0 | 1 | 2 | 3;

export type Metrics = {
  calls: number;
  messages: number;
  followUps: number;
  scripts: number;
  content: number;
  touches: number;
  money: number;
  leads: number;
  meetings: number;
  activeClients: number;
};

export type Idea = {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  category: IdeaCategory;
  status: IdeaStatus;
  qMoney: boolean | null;
  qGoal: boolean | null;
  qStart: boolean | null;
};

export type Task = {
  id: string;
  title: string;
  description: string;
  column: KanbanColumn;
  done: boolean;
  createdAt: string;
};

export type Sprint = {
  id: string;
  title: string;
  goal: string;
  startDate: string;
  endDate: string;
  taskIds: string[];
  dailyMetrics: Record<string, Metrics>;
  dayMarks: Record<string, DayMark>;
  review?: Review;
};

export type DailyMinimum = {
  calls: number;
  messages: number;
  followUps: number;
  scripts: number;
  content: number;
};

export type KeyResult = { id: string; title: string; target: number; current: number; unit: string };
export type OKR = { objective: string; keyResults: KeyResult[] };
export type Review = { worked: string; failed: string; money: string; trash: string; next: string; remove: string };

export type AppData = {
  mainGoal: string;
  noWasteDays: number;
  directions: string[];
  dailyMinimum: DailyMinimum;
  ideas: Idea[];
  tasks: Task[];
  sprint: Sprint;
  okr: OKR;
  notifications: string[];
};

export const todayISO = () => new Date().toISOString().slice(0, 10);

const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x.toISOString().slice(0, 10);
};

export const emptyMetrics = (): Metrics => ({
  calls: 0,
  messages: 0,
  followUps: 0,
  scripts: 0,
  content: 0,
  touches: 0,
  money: 0,
  leads: 0,
  meetings: 0,
  activeClients: 0,
});

export const defaultDailyMinimum = (): DailyMinimum => ({
  calls: 5,
  messages: 10,
  followUps: 5,
  scripts: 1,
  content: 1,
});

export const demoData = (): AppData => {
  const start = todayISO();
  return {
    mainGoal: 'Получить первые деньги через недвижимость и упаковку объявлений.',
    noWasteDays: 0,
    directions: ['Упаковка объявлений', 'Риелторка', 'Контент'],
    dailyMinimum: defaultDailyMinimum(),
    ideas: [],
    tasks: [],
    sprint: {
      id: 's1',
      title: 'Спринт 1: первые касания',
      goal: 'Получить первые ответы и довести 1 клиента до обсуждения оплаты.',
      startDate: start,
      endDate: addDays(new Date(), 6),
      taskIds: [],
      dailyMetrics: {},
      dayMarks: {},
    },
    okr: {
      objective: 'Денежный ориентир и рабочие цифры на 4 недели.',
      keyResults: [
        { id: 'kr1', title: 'Звонки новым клиентам', target: 100, current: 0, unit: 'шт' },
        { id: 'kr2', title: 'Сообщения новым клиентам', target: 200, current: 0, unit: 'шт' },
        { id: 'kr3', title: 'Follow-up', target: 100, current: 0, unit: 'шт' },
        { id: 'kr4', title: 'Единицы контента', target: 30, current: 0, unit: 'шт' },
        { id: 'kr5', title: 'Денежный ориентир', target: 3000000, current: 0, unit: '₽' },
      ],
    },
    notifications: [],
  };
};

export const STORAGE_KEY = 'adhd-killer-planner-v4';
