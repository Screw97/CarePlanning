import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  addStarterTasks,
  addTask,
  hasAnyTasks,
  isSupabaseConfigured,
  loadChecklist,
  syncFromServer,
  toggleStatus,
} from '@/lib/careTasks';
import {
  addDays,
  dayOfMonth,
  formatHuman,
  isPast,
  isToday,
  localDateStr,
  weekDates,
  weekdayShort,
} from '@/lib/dates';
import { CareTaskCategory, ChecklistItem } from '@/lib/types';

const CATEGORY_ORDER: CareTaskCategory[] = [
  'meals',
  'hygiene',
  'household',
  'health',
  'other',
];
const CATEGORY_LABEL: Record<CareTaskCategory, string> = {
  meals: 'Meals',
  hygiene: 'Hygiene',
  household: 'Household',
  health: 'Health',
  other: 'Other',
};

function statusWord(item: ChecklistItem, dateStr: string): string {
  if (item.status === 'done') return 'Done';
  if (item.status === 'skipped') return 'Skipped';
  return isPast(dateStr) ? 'Missed' : 'To do';
}

function groupByCategory(
  items: ChecklistItem[],
): { category: CareTaskCategory; items: ChecklistItem[] }[] {
  return CATEGORY_ORDER.map((category) => ({
    category,
    items: items.filter((i) => i.task.category === category),
  })).filter((g) => g.items.length > 0);
}

export default function CalendarChecklistScreen() {
  const scheme = useColorScheme();
  const c = scheme === 'dark' ? DARK : LIGHT;

  const [date, setDate] = useState<string>(localDateStr());
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [empty, setEmpty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [newTitle, setNewTitle] = useState('');

  const refresh = useCallback(async (forDate: string) => {
    const [list, any] = await Promise.all([loadChecklist(forDate), hasAnyTasks()]);
    setItems(list);
    setEmpty(!any);
    setLoading(false);
  }, []);

  // Reload whenever the selected day changes.
  useEffect(() => {
    setLoading(true);
    void refresh(date);
  }, [date, refresh]);

  // Best-effort pull from the server once on mount; never blocks the UI.
  useEffect(() => {
    void syncFromServer().then((r) => {
      if (r.synced) void refresh(date);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onToggle = useCallback(
    async (item: ChecklistItem, target: 'done' | 'skipped') => {
      await toggleStatus(item, date, target);
      await refresh(date);
    },
    [date, refresh],
  );

  const onAddStarter = useCallback(async () => {
    await addStarterTasks();
    await refresh(date);
  }, [date, refresh]);

  const onAddCustom = useCallback(async () => {
    const title = newTitle.trim();
    if (!title) return;
    setNewTitle('');
    await addTask({ title, recurrence_type: 'daily' });
    await refresh(date);
  }, [newTitle, date, refresh]);

  const days = weekDates(date);
  const groups = groupByCategory(items);

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: c.bg }]} edges={['top']}>
      {/* Header: date + day navigation */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: c.text }]} accessibilityRole="header">
          {isToday(date) ? 'Today' : formatHuman(date)}
        </Text>
        <View style={styles.navRow}>
          <NavButton label="Previous day" glyph="‹" c={c} onPress={() => setDate(addDays(date, -1))} />
          <Pressable
            onPress={() => setDate(localDateStr())}
            accessibilityRole="button"
            accessibilityLabel="Jump to today"
            style={[styles.todayBtn, { borderColor: c.border }]}
          >
            <Text style={[styles.todayBtnText, { color: c.accent }]}>Today</Text>
          </Pressable>
          <NavButton label="Next day" glyph="›" c={c} onPress={() => setDate(addDays(date, 1))} />
        </View>
      </View>

      {/* Week strip */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.weekStrip}
        accessibilityLabel="Week days"
      >
        {days.map((d) => {
          const selected = d === date;
          return (
            <Pressable
              key={d}
              onPress={() => setDate(d)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={formatHuman(d)}
              style={[
                styles.dayChip,
                { borderColor: c.border },
                selected && { backgroundColor: c.accent, borderColor: c.accent },
              ]}
            >
              <Text style={[styles.dayChipWd, { color: selected ? c.accentText : c.sub }]}>
                {weekdayShort(d)}
              </Text>
              <Text style={[styles.dayChipNum, { color: selected ? c.accentText : c.text }]}>
                {dayOfMonth(d)}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {!isSupabaseConfigured && (
        <Text style={[styles.banner, { color: c.sub, backgroundColor: c.card }]}>
          Saved on this device. Connect Supabase to back up &amp; sync.
        </Text>
      )}

      {/* Body */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={c.accent} accessibilityLabel="Loading your day" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.body}>
          {empty ? (
            <EmptyState c={c} onAddStarter={onAddStarter} />
          ) : items.length === 0 ? (
            <Text style={[styles.muted, { color: c.sub }]}>
              Nothing scheduled for {formatHuman(date)}.
            </Text>
          ) : (
            groups.map((g) => (
              <View key={g.category} style={styles.section}>
                <Text style={[styles.sectionTitle, { color: c.sub }]}>
                  {CATEGORY_LABEL[g.category]}
                </Text>
                {g.items.map((item) => (
                  <TaskRow
                    key={item.task.id}
                    item={item}
                    dateStr={date}
                    c={c}
                    onDone={() => onToggle(item, 'done')}
                    onSkip={() => onToggle(item, 'skipped')}
                  />
                ))}
              </View>
            ))
          )}

          {/* Quick add */}
          <View style={[styles.addRow, { borderColor: c.border }]}>
            <TextInput
              value={newTitle}
              onChangeText={setNewTitle}
              placeholder="Add a daily task…"
              placeholderTextColor={c.sub}
              accessibilityLabel="New task title"
              style={[styles.input, { color: c.text }]}
              returnKeyType="done"
              onSubmitEditing={onAddCustom}
            />
            <Pressable
              onPress={onAddCustom}
              accessibilityRole="button"
              accessibilityLabel="Add task"
              style={[styles.addBtn, { backgroundColor: c.accent }]}
            >
              <Text style={[styles.addBtnText, { color: c.accentText }]}>Add</Text>
            </Pressable>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function NavButton({
  label,
  glyph,
  onPress,
  c,
}: {
  label: string;
  glyph: string;
  onPress: () => void;
  c: Palette;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[styles.navBtn, { borderColor: c.border }]}
    >
      <Text style={[styles.navBtnText, { color: c.text }]}>{glyph}</Text>
    </Pressable>
  );
}

function TaskRow({
  item,
  dateStr,
  c,
  onDone,
  onSkip,
}: {
  item: ChecklistItem;
  dateStr: string;
  c: Palette;
  onDone: () => void;
  onSkip: () => void;
}) {
  const done = item.status === 'done';
  const skipped = item.status === 'skipped';
  const word = statusWord(item, dateStr);
  const sub = [item.task.time_of_day ? capitalize(item.task.time_of_day) : null, word]
    .filter(Boolean)
    .join(' · ');

  return (
    <View
      style={[
        styles.row,
        { backgroundColor: c.card, borderColor: c.border },
        done && { backgroundColor: c.doneBg },
      ]}
    >
      <Pressable
        onPress={onDone}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: done }}
        accessibilityLabel={`${item.task.title}. ${sub}`}
        accessibilityHint={done ? 'Marks as not done' : 'Marks as done'}
        style={styles.rowMain}
        hitSlop={6}
      >
        <View
          style={[
            styles.checkbox,
            { borderColor: c.accent },
            done && { backgroundColor: c.accent },
          ]}
        >
          {done && <Text style={[styles.checkmark, { color: c.accentText }]}>✓</Text>}
        </View>
        <View style={styles.rowText}>
          <Text style={[styles.rowTitle, { color: c.text }]}>{item.task.title}</Text>
          <Text style={[styles.rowSub, { color: c.sub }]}>{sub}</Text>
        </View>
      </Pressable>
      <Pressable
        onPress={onSkip}
        accessibilityRole="button"
        accessibilityState={{ selected: skipped }}
        accessibilityLabel={skipped ? `Un-skip ${item.task.title}` : `Skip ${item.task.title}`}
        style={[styles.skipBtn, { borderColor: c.border }, skipped && { backgroundColor: c.border }]}
        hitSlop={6}
      >
        <Text style={[styles.skipText, { color: c.sub }]}>Skip</Text>
      </Pressable>
    </View>
  );
}

function EmptyState({ c, onAddStarter }: { c: Palette; onAddStarter: () => void }) {
  return (
    <View style={styles.empty}>
      <Text style={[styles.emptyTitle, { color: c.text }]}>No tasks yet</Text>
      <Text style={[styles.muted, { color: c.sub }]}>
        Add a starter set (brushing teeth, meals, bath, grocery, meal prep) or
        type your own below.
      </Text>
      <Pressable
        onPress={onAddStarter}
        accessibilityRole="button"
        accessibilityLabel="Add starter tasks"
        style={[styles.primaryBtn, { backgroundColor: c.accent }]}
      >
        <Text style={[styles.primaryBtnText, { color: c.accentText }]}>Add starter tasks</Text>
      </Pressable>
    </View>
  );
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ── palettes (WCAG AA, dark + light) ─────────────────────────────────────────
interface Palette {
  bg: string;
  text: string;
  sub: string;
  card: string;
  border: string;
  accent: string;
  accentText: string;
  doneBg: string;
}
const LIGHT: Palette = {
  bg: '#FFFFFF',
  text: '#11181C',
  sub: '#52606D',
  card: '#F4F6F8',
  border: '#CFD6DD',
  accent: '#0A7C42',
  accentText: '#FFFFFF',
  doneBg: '#E4F3EA',
};
const DARK: Palette = {
  bg: '#0C1013',
  text: '#ECEDEE',
  sub: '#9BA1A6',
  card: '#171C20',
  border: '#2B3137',
  accent: '#3FD07F',
  accentText: '#06281A',
  doneBg: '#13301F',
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: { fontSize: 28, fontWeight: '700' },
  navRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  navBtn: {
    minWidth: 44,
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBtnText: { fontSize: 24, lineHeight: 28 },
  todayBtn: {
    minHeight: 44,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayBtnText: { fontSize: 16, fontWeight: '600' },
  weekStrip: { paddingHorizontal: 12, paddingVertical: 12, gap: 8 },
  dayChip: {
    minWidth: 48,
    minHeight: 60,
    borderWidth: 1,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  dayChipWd: { fontSize: 13 },
  dayChipNum: { fontSize: 20, fontWeight: '700' },
  banner: {
    marginHorizontal: 16,
    marginBottom: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    fontSize: 13,
    overflow: 'hidden',
  },
  body: { padding: 16, gap: 8, paddingBottom: 48 },
  section: { marginBottom: 16 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 14,
    marginBottom: 8,
    paddingRight: 8,
  },
  rowMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 60,
    paddingVertical: 8,
    paddingLeft: 12,
    gap: 12,
  },
  checkbox: {
    width: 30,
    height: 30,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmark: { fontSize: 18, fontWeight: '900', lineHeight: 20 },
  rowText: { flex: 1 },
  rowTitle: { fontSize: 17, fontWeight: '600' },
  rowSub: { fontSize: 13, marginTop: 2 },
  skipBtn: {
    minWidth: 56,
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipText: { fontSize: 14, fontWeight: '600' },
  muted: { fontSize: 15, lineHeight: 22 },
  empty: { alignItems: 'flex-start', gap: 12, marginBottom: 16 },
  emptyTitle: { fontSize: 22, fontWeight: '700' },
  primaryBtn: {
    minHeight: 48,
    paddingHorizontal: 18,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: { fontSize: 16, fontWeight: '700' },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderTopWidth: 1,
    paddingTop: 16,
    marginTop: 8,
  },
  input: {
    flex: 1,
    minHeight: 48,
    fontSize: 16,
    paddingHorizontal: 4,
  },
  addBtn: {
    minHeight: 48,
    paddingHorizontal: 18,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnText: { fontSize: 16, fontWeight: '700' },
});
