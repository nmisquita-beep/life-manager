import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { saveToFirebase, loadFromFirebase } from './firebase';

const generateId = () => Math.random().toString(36).substr(2, 9);

const CATEGORIES = {
  WORKOUT: { name: 'Workout', color: '#ef4444', icon: '💪' },
  PROFESSIONAL: { name: 'Professional', color: '#3b82f6', icon: '💼' },
  SELF_CARE: { name: 'Self-care', color: '#a855f7', icon: '🧘' },
  PRODUCTIVITY: { name: 'Productivity', color: '#6b7280', icon: '⚡' },
  SOCIAL: { name: 'Social', color: '#f59e0b', icon: '👥' },
  LEARNING: { name: 'Learning', color: '#10b981', icon: '📚' },
};

const defaultHabits = [
  { id: '1', name: 'Eat clean', type: 'count', target: 3, category: 'SELF_CARE', streak: 0, createdAt: '2020-01-01' },
  { id: '2', name: 'Meditation', type: 'binary', target: 1, category: 'SELF_CARE', streak: 0, createdAt: '2020-01-01' },
  { id: '3', name: 'Get out of the house', type: 'binary', target: 1, category: 'SELF_CARE', streak: 0, createdAt: '2020-01-01' },
  { id: '4', name: 'Personal care', type: 'binary', target: 1, category: 'SELF_CARE', streak: 0, createdAt: '2020-01-01' },
  { id: '5', name: 'Stretching', type: 'binary', target: 1, category: 'WORKOUT', streak: 0, createdAt: '2020-01-01' },
  { id: '6', name: 'Job applications', type: 'count', target: 25, category: 'PROFESSIONAL', streak: 0, createdAt: '2020-01-01' },
  { id: '7', name: 'Workout', type: 'binary', target: 1, category: 'WORKOUT', streak: 0, createdAt: '2020-01-01' },
  { id: '8', name: 'Current events article', type: 'binary', target: 1, category: 'LEARNING', streak: 0, createdAt: '2020-01-01', link: 'https://www.nytimes.com' },
  { id: '9', name: 'Take vitamins', type: 'binary', target: 1, category: 'SELF_CARE', streak: 0, createdAt: '2020-01-01' },
  { id: '10', name: 'Pray', type: 'binary', target: 1, category: 'SELF_CARE', streak: 0, createdAt: '2020-01-01' },
];

const defaultGoals = [
  { id: '1', title: 'Get job offer', metricType: 'milestone', milestones: [{ text: 'Resume updated', completed: false }, { text: '50 applications', completed: false }, { text: '10 interviews', completed: false }] },
  { id: '2', title: 'Consistent fitness routine', metricType: 'milestone', milestones: [{ text: '7 day streak', completed: false }, { text: '14 day streak', completed: false }, { text: '30 day streak', completed: false }] },
];

const loadFromStorage = (key, defaultValue) => {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : defaultValue;
  } catch { return defaultValue; }
};

const saveToStorage = (key, value) => {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { console.error('Storage error:', e); }
};

const getDateKey = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseDateKey = (dateKey) => {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day);
};

const getWeekKey = (date = new Date()) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return getDateKey(d);
};

const getMonthKey = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

const getPeriodKey = (recurring, date = new Date()) => {
  if (recurring === 'daily') return getDateKey(date);
  if (recurring === 'weekly') return getWeekKey(date);
  if (recurring === 'monthly') return getMonthKey(date);
  return null;
};

const calculateDailyScore = (habitLogs, habits, dateKey = null) => {
  const safeHabitLogs = habitLogs || {};
  const applicableHabits = dateKey ? habits.filter(h => !h.createdAt || h.createdAt <= dateKey) : habits;
  let completed = 0;
  let total = applicableHabits.length;
  applicableHabits.forEach(habit => {
    const log = safeHabitLogs[habit.id];
    if (habit.type === 'count') {
      if (log?.completed || (log?.value >= habit.target)) completed += 1;
      else if (log?.value > 0) completed += log.value / habit.target;
    } else { if (log?.completed) completed += 1; }
  });
  return { total: total > 0 ? Math.round((completed / total) * 100) : 0, completed: Math.round(completed * 10) / 10, totalHabits: total };
};

const getScoreColor = (score) => {
  if (!score && score !== 0) return '#3f3f46';
  if (score >= 80) return '#10b981';
  if (score >= 60) return '#8b5cf6';
  if (score >= 40) return '#a855f7';
  if (score >= 20) return '#f97316';
  if (score > 0) return '#ef4444';
  return '#3f3f46';
};

const getScoreTextColor = (score) => {
  if (score >= 80) return '#10b981';
  if (score >= 60) return '#8b5cf6';
  if (score >= 40) return '#a855f7';
  if (score >= 20) return '#f97316';
  if (score > 0) return '#ef4444';
  return '#71717a';
};

// Modal Component
const Modal = ({ isOpen, onClose, title, children, size = 'md' }) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.7)'
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: size === 'lg' ? '32rem' : '28rem',
          maxHeight: '85vh',
          backgroundColor: '#18181b',
          borderTopLeftRadius: '1.25rem',
          borderTopRightRadius: '1.25rem',
          display: 'flex',
          flexDirection: 'column',
          border: '1px solid #27272a',
          borderBottom: 'none',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{
          padding: '1rem 1.25rem',
          borderBottom: '1px solid #27272a',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: '#18181b',
          borderTopLeftRadius: '1.25rem',
          borderTopRightRadius: '1.25rem',
        }}>
          <h2 style={{ fontSize: '1.125rem', fontWeight: 600, margin: 0, color: '#fafafa' }}>{title}</h2>
          <button
            onClick={onClose}
            style={{
              width: '2.75rem',
              height: '2.75rem',
              borderRadius: '0.75rem',
              backgroundColor: '#27272a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.25rem',
              border: 'none',
              color: '#a1a1aa',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >✕</button>
        </div>
        <div
          style={{
            overflowY: 'scroll',
            padding: '1rem 1.25rem',
            paddingBottom: '2rem',
            WebkitOverflowScrolling: 'touch',
            overscrollBehavior: 'contain',
            minHeight: 0,
            flex: '1 1 auto'
          }}
          onTouchMove={e => e.stopPropagation()}
        >
          {children}
        </div>
      </div>
    </div>
  );
};

// Nav Icons
const NavIcons = {
  today: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><circle cx="12" cy="16" r="2" fill="currentColor"/></svg>,
  calendar: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  goals: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2" fill="currentColor"/></svg>,
  ideas: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 0 1 7-7z"/></svg>,
  backup: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
};



export default function LifeManager() {
  const [view, setView] = useState('today');
  const [tasks, setTasks] = useState(() => loadFromStorage('lm_tasks_v11', []));
  const [habits, setHabits] = useState(() => {
    const loaded = loadFromStorage('lm_habits_v11', defaultHabits);
    return loaded.map(h => h.name.toLowerCase().includes('current events') && !h.link ? { ...h, link: 'https://www.nytimes.com' } : h);
  });
  const [goals, setGoals] = useState(() => loadFromStorage('lm_goals_v11', defaultGoals));
  const [dailyLogs, setDailyLogs] = useState(() => loadFromStorage('lm_dailyLogs_v11', {}));
  const [scores, setScores] = useState(() => loadFromStorage('lm_scores_v11', {}));
  const [ideas, setIdeas] = useState(() => loadFromStorage('lm_ideas_v11', []));

  const [showAddTask, setShowAddTask] = useState(false);
  const [showAddHabit, setShowAddHabit] = useState(false);
  const [showEditHabits, setShowEditHabits] = useState(false);
  const [showEditTasks, setShowEditTasks] = useState(false);
  const [showAddIdea, setShowAddIdea] = useState(false);
  const [showAddGoal, setShowAddGoal] = useState(false);
  const [showDataModal, setShowDataModal] = useState(false);
  const [deleteHabitModal, setDeleteHabitModal] = useState(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(null);
  const [newTaskTerm, setNewTaskTerm] = useState('Today');
  const [newTaskRecurring, setNewTaskRecurring] = useState(null);
  const [editingHabit, setEditingHabit] = useState(null);
  const [editingGoal, setEditingGoal] = useState(null);
  const [editingMilestone, setEditingMilestone] = useState(null);
  const [viewingDate, setViewingDate] = useState(new Date());
  const [expandedIdea, setExpandedIdea] = useState(null);
  const [importStatus, setImportStatus] = useState(null);
  const [syncCode, setSyncCode] = useState(() => loadFromStorage('lm_syncCode_v11', ''));
  const [syncCodeInput, setSyncCodeInput] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState(null);
  const [lastSynced, setLastSynced] = useState(() => loadFromStorage('lm_lastSynced_v11', null));
  // Device detection
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  const isAndroid = /Android/i.test(navigator.userAgent);

  const [showHomeScreenPopup, setShowHomeScreenPopup] = useState(() => {
    const hasSeenHomeScreen = loadFromStorage('lm_hasSeenHomeScreen_v11', false);
    const hasSyncCode = loadFromStorage('lm_syncCode_v11', '');
    // Only show on mobile, for first-time users
    return isMobile && !hasSeenHomeScreen && !hasSyncCode;
  });

  const [showWelcomeSync, setShowWelcomeSync] = useState(() => {
    const hasSeenWelcome = loadFromStorage('lm_hasSeenWelcome_v11', false);
    const hasSeenHomeScreen = loadFromStorage('lm_hasSeenHomeScreen_v11', false);
    const hasSyncCode = loadFromStorage('lm_syncCode_v11', '');
    // On mobile, wait until home screen popup is dismissed; on desktop, show immediately
    if (isMobile) {
      return false; // Will be triggered after home screen popup
    }
    return !hasSeenWelcome && !hasSyncCode;
  });
  const [collapsedSections, setCollapsedSections] = useState({ habits: false, tasks: false, sleep: true, fact: true });


  const toggleSection = (section) => setCollapsedSections(prev => ({ ...prev, [section]: !prev[section] }));

  const todayKey = getDateKey();
  const viewingDateKey = getDateKey(viewingDate);
  const viewingLog = dailyLogs[viewingDateKey] || { habitLogs: {}, sleep: {}, screenTime: 0, factLearned: '' };

  const getViewingDateLabel = () => {
    const today = new Date(); const viewing = new Date(viewingDate);
    today.setHours(0, 0, 0, 0); viewing.setHours(0, 0, 0, 0);
    const diffDays = Math.round((viewing - today) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Today';
    if (diffDays === -1) return 'Yesterday';
    if (diffDays === 1) return 'Tomorrow';
    return viewing.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const navigateViewingDate = (days) => setViewingDate(prev => { const d = new Date(prev); d.setDate(d.getDate() + days); return d; });
  const goToToday = () => setViewingDate(new Date());

  // Save to localStorage
  useEffect(() => { saveToStorage('lm_tasks_v11', tasks); }, [tasks]);
  useEffect(() => { saveToStorage('lm_habits_v11', habits); }, [habits]);
  useEffect(() => { saveToStorage('lm_goals_v11', goals); }, [goals]);
  useEffect(() => { saveToStorage('lm_dailyLogs_v11', dailyLogs); }, [dailyLogs]);
  useEffect(() => { saveToStorage('lm_scores_v11', scores); }, [scores]);
  useEffect(() => { saveToStorage('lm_ideas_v11', ideas); }, [ideas]);

  const viewingScore = useMemo(() => calculateDailyScore(viewingLog.habitLogs, habits, viewingDateKey), [viewingLog, habits, viewingDateKey]);

  useEffect(() => {
    if (viewingLog.habitLogs && Object.keys(viewingLog.habitLogs).length > 0) {
      setScores(prev => ({ ...prev, [viewingDateKey]: viewingScore }));
    }
  }, [viewingLog.habitLogs, viewingScore, viewingDateKey]);

  // Task functions
  const addTask = useCallback((task) => {
    if (!task.title?.trim()) return;
    setTasks(prev => [...prev, { ...task, id: generateId(), status: 'pending', createdAt: new Date().toISOString(), recurring: task.recurring || null, completions: {} }]);
    setShowAddTask(false);
    setNewTaskTerm('Today');
    setNewTaskRecurring(null);
  }, []);

  const completeTask = useCallback((id) => {
    setTasks(prev => prev.map(t => {
      if (t.id !== id) return t;
      if (t.recurring) {
        const periodKey = getPeriodKey(t.recurring);
        const isCompleted = t.completions?.[periodKey];
        const newCompletions = { ...t.completions };
        if (isCompleted) delete newCompletions[periodKey];
        else newCompletions[periodKey] = new Date().toISOString();
        return { ...t, completions: newCompletions };
      } else {
        return { ...t, status: t.status === 'done' ? 'pending' : 'done', completedAt: t.status === 'done' ? null : new Date().toISOString() };
      }
    }));
  }, []);

  const isTaskCompleted = useCallback((task) => {
    if (task.recurring) { const periodKey = getPeriodKey(task.recurring); return !!task.completions?.[periodKey]; }
    return task.status === 'done';
  }, []);

  const isTaskCompletedForDate = useCallback((task, dateKey) => {
    if (task.recurring) { const periodKey = getPeriodKey(task.recurring, parseDateKey(dateKey)); return !!task.completions?.[periodKey]; }
    return task.status === 'done';
  }, []);

  // Habit functions
  const toggleHabit = useCallback((habitId, value = null) => {
    setDailyLogs(prev => {
      const log = prev[viewingDateKey] || { habitLogs: {}, sleep: {}, screenTime: 0, factLearned: '' };
      const habit = habits.find(h => h.id === habitId);
      if (!habit) return prev;
      const currentLog = log.habitLogs?.[habitId] || { completed: false, value: 0 };
      let newValue, completed;
      if (habit.type === 'binary') { completed = !currentLog.completed; newValue = completed ? 1 : 0; }
      else { newValue = value !== null ? value : (currentLog.value + 1) % (habit.target + 1); completed = newValue >= habit.target; }
      return { ...prev, [viewingDateKey]: { ...log, habitLogs: { ...log.habitLogs, [habitId]: { completed, value: newValue } } } };
    });
  }, [viewingDateKey, habits]);

  const addHabit = useCallback((habit) => {
    if (!habit.name?.trim()) return;
    setHabits(prev => [...prev, { id: generateId(), name: habit.name.trim(), type: habit.type || 'binary', target: parseInt(habit.target) || 1, category: habit.category || 'PRODUCTIVITY', streak: 0, createdAt: getDateKey() }]);
    setShowAddHabit(false);
  }, []);

  const updateHabit = useCallback((habitId, updates) => setHabits(prev => prev.map(h => h.id === habitId ? { ...h, ...updates } : h)), []);

  const deleteHabit = useCallback((habitId) => {
    setHabits(prev => prev.filter(h => h.id !== habitId));
    setDailyLogs(prev => {
      const updated = { ...prev };
      Object.keys(updated).forEach(key => { if (updated[key]?.habitLogs?.[habitId]) { const { [habitId]: removed, ...rest } = updated[key].habitLogs; updated[key] = { ...updated[key], habitLogs: rest }; } });
      return updated;
    });
    setDeleteHabitModal(null);
    setDeleteConfirmText('');
  }, []);

  const removeHabitFromToday = useCallback((habitId) => {
    setDailyLogs(prev => {
      const todayData = prev[viewingDateKey] || { habitLogs: {} };
      const { [habitId]: removed, ...restLogs } = todayData.habitLogs || {};
      return { ...prev, [viewingDateKey]: { ...todayData, habitLogs: restLogs } };
    });
    setDeleteHabitModal(null);
    setDeleteConfirmText('');
  }, [viewingDateKey]);

  // Goal functions
  const toggleMilestone = useCallback((goalId, milestoneIndex) => {
    setGoals(prev => prev.map(goal => {
      if (goal.id === goalId) {
        const newMilestones = [...goal.milestones];
        newMilestones[milestoneIndex] = { ...newMilestones[milestoneIndex], completed: !newMilestones[milestoneIndex].completed };
        return { ...goal, milestones: newMilestones };
      }
      return goal;
    }));
  }, []);

  const addGoal = useCallback((goal) => {
    if (!goal.title?.trim()) return;
    const milestones = (goal.milestonesText || '').split('\n').filter(m => m.trim()).map(m => ({ text: m.trim(), completed: false }));
    setGoals(prev => [...prev, { id: generateId(), title: goal.title.trim(), metricType: 'milestone', milestones }]);
    setShowAddGoal(false);
  }, []);

  const deleteGoal = useCallback((goalId) => setGoals(prev => prev.filter(g => g.id !== goalId)), []);

  const addMilestoneToGoal = useCallback((goalId, milestoneText) => {
    if (!milestoneText?.trim()) return;
    setGoals(prev => prev.map(goal => goal.id === goalId ? { ...goal, milestones: [...goal.milestones, { text: milestoneText.trim(), completed: false }] } : goal));
  }, []);

  const deleteMilestone = useCallback((goalId, milestoneIndex) => {
    setGoals(prev => prev.map(goal => goal.id === goalId ? { ...goal, milestones: goal.milestones.filter((_, i) => i !== milestoneIndex) } : goal));
  }, []);

  const updateMilestone = useCallback((goalId, milestoneIndex, newText) => {
    if (!newText?.trim()) return;
    setGoals(prev => prev.map(goal => {
      if (goal.id === goalId) { const m = [...goal.milestones]; m[milestoneIndex] = { ...m[milestoneIndex], text: newText.trim() }; return { ...goal, milestones: m }; }
      return goal;
    }));
  }, []);

  const updateGoal = useCallback((goalId, updates) => setGoals(prev => prev.map(g => g.id === goalId ? { ...g, ...updates } : g)), []);

  // Idea functions
  const addIdea = useCallback((idea) => {
    if (!idea.text?.trim()) return;
    setIdeas(prev => [...prev, { id: generateId(), text: idea.text.trim(), category: idea.category || 'PRODUCTIVITY', createdAt: new Date().toISOString(), status: 'idea', notes: '', points: [], nextStep: '' }]);
    setShowAddIdea(false);
  }, []);

  const updateIdea = useCallback((ideaId, updates) => setIdeas(prev => prev.map(i => i.id === ideaId ? { ...i, ...updates } : i)), []);
  const addIdeaPoint = useCallback((ideaId, pointText) => {
    if (!pointText?.trim()) return;
    setIdeas(prev => prev.map(i => i.id === ideaId ? { ...i, points: [...(i.points || []), { id: generateId(), text: pointText.trim(), done: false }] } : i));
  }, []);
  const toggleIdeaPoint = useCallback((ideaId, pointId) => setIdeas(prev => prev.map(i => i.id === ideaId ? { ...i, points: (i.points || []).map(p => p.id === pointId ? { ...p, done: !p.done } : p) } : i)), []);
  const deleteIdeaPoint = useCallback((ideaId, pointId) => setIdeas(prev => prev.map(i => i.id === ideaId ? { ...i, points: (i.points || []).filter(p => p.id !== pointId) } : i)), []);
  const deleteIdea = useCallback((ideaId) => { setIdeas(prev => prev.filter(i => i.id !== ideaId)); setExpandedIdea(null); }, []);

  // Export/Import
  const exportData = useCallback(() => {
    const data = { version: 'v11', exportedAt: new Date().toISOString(), habits, tasks, goals, ideas, dailyLogs, scores };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `life-manager-backup-${getDateKey()}.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  }, [habits, tasks, goals, ideas, dailyLogs, scores]);

  const importData = useCallback((file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (!data.version || !data.exportedAt) { setImportStatus({ type: 'error', message: 'Invalid backup file' }); return; }
        if (data.habits) setHabits(data.habits);
        if (data.tasks) setTasks(data.tasks);
        if (data.goals) setGoals(data.goals);
        if (data.ideas) setIdeas(data.ideas);
        if (data.dailyLogs) setDailyLogs(data.dailyLogs);
        if (data.scores) setScores(data.scores);
        setImportStatus({ type: 'success', message: `Restored from ${new Date(data.exportedAt).toLocaleDateString()}` });
        setTimeout(() => setImportStatus(null), 3000);
      } catch { setImportStatus({ type: 'error', message: 'Failed to parse file' }); setTimeout(() => setImportStatus(null), 3000); }
    };
    reader.readAsText(file);
  }, []);

  // Save syncCode to localStorage when it changes
  useEffect(() => { saveToStorage('lm_syncCode_v11', syncCode); }, [syncCode]);
  useEffect(() => { saveToStorage('lm_lastSynced_v11', lastSynced); }, [lastSynced]);

  const dismissHomeScreenPopup = useCallback(() => {
    setShowHomeScreenPopup(false);
    saveToStorage('lm_hasSeenHomeScreen_v11', true);
    // Show the sync popup after dismissing home screen popup
    const hasSeenWelcome = loadFromStorage('lm_hasSeenWelcome_v11', false);
    const hasSyncCode = loadFromStorage('lm_syncCode_v11', '');
    if (!hasSeenWelcome && !hasSyncCode) {
      setShowWelcomeSync(true);
    }
  }, []);

  const dismissWelcomeSync = useCallback(() => {
    setShowWelcomeSync(false);
    saveToStorage('lm_hasSeenWelcome_v11', true);
  }, []);

  // Sync functions
  const syncToCloud = useCallback(async () => {
    if (!syncCode) return;
    setIsSyncing(true);
    setSyncStatus(null);
    try {
      const data = { version: 'v11', habits, tasks, goals, ideas, dailyLogs, scores };
      await saveToFirebase(syncCode, data);
      const now = new Date().toISOString();
      setLastSynced(now);
      setSyncStatus({ type: 'success', message: 'Data synced to cloud!' });
      setTimeout(() => setSyncStatus(null), 3000);
    } catch (err) {
      console.error('Sync error:', err);
      setSyncStatus({ type: 'error', message: 'Failed to sync. Check connection.' });
      setTimeout(() => setSyncStatus(null), 3000);
    } finally {
      setIsSyncing(false);
    }
  }, [syncCode, habits, tasks, goals, ideas, dailyLogs, scores]);

  const syncFromCloud = useCallback(async () => {
    if (!syncCode) return;
    setIsSyncing(true);
    setSyncStatus(null);
    try {
      const data = await loadFromFirebase(syncCode);
      if (data) {
        if (data.habits) setHabits(data.habits);
        if (data.tasks) setTasks(data.tasks);
        if (data.goals) setGoals(data.goals);
        if (data.ideas) setIdeas(data.ideas);
        if (data.dailyLogs) setDailyLogs(data.dailyLogs);
        if (data.scores) setScores(data.scores);
        setLastSynced(data.lastUpdated || new Date().toISOString());
        setSyncStatus({ type: 'success', message: 'Data loaded from cloud!' });
      } else {
        setSyncStatus({ type: 'error', message: 'No data found for this code.' });
      }
      setTimeout(() => setSyncStatus(null), 3000);
    } catch (err) {
      console.error('Load error:', err);
      setSyncStatus({ type: 'error', message: 'Failed to load. Check connection.' });
      setTimeout(() => setSyncStatus(null), 3000);
    } finally {
      setIsSyncing(false);
    }
  }, [syncCode]);

  const connectSyncCode = useCallback(async () => {
    if (!syncCodeInput.trim()) return;
    const code = syncCodeInput.trim().toLowerCase();
    setIsSyncing(true);
    setSyncStatus(null);
    try {
      const existingData = await loadFromFirebase(code);
      if (existingData) {
        // Code exists - load data
        if (existingData.habits) setHabits(existingData.habits);
        if (existingData.tasks) setTasks(existingData.tasks);
        if (existingData.goals) setGoals(existingData.goals);
        if (existingData.ideas) setIdeas(existingData.ideas);
        if (existingData.dailyLogs) setDailyLogs(existingData.dailyLogs);
        if (existingData.scores) setScores(existingData.scores);
        setSyncCode(code);
        setLastSynced(existingData.lastUpdated || new Date().toISOString());
        setSyncStatus({ type: 'success', message: 'Connected! Data loaded from cloud.' });
      } else {
        // New code - save current data
        const data = { version: 'v11', habits, tasks, goals, ideas, dailyLogs, scores };
        await saveToFirebase(code, data);
        setSyncCode(code);
        const now = new Date().toISOString();
        setLastSynced(now);
        setSyncStatus({ type: 'success', message: 'New sync code created!' });
      }
      setSyncCodeInput('');
      setTimeout(() => setSyncStatus(null), 3000);
    } catch (err) {
      console.error('Connect error:', err);
      setSyncStatus({ type: 'error', message: 'Connection failed. Try again.' });
      setTimeout(() => setSyncStatus(null), 3000);
    } finally {
      setIsSyncing(false);
    }
  }, [syncCodeInput, habits, tasks, goals, ideas, dailyLogs, scores]);

  const disconnectSync = useCallback(() => {
    setSyncCode('');
    setLastSynced(null);
    setSyncStatus({ type: 'success', message: 'Disconnected from sync.' });
    setTimeout(() => setSyncStatus(null), 3000);
  }, []);

  // Filtered data
  const todayTasks = tasks.filter(t => t.recurring ? true : t.status !== 'done' && (!t.dueDate || t.dueDate <= todayKey));

  const completedForViewingDate = tasks.filter(t => {
    if (t.recurring) {
      const periodKey = getPeriodKey(t.recurring, viewingDate);
      if (!t.completions?.[periodKey]) return false;
      return getDateKey(new Date(t.completions[periodKey])) === viewingDateKey;
    }
    if (t.status !== 'done' || !t.completedAt) return false;
    return getDateKey(new Date(t.completedAt)) === viewingDateKey;
  });

  const applicableHabits = habits.filter(h => !h.createdAt || h.createdAt <= viewingDateKey);

  // Calendar
  const getCalendarDays = (date) => {
    const year = date.getFullYear(); const month = date.getMonth();
    const firstDay = new Date(year, month, 1); const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate(); const startingDay = firstDay.getDay();
    const days = [];
    const prevMonth = new Date(year, month, 0); const prevMonthDays = prevMonth.getDate();
    for (let i = startingDay - 1; i >= 0; i--) { const day = prevMonthDays - i; const d = new Date(year, month - 1, day); days.push({ date: d, isCurrentMonth: false, key: getDateKey(d) }); }
    for (let day = 1; day <= daysInMonth; day++) { const d = new Date(year, month, day); days.push({ date: d, isCurrentMonth: true, key: getDateKey(d) }); }
    const remaining = 42 - days.length;
    for (let day = 1; day <= remaining; day++) { const d = new Date(year, month + 1, day); days.push({ date: d, isCurrentMonth: false, key: getDateKey(d) }); }
    return days;
  };

  const calendarDays = useMemo(() => getCalendarDays(calendarMonth), [calendarMonth]);
  const navigateMonth = (direction) => { setCalendarMonth(prev => { const d = new Date(prev); d.setMonth(d.getMonth() + direction); return d; }); setSelectedDay(null); };

  const monthStats = useMemo(() => {
    const year = calendarMonth.getFullYear(); const month = calendarMonth.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    let total = 0, count = 0, best = { score: 0, date: null }, streakCurrent = 0, streakBest = 0;
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(year, month, day); const key = getDateKey(d);
      if (scores[key] && scores[key].total > 0) {
        total += scores[key].total; count++;
        if (scores[key].total > best.score) best = { score: scores[key].total, date: d };
        streakCurrent++; if (streakCurrent > streakBest) streakBest = streakCurrent;
      } else streakCurrent = 0;
    }
    return { avgScore: count ? Math.round(total / count) : 0, daysTracked: count, bestDay: best, longestStreak: streakBest };
  }, [calendarMonth, scores]);

  // Styles
  const styles = {
    page: { minHeight: '100vh', backgroundColor: '#09090b', color: '#fafafa', fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif", paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)', paddingLeft: 'env(safe-area-inset-left)', paddingRight: 'env(safe-area-inset-right)' },
    nav: { position: 'fixed', top: 'calc(0.5rem + env(safe-area-inset-top))', left: '50%', transform: 'translateX(-50%)', zIndex: 50, backgroundColor: 'rgba(24,24,27,0.95)', backdropFilter: 'blur(12px)', border: '1px solid #27272a', borderRadius: '1rem', padding: '0.375rem', maxWidth: '95vw' },
    navInner: { display: 'flex', alignItems: 'center', gap: '0.25rem' },
    navBtn: (active) => ({ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.125rem', padding: '0.5rem 0.75rem', borderRadius: '0.75rem', border: 'none', backgroundColor: active ? 'rgba(139,92,246,0.15)' : 'transparent', color: active ? '#8b5cf6' : '#a1a1aa', cursor: 'pointer', minHeight: '44px', minWidth: '44px', transition: 'all 0.2s' }),
    navLabel: { fontSize: '0.625rem', fontWeight: 500 },
    main: { paddingTop: 'calc(5rem + env(safe-area-inset-top))', paddingBottom: 'calc(2rem + env(safe-area-inset-bottom))', paddingLeft: '1rem', paddingRight: '1rem', maxWidth: '64rem', marginLeft: 'auto', marginRight: 'auto' },
    card: { backgroundColor: 'rgba(24,24,27,0.7)', border: '1px solid #27272a', borderRadius: '1rem', marginBottom: '1rem', overflow: 'hidden' },
    cardHeader: { padding: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', cursor: 'pointer' },
    cardContent: { padding: '0 1rem 1rem' },
    btn: (variant = 'secondary') => ({
      minHeight: '44px',
      padding: '0.5rem 1rem',
      borderRadius: '0.75rem',
      border: 'none',
      fontWeight: 600,
      fontSize: '0.875rem',
      cursor: 'pointer',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '0.5rem',
      transition: 'all 0.2s',
      ...(variant === 'primary' ? { backgroundColor: '#8b5cf6', color: 'white' } :
         variant === 'danger' ? { backgroundColor: 'rgba(239,68,68,0.2)', color: '#f87171' } :
         { backgroundColor: '#27272a', color: '#fafafa' })
    }),
    input: { width: '100%', minHeight: '44px', padding: '0.75rem 1rem', backgroundColor: '#27272a', border: '1px solid #3f3f46', borderRadius: '0.75rem', color: '#fafafa', fontSize: '1rem', outline: 'none' },
    tag: (color = '#8b5cf6') => ({ padding: '0.25rem 0.625rem', borderRadius: '0.375rem', fontSize: '0.6875rem', fontWeight: 600, backgroundColor: `${color}20`, color }),
    checkbox: (checked) => ({ width: '1.75rem', height: '1.75rem', borderRadius: '0.5rem', border: checked ? 'none' : '2px solid #3f3f46', backgroundColor: checked ? '#10b981' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, transition: 'all 0.2s' }),
  };

  return (
    <div style={styles.page}>
      {/* Navigation */}
      <nav style={styles.nav}>
        <div style={styles.navInner}>
          {[
            { id: 'today', label: 'Today', icon: NavIcons.today },
            { id: 'calendar', label: 'Stats', icon: NavIcons.calendar },
            { id: 'goals', label: 'Goals', icon: NavIcons.goals },
            { id: 'ideas', label: 'Ideas', icon: NavIcons.ideas },
          ].map(item => (
            <button key={item.id} onClick={() => setView(item.id)} style={styles.navBtn(view === item.id)}>
              {item.icon}
              <span style={styles.navLabel}>{item.label}</span>
            </button>
          ))}
          <div style={{ width: '1px', height: '2rem', backgroundColor: '#27272a', margin: '0 0.25rem' }} />
          <button onClick={() => setShowDataModal(true)} style={{ ...styles.navBtn(false), padding: '0.5rem' }}>
            {NavIcons.backup}
          </button>
        </div>
      </nav>

      <main style={styles.main}>
        {/* TODAY VIEW */}
        {view === 'today' && (
          <div>
            {/* Date Navigation */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '1.5rem' }}>
              <button onClick={() => navigateViewingDate(-1)} style={{ ...styles.btn(), width: '3rem', padding: 0 }}>←</button>
              <div style={{ textAlign: 'center', flex: 1 }}>
                <h1 style={{ fontSize: '1.75rem', fontWeight: 700, margin: 0 }}>{getViewingDateLabel()}</h1>
                <p style={{ fontSize: '0.8125rem', color: '#71717a', margin: '0.25rem 0 0' }}>
                  {viewingDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                </p>
              </div>
              <button onClick={() => navigateViewingDate(1)} style={{ ...styles.btn(), width: '3rem', padding: 0 }}>→</button>
            </div>

            {getViewingDateLabel() !== 'Today' && (
              <button onClick={goToToday} style={{ display: 'block', margin: '0 auto 1rem', background: 'none', border: 'none', color: '#8b5cf6', fontSize: '0.875rem', cursor: 'pointer' }}>↩ Back to Today</button>
            )}

            {/* Score Card */}
            <div style={styles.card}>
              <div style={{ padding: '1.25rem' }}>
                <p style={{ fontSize: '0.75rem', fontWeight: 600, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1rem' }}>
                  {getViewingDateLabel()}'s Score
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                  <div style={{
                    width: '6rem', height: '6rem', borderRadius: '50%',
                    background: `conic-gradient(${getScoreColor(viewingScore.total)} ${viewingScore.total}%, #27272a ${viewingScore.total}%)`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: `0 0 30px ${getScoreColor(viewingScore.total)}40`
                  }}>
                    <div style={{ width: '4.5rem', height: '4.5rem', borderRadius: '50%', backgroundColor: '#09090b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: '1.5rem', fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', color: getScoreTextColor(viewingScore.total) }}>{viewingScore.total}%</span>
                    </div>
                  </div>
                  <div style={{ flex: 1 }}>
                    {viewingScore.total >= 25 && (
                      <p style={{ fontSize: '1rem', fontWeight: 600, color: getScoreTextColor(viewingScore.total), marginBottom: '0.25rem' }}>
                        {viewingScore.total >= 90 ? '🔥 Crushing it!' : viewingScore.total >= 70 ? '💪 Great progress!' : viewingScore.total >= 50 ? '👍 Solid day' : '🌱 Getting started'}
                      </p>
                    )}
                    <p style={{ fontSize: '0.875rem', color: '#71717a' }}>{viewingScore.completed} of {viewingScore.totalHabits} habits</p>
                    <div style={{ height: '0.375rem', borderRadius: '0.1875rem', backgroundColor: '#27272a', marginTop: '0.75rem', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${viewingScore.total}%`, backgroundColor: getScoreColor(viewingScore.total), borderRadius: '0.1875rem', transition: 'width 0.5s' }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Habits Section */}
            <div style={styles.card}>
              <div style={styles.cardHeader} onClick={() => toggleSection('habits')}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{ color: '#71717a', transform: collapsedSections.habits ? 'rotate(0deg)' : 'rotate(90deg)', transition: 'transform 0.2s' }}>▶</span>
                  <span style={{ fontWeight: 600 }}>Daily Habits</span>
                  <span style={styles.tag('#8b5cf6')}>{Object.values(viewingLog.habitLogs || {}).filter(h => h.completed).length}/{applicableHabits.length}</span>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button onClick={(e) => { e.stopPropagation(); setShowEditHabits(true); }} style={{ ...styles.btn(), fontSize: '0.75rem', minHeight: '36px', padding: '0.375rem 0.75rem' }}>Edit</button>
                  <button onClick={(e) => { e.stopPropagation(); setShowAddHabit(true); }} style={{ ...styles.btn('primary'), fontSize: '0.75rem', minHeight: '36px', padding: '0.375rem 0.75rem' }}>+ Add</button>
                </div>
              </div>

              {!collapsedSections.habits && (
                <div style={styles.cardContent}>
                  {applicableHabits.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
                      <p style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🎯</p>
                      <p style={{ color: '#71717a', marginBottom: '1rem' }}>No habits yet</p>
                      <button onClick={() => setShowAddHabit(true)} style={styles.btn('primary')}>+ Add your first habit</button>
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
                      {applicableHabits.map(habit => {
                        const log = viewingLog.habitLogs?.[habit.id] || { completed: false, value: 0 };
                        return (
                          <div key={habit.id} style={{ padding: '0.75rem', borderRadius: '0.75rem', backgroundColor: log.completed ? 'rgba(16,185,129,0.15)' : 'rgba(39,39,42,0.5)', border: `1px solid ${log.completed ? 'rgba(16,185,129,0.3)' : '#27272a'}` }}>
                            <div style={{ marginBottom: '0.5rem' }}>
                              {habit.link ? (
                                <a href={habit.link} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.8125rem', fontWeight: 500, color: '#60a5fa', textDecoration: 'none' }}>{habit.name} ↗</a>
                              ) : (
                                <span style={{ fontSize: '0.8125rem', fontWeight: 500 }}>{habit.name}</span>
                              )}
                            </div>
                            {habit.type === 'count' ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <button onClick={() => toggleHabit(habit.id, Math.max(0, log.value - 1))} style={{ width: '2.25rem', height: '2.25rem', borderRadius: '0.5rem', border: 'none', backgroundColor: '#27272a', color: 'white', fontSize: '1.125rem', cursor: 'pointer' }}>−</button>
                                <button onClick={() => toggleHabit(habit.id, log.value + 1)} style={{ width: '2.25rem', height: '2.25rem', borderRadius: '0.5rem', border: 'none', backgroundColor: '#27272a', color: 'white', fontSize: '1.125rem', cursor: 'pointer' }}>+</button>
                                <span style={{ fontSize: '0.8125rem', fontWeight: 600, fontFamily: 'JetBrains Mono, monospace', color: log.completed ? '#10b981' : '#a1a1aa' }}>{log.value}/{habit.target}</span>
                                {log.completed && <span style={{ marginLeft: 'auto', color: '#10b981' }}>✓</span>}
                              </div>
                            ) : (
                              <button onClick={() => toggleHabit(habit.id)} style={{ width: '100%', padding: '0.5rem', borderRadius: '0.5rem', border: 'none', backgroundColor: log.completed ? '#10b981' : '#27272a', color: log.completed ? 'white' : '#a1a1aa', fontSize: '0.75rem', fontWeight: 500, cursor: 'pointer' }}>
                                {log.completed ? '✓ Done' : 'Mark Done'}
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Tasks Section */}
            <div style={styles.card}>
              <div style={styles.cardHeader} onClick={() => toggleSection('tasks')}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{ color: '#71717a', transform: collapsedSections.tasks ? 'rotate(0deg)' : 'rotate(90deg)', transition: 'transform 0.2s' }}>▶</span>
                  <span style={{ fontWeight: 600 }}>Tasks</span>
                  <span style={styles.tag('#71717a')}>{todayTasks.filter(t => !isTaskCompletedForDate(t, viewingDateKey)).length} pending</span>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button onClick={(e) => { e.stopPropagation(); setShowEditTasks(true); }} style={{ ...styles.btn(), fontSize: '0.75rem', minHeight: '36px', padding: '0.375rem 0.75rem' }}>Edit</button>
                  <button onClick={(e) => { e.stopPropagation(); setShowAddTask(true); }} style={{ ...styles.btn('primary'), fontSize: '0.75rem', minHeight: '36px', padding: '0.375rem 0.75rem' }}>+ Add</button>
                </div>
              </div>

              {!collapsedSections.tasks && (
                <div style={styles.cardContent}>
                  {todayTasks.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
                      <p style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>✨</p>
                      <p style={{ color: '#71717a', marginBottom: '1rem' }}>No tasks yet</p>
                      <button onClick={() => setShowAddTask(true)} style={styles.btn('primary')}>+ Add a task</button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {todayTasks.map(task => {
                        const isCompleted = isTaskCompletedForDate(task, viewingDateKey);
                        return (
                          <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', borderRadius: '0.75rem', backgroundColor: 'rgba(39,39,42,0.3)' }}>
                            <div onClick={() => completeTask(task.id)} style={styles.checkbox(isCompleted)}>
                              {isCompleted && <span style={{ color: 'white', fontSize: '0.875rem' }}>✓</span>}
                            </div>
                            <span style={{ flex: 1, fontSize: '0.875rem', textDecoration: isCompleted ? 'line-through' : 'none', color: isCompleted ? '#71717a' : '#fafafa' }}>{task.title}</span>
                            {task.recurring && <span style={styles.tag(task.recurring === 'daily' ? '#06b6d4' : task.recurring === 'weekly' ? '#3b82f6' : '#a855f7')}>🔄 {task.recurring}</span>}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {completedForViewingDate.length > 0 && (
                    <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #27272a' }}>
                      <p style={{ fontSize: '0.6875rem', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>✓ Completed ({completedForViewingDate.length})</p>
                      {completedForViewingDate.map(task => (
                        <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0', color: '#71717a', fontSize: '0.875rem' }}>
                          <span onClick={() => completeTask(task.id)} style={{ cursor: 'pointer', color: '#10b981' }}>✓</span>
                          <span style={{ textDecoration: 'line-through', flex: 1 }}>{task.title}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Sleep Section */}
            <div style={styles.card}>
              <div style={styles.cardHeader} onClick={() => toggleSection('sleep')}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{ color: '#71717a', transform: collapsedSections.sleep ? 'rotate(0deg)' : 'rotate(90deg)', transition: 'transform 0.2s' }}>▶</span>
                  <span style={{ fontWeight: 600 }}>🌙 Sleep & 📱 Screen</span>
                  {viewingLog.sleep?.hoursSlept && <span style={styles.tag(viewingLog.sleep.hoursSlept >= 7 ? '#10b981' : viewingLog.sleep.hoursSlept >= 5 ? '#f59e0b' : '#ef4444')}>{viewingLog.sleep.hoursSlept} hrs</span>}
                </div>
              </div>

              {!collapsedSections.sleep && (
                <div style={styles.cardContent}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem', marginBottom: '1rem' }}>
                    <div>
                      <label style={{ fontSize: '0.6875rem', color: '#71717a', display: 'block', marginBottom: '0.375rem' }}>Bedtime</label>
                      <input type="time" value={viewingLog.sleep?.bedTime || ''} onChange={(e) => {
                        const bedTime = e.target.value; const wakeTime = viewingLog.sleep?.wakeTime; let hoursSlept = null;
                        if (bedTime && wakeTime) { const bed = new Date(`2000-01-01T${bedTime}`); let wake = new Date(`2000-01-01T${wakeTime}`); if (wake < bed) wake.setDate(wake.getDate() + 1); hoursSlept = Math.round((wake - bed) / 36000) / 100; }
                        setDailyLogs(prev => ({ ...prev, [viewingDateKey]: { ...prev[viewingDateKey], habitLogs: prev[viewingDateKey]?.habitLogs || {}, sleep: { ...prev[viewingDateKey]?.sleep, bedTime, hoursSlept } } }));
                      }} style={{ ...styles.input, fontFamily: 'JetBrains Mono, monospace', fontSize: '0.875rem' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.6875rem', color: '#71717a', display: 'block', marginBottom: '0.375rem' }}>Wake time</label>
                      <input type="time" value={viewingLog.sleep?.wakeTime || ''} onChange={(e) => {
                        const wakeTime = e.target.value; const bedTime = viewingLog.sleep?.bedTime; let hoursSlept = null;
                        if (bedTime && wakeTime) { const bed = new Date(`2000-01-01T${bedTime}`); let wake = new Date(`2000-01-01T${wakeTime}`); if (wake < bed) wake.setDate(wake.getDate() + 1); hoursSlept = Math.round((wake - bed) / 36000) / 100; }
                        setDailyLogs(prev => ({ ...prev, [viewingDateKey]: { ...prev[viewingDateKey], habitLogs: prev[viewingDateKey]?.habitLogs || {}, sleep: { ...prev[viewingDateKey]?.sleep, wakeTime, hoursSlept } } }));
                      }} style={{ ...styles.input, fontFamily: 'JetBrains Mono, monospace', fontSize: '0.875rem' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.6875rem', color: '#71717a', display: 'block', marginBottom: '0.375rem' }}>Hours slept</label>
                      <div style={{ ...styles.input, backgroundColor: viewingLog.sleep?.hoursSlept >= 7 ? 'rgba(16,185,129,0.2)' : viewingLog.sleep?.hoursSlept >= 5 ? 'rgba(245,158,11,0.2)' : viewingLog.sleep?.hoursSlept ? 'rgba(239,68,68,0.2)' : '#27272a', textAlign: 'center', fontWeight: 600, fontFamily: 'JetBrains Mono, monospace', color: viewingLog.sleep?.hoursSlept >= 7 ? '#10b981' : viewingLog.sleep?.hoursSlept >= 5 ? '#f59e0b' : viewingLog.sleep?.hoursSlept ? '#ef4444' : '#71717a' }}>
                        {viewingLog.sleep?.hoursSlept ? `${viewingLog.sleep.hoursSlept} hrs` : '—'}
                      </div>
                    </div>
                    <div>
                      <label style={{ fontSize: '0.6875rem', color: '#71717a', display: 'block', marginBottom: '0.375rem' }}>Screen time (hrs)</label>
                      <input type="number" step="0.5" min="0" max="24" value={viewingLog.screenTime || ''} onChange={(e) => setDailyLogs(prev => ({ ...prev, [viewingDateKey]: { ...prev[viewingDateKey], habitLogs: prev[viewingDateKey]?.habitLogs || {}, screenTime: parseFloat(e.target.value) || 0 } }))} placeholder="0" style={{ ...styles.input, fontFamily: 'JetBrains Mono, monospace', fontSize: '0.875rem' }} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Fact Section */}
            <div style={styles.card}>
              <div style={styles.cardHeader} onClick={() => toggleSection('fact')}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{ color: '#71717a', transform: collapsedSections.fact ? 'rotate(0deg)' : 'rotate(90deg)', transition: 'transform 0.2s' }}>▶</span>
                  <span style={{ fontWeight: 600 }}>📚 Fact I Learned</span>
                  {viewingLog.factLearned && <span style={styles.tag('#10b981')}>✓ Recorded</span>}
                </div>
              </div>

              {!collapsedSections.fact && (
                <div style={styles.cardContent}>
                  <textarea value={viewingLog.factLearned || ''} onChange={(e) => setDailyLogs(prev => ({ ...prev, [viewingDateKey]: { ...prev[viewingDateKey], habitLogs: prev[viewingDateKey]?.habitLogs || {}, factLearned: e.target.value } }))} placeholder="What's something interesting you learned today?" style={{ ...styles.input, minHeight: '5rem', resize: 'none', fontSize: '0.875rem' }} />
                </div>
              )}
            </div>
          </div>
        )}

        {/* CALENDAR VIEW */}
        {view === 'calendar' && (
          <div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.25rem' }}>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>Score Calendar</h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button onClick={() => navigateMonth(-1)} style={{ ...styles.btn(), width: '2.75rem', padding: 0 }}>←</button>
                <span style={{ flex: 1, textAlign: 'center', fontWeight: 600 }}>{calendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
                <button onClick={() => navigateMonth(1)} style={{ ...styles.btn(), width: '2.75rem', padding: 0 }}>→</button>
                <button onClick={() => { setCalendarMonth(new Date()); setSelectedDay(null); }} style={{ ...styles.btn(), fontSize: '0.8125rem' }}>Today</button>
              </div>
            </div>

            <div style={styles.card}>
              <div style={{ padding: '1rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.25rem', marginBottom: '0.5rem' }}>
                  {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <div key={i} style={{ textAlign: 'center', fontSize: '0.6875rem', fontWeight: 500, color: '#71717a', padding: '0.375rem' }}>{d}</div>)}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.25rem' }}>
                  {calendarDays.map((day, i) => {
                    const score = scores[day.key]?.total;
                    const isSelected = selectedDay?.key === day.key;
                    const isToday = day.key === todayKey;
                    return (
                      <button key={i} onClick={() => setSelectedDay(day)} onDoubleClick={() => { setViewingDate(day.date); setView('today'); }}
                        style={{ aspectRatio: '1', borderRadius: '0.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: isToday ? '2px solid #3b82f6' : isSelected ? '2px solid #8b5cf6' : 'none', backgroundColor: getScoreColor(score), color: score > 0 ? 'white' : '#71717a', opacity: day.isCurrentMonth ? 1 : 0.3, cursor: 'pointer', fontSize: '0.75rem', fontWeight: 500 }}>
                        <span>{day.date.getDate()}</span>
                        {score > 0 && <span style={{ fontSize: '0.625rem', fontFamily: 'JetBrains Mono, monospace' }}>{score}</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Month Stats */}
            <div style={styles.card}>
              <div style={{ padding: '1rem' }}>
                <h3 style={{ fontSize: '0.875rem', fontWeight: 600, color: '#a1a1aa', marginBottom: '1rem' }}>Month Summary</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
                  <div><p style={{ fontSize: '0.6875rem', color: '#71717a' }}>Average</p><p style={{ fontSize: '1.5rem', fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', color: '#8b5cf6' }}>{monthStats.avgScore}%</p></div>
                  <div><p style={{ fontSize: '0.6875rem', color: '#71717a' }}>Days Tracked</p><p style={{ fontSize: '1.5rem', fontWeight: 700, fontFamily: 'JetBrains Mono, monospace' }}>{monthStats.daysTracked}</p></div>
                  <div><p style={{ fontSize: '0.6875rem', color: '#71717a' }}>Best Day</p><p style={{ fontSize: '1.25rem', fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', color: '#10b981' }}>{monthStats.bestDay.score || '—'}</p></div>
                  <div><p style={{ fontSize: '0.6875rem', color: '#71717a' }}>Best Streak</p><p style={{ fontSize: '1.25rem', fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', color: '#f59e0b' }}>{monthStats.longestStreak || '—'} days</p></div>
                </div>
              </div>
            </div>

            {/* Selected Day */}
            {selectedDay && (
              <div style={styles.card}>
                <div style={{ padding: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h3 style={{ fontWeight: 600, margin: 0 }}>{selectedDay.date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</h3>
                    <button onClick={() => setSelectedDay(null)} style={{ background: 'none', border: 'none', color: '#71717a', fontSize: '1.25rem', cursor: 'pointer' }}>✕</button>
                  </div>
                  {scores[selectedDay.key] ? (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
                        <div style={{ width: '5rem', height: '5rem', borderRadius: '0.75rem', backgroundColor: getScoreColor(scores[selectedDay.key].total), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <span style={{ fontSize: '1.5rem', fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', color: 'white' }}>{scores[selectedDay.key].total}%</span>
                        </div>
                      </div>
                      <p style={{ textAlign: 'center', color: '#71717a', fontSize: '0.875rem', marginBottom: '1rem' }}>{scores[selectedDay.key].completed}/{scores[selectedDay.key].totalHabits} habits completed</p>

                      {/* Additional day info */}
                      {(dailyLogs[selectedDay.key]?.sleep?.hoursSlept || dailyLogs[selectedDay.key]?.screenTime || dailyLogs[selectedDay.key]?.factLearned) && (
                        <div style={{ marginBottom: '1rem', padding: '0.75rem', borderRadius: '0.5rem', backgroundColor: 'rgba(39,39,42,0.5)' }}>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
                            {dailyLogs[selectedDay.key]?.sleep?.hoursSlept && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                                <span style={{ fontSize: '0.875rem' }}>🌙</span>
                                <span style={{ fontSize: '0.8125rem', color: dailyLogs[selectedDay.key].sleep.hoursSlept >= 7 ? '#10b981' : dailyLogs[selectedDay.key].sleep.hoursSlept >= 5 ? '#f59e0b' : '#ef4444', fontWeight: 500 }}>{dailyLogs[selectedDay.key].sleep.hoursSlept} hrs</span>
                              </div>
                            )}
                            {dailyLogs[selectedDay.key]?.screenTime > 0 && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                                <span style={{ fontSize: '0.875rem' }}>📱</span>
                                <span style={{ fontSize: '0.8125rem', color: '#a1a1aa', fontWeight: 500 }}>{dailyLogs[selectedDay.key].screenTime} hrs</span>
                              </div>
                            )}
                          </div>
                          {dailyLogs[selectedDay.key]?.factLearned && (
                            <div style={{ marginTop: '0.625rem', paddingTop: '0.625rem', borderTop: '1px solid #3f3f46' }}>
                              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.375rem' }}>
                                <span style={{ fontSize: '0.875rem' }}>📚</span>
                                <span style={{ fontSize: '0.75rem', color: '#a1a1aa', lineHeight: '1.4' }}>
                                  {dailyLogs[selectedDay.key].factLearned.length > 50
                                    ? dailyLogs[selectedDay.key].factLearned.substring(0, 50) + '...'
                                    : dailyLogs[selectedDay.key].factLearned}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      <button onClick={() => { setViewingDate(selectedDay.date); setView('today'); setSelectedDay(null); }} style={{ ...styles.btn('primary'), width: '100%' }}>View Day →</button>
                    </>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '1rem' }}>
                      <p style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📅</p>
                      <p style={{ color: '#71717a', marginBottom: '1rem' }}>No data recorded</p>
                      <button onClick={() => { setViewingDate(selectedDay.date); setView('today'); setSelectedDay(null); }} style={styles.btn('primary')}>{selectedDay.key === todayKey ? 'Start tracking' : 'Add data'}</button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* GOALS VIEW */}
        {view === 'goals' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', gap: '1rem', flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>Goals</h1>
              <button onClick={() => setShowAddGoal(true)} style={styles.btn('primary')}>+ New Goal</button>
            </div>

            {goals.length === 0 ? (
              <div style={{ ...styles.card, padding: '3rem 1.5rem', textAlign: 'center' }}>
                <p style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🎯</p>
                <p style={{ color: '#71717a', marginBottom: '1.5rem' }}>No goals yet. Set your first goal!</p>
                <button onClick={() => setShowAddGoal(true)} style={styles.btn('primary')}>+ Create Goal</button>
              </div>
            ) : (
              goals.map(goal => {
                const completedCount = goal.milestones.filter(m => m.completed).length;
                const progress = goal.milestones.length > 0 ? Math.round((completedCount / goal.milestones.length) * 100) : 0;
                return (
                  <div key={goal.id} style={styles.card}>
                    <div style={{ padding: '1.25rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', gap: '1rem' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          {editingGoal === goal.id ? (
                            <input defaultValue={goal.title} autoFocus style={{ ...styles.input, fontSize: '1.125rem', fontWeight: 600 }} onBlur={(e) => { if (e.target.value.trim()) updateGoal(goal.id, { title: e.target.value.trim() }); setEditingGoal(null); }} onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }} />
                          ) : (
                            <h3 onClick={() => setEditingGoal(goal.id)} style={{ fontSize: '1.125rem', fontWeight: 600, margin: 0, cursor: 'pointer' }}>{goal.title}</h3>
                          )}
                          <p style={{ fontSize: '0.8125rem', color: '#71717a', margin: '0.25rem 0 0' }}>{completedCount}/{goal.milestones.length} milestones</p>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontSize: '1.5rem', fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', color: progress === 100 ? '#10b981' : '#8b5cf6' }}>{progress}%</span>
                          <button onClick={() => deleteGoal(goal.id)} style={{ background: 'none', border: 'none', color: '#71717a', cursor: 'pointer', fontSize: '1.25rem' }}>✕</button>
                        </div>
                      </div>

                      <div style={{ height: '0.5rem', borderRadius: '0.25rem', backgroundColor: '#27272a', marginBottom: '1rem', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${progress}%`, backgroundColor: progress === 100 ? '#10b981' : '#8b5cf6', borderRadius: '0.25rem', transition: 'width 0.5s' }} />
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {goal.milestones.map((milestone, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', borderRadius: '0.75rem', backgroundColor: milestone.completed ? 'rgba(16,185,129,0.1)' : 'rgba(39,39,42,0.5)', border: `1px solid ${milestone.completed ? 'rgba(16,185,129,0.3)' : '#27272a'}` }}>
                            <div onClick={() => toggleMilestone(goal.id, i)} style={styles.checkbox(milestone.completed)}>
                              {milestone.completed && <span style={{ color: 'white', fontSize: '0.75rem' }}>✓</span>}
                            </div>
                            {editingMilestone?.goalId === goal.id && editingMilestone?.index === i ? (
                              <input defaultValue={milestone.text} autoFocus style={{ ...styles.input, flex: 1, minHeight: '36px', padding: '0.5rem' }} onBlur={(e) => { if (e.target.value.trim()) updateMilestone(goal.id, i, e.target.value.trim()); setEditingMilestone(null); }} onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }} />
                            ) : (
                              <span onClick={() => setEditingMilestone({ goalId: goal.id, index: i })} style={{ flex: 1, fontSize: '0.875rem', textDecoration: milestone.completed ? 'line-through' : 'none', color: milestone.completed ? '#71717a' : '#fafafa', cursor: 'pointer' }}>{milestone.text}</span>
                            )}
                            <button onClick={() => deleteMilestone(goal.id, i)} style={{ background: 'none', border: 'none', color: '#71717a', cursor: 'pointer', opacity: 0.5 }}>✕</button>
                          </div>
                        ))}

                        <form onSubmit={(e) => { e.preventDefault(); const input = e.target.elements[`milestone-${goal.id}`]; if (input.value.trim()) { addMilestoneToGoal(goal.id, input.value.trim()); input.value = ''; } }}>
                          <input name={`milestone-${goal.id}`} type="text" placeholder="+ Add milestone..." style={{ ...styles.input, fontSize: '0.875rem' }} />
                        </form>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* IDEAS VIEW */}
        {view === 'ideas' && (
          <div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.25rem' }}>
              <div>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>Ideas</h1>
                <p style={{ fontSize: '0.8125rem', color: '#71717a', margin: '0.25rem 0 0' }}>Capture and develop your ideas</p>
              </div>
              <button onClick={() => setShowAddIdea(true)} style={{ ...styles.btn('primary'), width: '100%' }}>+ New Idea</button>
            </div>

            {ideas.length === 0 ? (
              <div style={{ ...styles.card, padding: '3rem 1.5rem', textAlign: 'center' }}>
                <p style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>💡</p>
                <p style={{ color: '#71717a', marginBottom: '1.5rem' }}>No ideas yet. Capture your first one!</p>
                <button onClick={() => setShowAddIdea(true)} style={styles.btn('primary')}>+ Add Idea</button>
              </div>
            ) : (
              ideas.map(idea => {
                const isExpanded = expandedIdea === idea.id;
                const status = idea.status || 'idea';
                const statusConfig = { idea: { icon: '💭', color: '#71717a' }, exploring: { icon: '🔍', color: '#3b82f6' }, planning: { icon: '📋', color: '#a855f7' }, active: { icon: '🚀', color: '#10b981' }, done: { icon: '✅', color: '#10b981' } }[status];
                const pointsDone = (idea.points || []).filter(p => p.done).length;
                const totalPoints = (idea.points || []).length;

                return (
                  <div key={idea.id} style={styles.card}>
                    <div onClick={() => setExpandedIdea(isExpanded ? null : idea.id)} style={{ padding: '1rem', cursor: 'pointer' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: 0, marginBottom: '0.5rem' }}>{idea.text}</h3>
                          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                            <span style={styles.tag(statusConfig.color)}>{statusConfig.icon} {status}</span>
                            <span style={styles.tag(CATEGORIES[idea.category]?.color || '#71717a')}>{CATEGORIES[idea.category]?.icon} {CATEGORIES[idea.category]?.name || 'General'}</span>
                            {totalPoints > 0 && <span style={{ fontSize: '0.6875rem', color: '#71717a' }}>{pointsDone}/{totalPoints} points</span>}
                          </div>
                        </div>
                        <span style={{ color: '#71717a', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>▼</span>
                      </div>
                    </div>

                    {isExpanded && (
                      <div style={{ padding: '0 1rem 1rem', borderTop: '1px solid #27272a' }}>
                        <div style={{ paddingTop: '1rem' }}>
                          <label style={{ fontSize: '0.6875rem', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '0.5rem' }}>Status</label>
                          <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
                            {['idea', 'exploring', 'planning', 'active', 'done'].map(s => {
                              const cfg = { idea: '💭', exploring: '🔍', planning: '📋', active: '🚀', done: '✅' }[s];
                              return <button key={s} onClick={() => updateIdea(idea.id, { status: s })} style={{ ...styles.btn(status === s ? 'primary' : 'secondary'), fontSize: '0.75rem', minHeight: '36px', padding: '0.375rem 0.625rem' }}>{cfg} {s}</button>;
                            })}
                          </div>
                        </div>

                        <div style={{ marginTop: '1rem' }}>
                          <label style={{ fontSize: '0.6875rem', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '0.5rem' }}>Notes</label>
                          <textarea value={idea.notes || ''} onChange={(e) => updateIdea(idea.id, { notes: e.target.value })} placeholder="Add notes..." style={{ ...styles.input, minHeight: '4rem', resize: 'none', fontSize: '0.875rem' }} />
                        </div>

                        <div style={{ marginTop: '1rem' }}>
                          <label style={{ fontSize: '0.6875rem', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '0.5rem' }}>Brainstorm Points ({pointsDone}/{totalPoints})</label>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                            {(idea.points || []).map(point => (
                              <div key={point.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem', borderRadius: '0.5rem', backgroundColor: 'rgba(39,39,42,0.3)' }}>
                                <div onClick={() => toggleIdeaPoint(idea.id, point.id)} style={{ ...styles.checkbox(point.done), width: '1.5rem', height: '1.5rem' }}>
                                  {point.done && <span style={{ color: 'white', fontSize: '0.625rem' }}>✓</span>}
                                </div>
                                <span style={{ flex: 1, fontSize: '0.8125rem', textDecoration: point.done ? 'line-through' : 'none', color: point.done ? '#71717a' : '#fafafa' }}>{point.text}</span>
                                <button onClick={() => deleteIdeaPoint(idea.id, point.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.875rem', opacity: 0.7 }}>✕</button>
                              </div>
                            ))}
                            <form onSubmit={(e) => { e.preventDefault(); const input = e.target.elements.point; if (input.value.trim()) { addIdeaPoint(idea.id, input.value.trim()); input.value = ''; } }} style={{ display: 'flex', gap: '0.5rem' }}>
                              <input name="point" type="text" placeholder="+ Add point..." style={{ ...styles.input, flex: 1, fontSize: '0.8125rem' }} />
                              <button type="submit" style={{ ...styles.btn(), fontSize: '0.75rem' }}>Add</button>
                            </form>
                          </div>
                        </div>

                        <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #27272a', display: 'flex', justifyContent: 'space-between' }}>
                          <button onClick={() => { addTask({ title: idea.text, term: 'This Week' }); updateIdea(idea.id, { status: 'active' }); }} style={{ background: 'none', border: 'none', color: '#8b5cf6', cursor: 'pointer', fontSize: '0.8125rem' }}>📋 Make Task</button>
                          <button onClick={() => deleteIdea(idea.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.8125rem' }}>🗑️ Delete</button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </main>


      {/* MODALS */}

      {/* Add Task Modal */}
      <Modal isOpen={showAddTask} onClose={() => { setShowAddTask(false); setNewTaskTerm('Today'); setNewTaskRecurring(null); }} title="New Task">
        <form onSubmit={(e) => { e.preventDefault(); addTask({ title: e.target.title.value, term: newTaskRecurring ? 'Today' : newTaskTerm, recurring: newTaskRecurring }); }}>
          <input name="title" type="text" placeholder="What needs to be done?" style={{ ...styles.input, marginBottom: '1rem' }} autoFocus required />

          <label style={{ fontSize: '0.75rem', color: '#71717a', display: 'block', marginBottom: '0.5rem' }}>Repeat</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem', marginBottom: '1rem' }}>
            {[{ v: null, l: 'Once', i: '1️⃣' }, { v: 'daily', l: 'Daily', i: '📅' }, { v: 'weekly', l: 'Weekly', i: '📆' }, { v: 'monthly', l: 'Monthly', i: '🗓️' }].map(opt => (
              <button key={opt.l} type="button" onClick={() => setNewTaskRecurring(opt.v)} style={{ padding: '0.75rem 0.5rem', borderRadius: '0.75rem', border: newTaskRecurring === opt.v ? '2px solid #10b981' : '2px solid #27272a', backgroundColor: newTaskRecurring === opt.v ? 'rgba(16,185,129,0.15)' : '#27272a', color: newTaskRecurring === opt.v ? '#10b981' : '#fafafa', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
                <span style={{ fontSize: '1.25rem' }}>{opt.i}</span>
                <span style={{ fontSize: '0.6875rem', fontWeight: 500 }}>{opt.l}</span>
              </button>
            ))}
          </div>

          {!newTaskRecurring && (
            <>
              <label style={{ fontSize: '0.75rem', color: '#71717a', display: 'block', marginBottom: '0.5rem' }}>When</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem', marginBottom: '1rem' }}>
                {[{ v: 'Today', c: '#8b5cf6' }, { v: 'This Week', c: '#3b82f6' }, { v: 'This Month', c: '#a855f7' }, { v: 'Long Term', c: '#71717a' }].map(term => (
                  <button key={term.v} type="button" onClick={() => setNewTaskTerm(term.v)} style={{ padding: '0.75rem', borderRadius: '0.75rem', border: newTaskTerm === term.v ? `2px solid ${term.c}` : '2px solid #27272a', backgroundColor: newTaskTerm === term.v ? `${term.c}20` : '#27272a', color: newTaskTerm === term.v ? term.c : '#fafafa', cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 500 }}>{term.v}</button>
                ))}
              </div>
            </>
          )}

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
            <button type="button" onClick={() => { setShowAddTask(false); setNewTaskTerm('Today'); setNewTaskRecurring(null); }} style={{ ...styles.btn(), flex: 1 }}>Cancel</button>
            <button type="submit" style={{ ...styles.btn('primary'), flex: 1 }}>Add Task</button>
          </div>
        </form>
      </Modal>

      {/* Add Habit Modal */}
      <Modal isOpen={showAddHabit} onClose={() => setShowAddHabit(false)} title="New Habit">
        <form onSubmit={(e) => { e.preventDefault(); const f = e.target; addHabit({ name: f.name.value, type: f.type.value, target: f.target.value, category: f.category.value }); }}>
          <input name="name" type="text" placeholder="Habit name" style={{ ...styles.input, marginBottom: '0.75rem' }} autoFocus required />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <select name="type" style={styles.input}><option value="binary">Yes/No</option><option value="count">Count</option></select>
            <input name="target" type="number" placeholder="Target (1)" defaultValue={1} style={styles.input} />
          </div>
          <select name="category" style={{ ...styles.input, marginBottom: '1.5rem' }}>{Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.name}</option>)}</select>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button type="button" onClick={() => setShowAddHabit(false)} style={{ ...styles.btn(), flex: 1 }}>Cancel</button>
            <button type="submit" style={{ ...styles.btn('primary'), flex: 1 }}>Add Habit</button>
          </div>
        </form>
      </Modal>

      {/* Edit Habits Modal */}
      <Modal isOpen={showEditHabits} onClose={() => { setShowEditHabits(false); setEditingHabit(null); }} title="Edit Habits" size="lg">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {habits.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#71717a', padding: '2rem' }}>No habits yet</p>
          ) : habits.map(habit => (
            <div key={habit.id} style={{ padding: '0.75rem', borderRadius: '0.75rem', backgroundColor: '#27272a' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {editingHabit === habit.id ? (
                    <input defaultValue={habit.name} autoFocus style={{ ...styles.input, minHeight: '36px', padding: '0.5rem', fontSize: '0.875rem' }} onBlur={(e) => { if (e.target.value.trim()) updateHabit(habit.id, { name: e.target.value.trim() }); setEditingHabit(null); }} onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }} />
                  ) : (
                    <div>
                      <span style={{ fontWeight: 500, fontSize: '0.875rem' }}>{habit.name}</span>
                      <span style={{ fontSize: '0.75rem', color: '#71717a', marginLeft: '0.5rem' }}>({habit.type === 'count' ? `${habit.target}/day` : 'daily'})</span>
                    </div>
                  )}
                </div>
                <button onClick={() => setEditingHabit(editingHabit === habit.id ? null : habit.id)} style={{ ...styles.btn(), fontSize: '0.75rem', minHeight: '36px', padding: '0.375rem 0.625rem' }}>{editingHabit === habit.id ? 'Done' : 'Edit'}</button>
                <button onClick={() => { setShowEditHabits(false); setDeleteHabitModal(habit); }} style={{ ...styles.btn('danger'), fontSize: '0.75rem', minHeight: '36px', padding: '0.375rem 0.625rem' }}>Delete</button>
              </div>
            </div>
          ))}
        </div>
        <button onClick={() => { setShowEditHabits(false); setEditingHabit(null); }} style={{ ...styles.btn(), width: '100%', marginTop: '1rem' }}>Done</button>
      </Modal>

      {/* Edit Tasks Modal */}
      <Modal isOpen={showEditTasks} onClose={() => setShowEditTasks(false)} title="Edit Tasks" size="lg">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {tasks.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#71717a', padding: '2rem' }}>No tasks yet</p>
          ) : tasks.map(task => (
            <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem', borderRadius: '0.75rem', backgroundColor: '#27272a', opacity: task.status === 'done' ? 0.6 : 1 }}>
              <span style={{ flex: 1, fontSize: '0.875rem', textDecoration: task.status === 'done' ? 'line-through' : 'none' }}>{task.title}</span>
              {task.recurring && <span style={styles.tag('#06b6d4')}>{task.recurring}</span>}
              <button onClick={() => setTasks(prev => prev.filter(t => t.id !== task.id))} style={{ ...styles.btn('danger'), fontSize: '0.75rem', minHeight: '32px', padding: '0.25rem 0.5rem' }}>✕</button>
            </div>
          ))}
        </div>
        <button onClick={() => setShowEditTasks(false)} style={{ ...styles.btn(), width: '100%', marginTop: '1rem' }}>Done</button>
      </Modal>

      {/* Add Idea Modal */}
      <Modal isOpen={showAddIdea} onClose={() => setShowAddIdea(false)} title="💡 New Idea">
        <form onSubmit={(e) => { e.preventDefault(); addIdea({ text: e.target.text.value, category: e.target.category.value }); }}>
          <input name="text" type="text" placeholder="What's your idea?" style={{ ...styles.input, marginBottom: '0.75rem', fontSize: '1rem' }} autoFocus required />
          <select name="category" style={{ ...styles.input, marginBottom: '1.5rem' }}>{Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.name}</option>)}</select>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button type="button" onClick={() => setShowAddIdea(false)} style={{ ...styles.btn(), flex: 1 }}>Cancel</button>
            <button type="submit" style={{ ...styles.btn('primary'), flex: 1 }}>Capture</button>
          </div>
        </form>
      </Modal>

      {/* Add Goal Modal */}
      <Modal isOpen={showAddGoal} onClose={() => setShowAddGoal(false)} title="New Goal">
        <form onSubmit={(e) => { e.preventDefault(); addGoal({ title: e.target.title.value, milestonesText: e.target.milestones.value }); }}>
          <input name="title" type="text" placeholder="Goal title" style={{ ...styles.input, marginBottom: '0.75rem' }} autoFocus required />
          <label style={{ fontSize: '0.75rem', color: '#71717a', display: 'block', marginBottom: '0.375rem' }}>Milestones (one per line)</label>
          <textarea name="milestones" placeholder="First milestone&#10;Second milestone&#10;Third milestone" style={{ ...styles.input, minHeight: '6rem', resize: 'none', marginBottom: '1.5rem' }} />
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button type="button" onClick={() => setShowAddGoal(false)} style={{ ...styles.btn(), flex: 1 }}>Cancel</button>
            <button type="submit" style={{ ...styles.btn('primary'), flex: 1 }}>Create Goal</button>
          </div>
        </form>
      </Modal>

      {/* Data Modal */}
      <Modal isOpen={showDataModal} onClose={() => setShowDataModal(false)} title="💾 Backup & Sync">
        {(importStatus || syncStatus) && <div style={{ marginBottom: '1rem', padding: '0.75rem', borderRadius: '0.75rem', backgroundColor: (importStatus?.type || syncStatus?.type) === 'success' ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)', color: (importStatus?.type || syncStatus?.type) === 'success' ? '#10b981' : '#ef4444', fontSize: '0.875rem' }}>{(importStatus?.type || syncStatus?.type) === 'success' ? '✓' : '✕'} {importStatus?.message || syncStatus?.message}</div>}

        {/* Cloud Sync Section */}
        <div style={{ padding: '1rem', borderRadius: '0.75rem', backgroundColor: '#27272a', marginBottom: '0.75rem', border: syncCode ? '1px solid rgba(16,185,129,0.3)' : '1px solid transparent' }}>
          <h3 style={{ fontWeight: 600, marginBottom: '0.75rem', fontSize: '0.9375rem' }}>☁️ Cloud Sync</h3>
          {syncCode ? (
            <>
              <div style={{ marginBottom: '1rem', padding: '0.75rem', borderRadius: '0.5rem', backgroundColor: '#3f3f46', textAlign: 'center' }}>
                <p style={{ fontSize: '0.75rem', color: '#a1a1aa', marginBottom: '0.25rem' }}>Your sync code</p>
                <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '1.25rem', fontWeight: 700, color: '#fafafa', letterSpacing: '0.05em' }}>{syncCode.toUpperCase()}</p>
                <p style={{ fontSize: '0.6875rem', color: '#71717a', marginTop: '0.375rem' }}>Codes are not case-sensitive</p>
              </div>
              <div style={{ marginBottom: '1rem', padding: '0.625rem', borderRadius: '0.5rem', backgroundColor: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)' }}>
                <p style={{ fontSize: '0.75rem', color: '#60a5fa', margin: 0 }}>💡 Save this code somewhere safe — you'll need it to sync on other devices</p>
              </div>
              {lastSynced && <p style={{ fontSize: '0.75rem', color: '#71717a', marginBottom: '0.75rem' }}>Last synced: {new Date(lastSynced).toLocaleString()}</p>}
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <button onClick={syncToCloud} disabled={isSyncing} style={{ ...styles.btn('primary'), flex: 1, opacity: isSyncing ? 0.7 : 1, fontSize: '0.8125rem' }}>{isSyncing ? '...' : '⬆️ Upload to Cloud'}</button>
                <button onClick={syncFromCloud} disabled={isSyncing} style={{ ...styles.btn(), flex: 1, opacity: isSyncing ? 0.7 : 1, fontSize: '0.8125rem' }}>{isSyncing ? '...' : '⬇️ Download from Cloud'}</button>
              </div>
              <p style={{ fontSize: '0.6875rem', color: '#a1a1aa', marginBottom: '1rem', lineHeight: '1.4' }}>Data does not sync automatically. Tap "Upload to Cloud" to save your data, or "Download from Cloud" to load data from another device.</p>
              <div style={{ paddingTop: '0.75rem', borderTop: '1px solid #3f3f46' }}>
                <button onClick={disconnectSync} style={{ background: 'none', border: 'none', color: '#f59e0b', fontSize: '0.8125rem', cursor: 'pointer', padding: 0, fontWeight: 500 }}>🔄 Change Code</button>
                <p style={{ fontSize: '0.6875rem', color: '#71717a', marginTop: '0.375rem' }}>Changing your code won't delete local data.</p>
              </div>
            </>
          ) : (
            <>
              <p style={{ fontSize: '0.8125rem', color: '#71717a', marginBottom: '0.75rem' }}>Enter a personal sync code to backup & sync across devices</p>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <input
                  type="text"
                  value={syncCodeInput}
                  onChange={(e) => setSyncCodeInput(e.target.value.toUpperCase())}
                  placeholder="e.g. LIFEMANAGER"
                  style={{ ...styles.input, flex: 1, fontFamily: 'JetBrains Mono, monospace', textTransform: 'uppercase' }}
                  onKeyDown={(e) => { if (e.key === 'Enter') connectSyncCode(); }}
                />
                <button onClick={connectSyncCode} disabled={isSyncing || !syncCodeInput.trim()} style={{ ...styles.btn('primary'), opacity: (isSyncing || !syncCodeInput.trim()) ? 0.7 : 1 }}>{isSyncing ? '...' : 'Connect'}</button>
              </div>
              <p style={{ fontSize: '0.6875rem', color: '#71717a' }}>Codes are not case-sensitive</p>
            </>
          )}
        </div>

        {/* Data Stats */}
        <div style={{ padding: '0.75rem', borderRadius: '0.75rem', backgroundColor: 'rgba(39,39,42,0.5)', fontSize: '0.75rem', color: '#71717a', marginBottom: '0.75rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.25rem' }}>
            <span>{habits.length} habits</span><span>{tasks.length} tasks</span>
            <span>{goals.length} goals</span><span>{ideas.length} ideas</span>
            <span>{Object.keys(dailyLogs).length} days logged</span><span>{Object.keys(scores).length} scores</span>
          </div>
        </div>

        <button onClick={() => setShowDataModal(false)} style={{ ...styles.btn(), width: '100%' }}>Close</button>
      </Modal>

      {/* Add to Home Screen Modal */}
      <Modal isOpen={showHomeScreenPopup} onClose={dismissHomeScreenPopup} title="📱 Add to Home Screen">
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <p style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>🏠</p>
          <p style={{ fontSize: '0.9375rem', color: '#fafafa', marginBottom: '0.5rem' }}>Get the full app experience</p>
          <p style={{ fontSize: '0.8125rem', color: '#71717a' }}>Add Life Manager to your home screen for quick access and a better experience.</p>
        </div>

        {isIOS ? (
          <div style={{ padding: '1rem', borderRadius: '0.75rem', backgroundColor: '#27272a', marginBottom: '1rem' }}>
            <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#fafafa', marginBottom: '0.75rem' }}>For iPhone/iPad (Safari):</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '0.875rem', color: '#8b5cf6', fontWeight: 600 }}>1.</span>
                <span style={{ fontSize: '0.8125rem', color: '#a1a1aa' }}>Tap the <strong style={{ color: '#fafafa' }}>Share</strong> button at the bottom (square with arrow ↑)</span>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '0.875rem', color: '#8b5cf6', fontWeight: 600 }}>2.</span>
                <span style={{ fontSize: '0.8125rem', color: '#a1a1aa' }}>Scroll down and tap <strong style={{ color: '#fafafa' }}>"Add to Home Screen"</strong></span>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '0.875rem', color: '#8b5cf6', fontWeight: 600 }}>3.</span>
                <span style={{ fontSize: '0.8125rem', color: '#a1a1aa' }}>Tap <strong style={{ color: '#fafafa' }}>"Add"</strong></span>
              </div>
            </div>
          </div>
        ) : isAndroid ? (
          <div style={{ padding: '1rem', borderRadius: '0.75rem', backgroundColor: '#27272a', marginBottom: '1rem' }}>
            <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#fafafa', marginBottom: '0.75rem' }}>For Android (Chrome):</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '0.875rem', color: '#8b5cf6', fontWeight: 600 }}>1.</span>
                <span style={{ fontSize: '0.8125rem', color: '#a1a1aa' }}>Tap the <strong style={{ color: '#fafafa' }}>menu icon</strong> (three dots ⋮) in the top right</span>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '0.875rem', color: '#8b5cf6', fontWeight: 600 }}>2.</span>
                <span style={{ fontSize: '0.8125rem', color: '#a1a1aa' }}>Tap <strong style={{ color: '#fafafa' }}>"Add to Home Screen"</strong> or <strong style={{ color: '#fafafa' }}>"Install App"</strong></span>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '0.875rem', color: '#8b5cf6', fontWeight: 600 }}>3.</span>
                <span style={{ fontSize: '0.8125rem', color: '#a1a1aa' }}>Tap <strong style={{ color: '#fafafa' }}>"Add"</strong></span>
              </div>
            </div>
          </div>
        ) : null}

        <button onClick={dismissHomeScreenPopup} style={{ ...styles.btn('primary'), width: '100%' }}>Got it</button>
      </Modal>

      {/* Welcome Sync Modal */}
      <Modal isOpen={showWelcomeSync} onClose={dismissWelcomeSync} title="☁️ Set Up Cloud Sync">
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <p style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>🔄</p>
          <p style={{ fontSize: '0.9375rem', color: '#fafafa', marginBottom: '0.5rem' }}>Sync your data across devices</p>
          <p style={{ fontSize: '0.8125rem', color: '#71717a' }}>Enter a personal code to backup and access your habits, goals, and tasks from anywhere.</p>
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <input
              type="text"
              value={syncCodeInput}
              onChange={(e) => setSyncCodeInput(e.target.value.toUpperCase())}
              placeholder="e.g. LIFEMANAGER"
              style={{ ...styles.input, flex: 1, fontFamily: 'JetBrains Mono, monospace', textTransform: 'uppercase' }}
              onKeyDown={(e) => { if (e.key === 'Enter' && syncCodeInput.trim()) { connectSyncCode(); dismissWelcomeSync(); } }}
            />
          </div>
          <p style={{ fontSize: '0.6875rem', color: '#71717a' }}>Codes are not case-sensitive</p>
        </div>
        <button
          onClick={() => { if (syncCodeInput.trim()) { connectSyncCode(); dismissWelcomeSync(); } }}
          disabled={isSyncing || !syncCodeInput.trim()}
          style={{ ...styles.btn('primary'), width: '100%', marginBottom: '0.75rem', opacity: (isSyncing || !syncCodeInput.trim()) ? 0.7 : 1 }}
        >
          {isSyncing ? 'Connecting...' : 'Connect'}
        </button>
        <button onClick={dismissWelcomeSync} style={{ ...styles.btn(), width: '100%', marginBottom: '1rem' }}>Skip for Now</button>
        <p style={{ fontSize: '0.75rem', color: '#71717a', textAlign: 'center' }}>You can view or change your code anytime in the Backup menu.</p>
      </Modal>

      {/* Delete Habit Modal */}
      <Modal isOpen={!!deleteHabitModal} onClose={() => { setDeleteHabitModal(null); setDeleteConfirmText(''); }} title="Delete Habit">
        {deleteHabitModal && (
          <>
            <p style={{ color: '#a1a1aa', marginBottom: '1rem' }}>"{deleteHabitModal.name}"</p>
            <button onClick={() => removeHabitFromToday(deleteHabitModal.id)} style={{ width: '100%', padding: '1rem', borderRadius: '0.75rem', border: '2px solid #27272a', backgroundColor: '#27272a', color: '#fafafa', cursor: 'pointer', textAlign: 'left', marginBottom: '0.75rem' }}>
              <div style={{ fontWeight: 500, marginBottom: '0.25rem' }}>Remove from {getViewingDateLabel()}</div>
              <div style={{ fontSize: '0.8125rem', color: '#71717a' }}>Clears today's data only. Habit stays in your list.</div>
            </button>
            <div style={{ padding: '1rem', borderRadius: '0.75rem', border: '2px solid rgba(239,68,68,0.3)', backgroundColor: 'rgba(239,68,68,0.1)' }}>
              <div style={{ fontWeight: 500, color: '#f87171', marginBottom: '0.5rem' }}>Delete permanently</div>
              <div style={{ fontSize: '0.8125rem', color: '#71717a', marginBottom: '0.75rem' }}>Removes habit and all history. Type <span style={{ color: '#f87171', fontFamily: 'JetBrains Mono, monospace' }}>delete</span> to confirm.</div>
              <input type="text" value={deleteConfirmText} onChange={(e) => setDeleteConfirmText(e.target.value)} placeholder='Type "delete"' style={{ ...styles.input, marginBottom: '0.75rem', fontSize: '0.875rem' }} />
              <button onClick={() => deleteHabit(deleteHabitModal.id)} disabled={deleteConfirmText.toLowerCase() !== 'delete'} style={{ ...styles.btn('danger'), width: '100%', opacity: deleteConfirmText.toLowerCase() !== 'delete' ? 0.5 : 1, cursor: deleteConfirmText.toLowerCase() !== 'delete' ? 'not-allowed' : 'pointer' }}>Delete Forever</button>
            </div>
            <button onClick={() => { setDeleteHabitModal(null); setDeleteConfirmText(''); }} style={{ ...styles.btn(), width: '100%', marginTop: '1rem' }}>Cancel</button>
          </>
        )}
      </Modal>


    </div>
  );
}
