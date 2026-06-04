import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import SignIn from '@/components/SignIn';
import { Palette, useTheme } from '@/components/theme';
import { signOut, subscribeAuth } from '@/lib/auth';
import { addDays, formatHuman, isToday, localDateStr } from '@/lib/dates';
import {
  DayData,
  isSupabaseConfigured,
  loadContacts,
  loadDay,
  loadReference,
  setDayNote,
  setSymptom,
  clearSymptom,
  syncFromServer,
  toggleMedTaken,
} from '@/lib/tracker';
import { symptomSeverity, redFlagMessage, Severity } from '@/lib/trackerLogic';
import { CareContact, ReferenceItem, SymptomDef } from '@/lib/trackerTypes';

type Tab = 'daily' | 'diet' | 'watch';

// ── root: connection + auth gate ─────────────────────────────────────────────
export default function Root() {
  const c = useTheme();
  const [userId, setUserId] = useState<string | null | undefined>(undefined);

  useEffect(() => subscribeAuth((id) => setUserId(id)), []);

  if (!isSupabaseConfigured) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: c.bg }]}>
        <Text style={[styles.notice, { color: c.text }]} accessibilityRole="header">
          Not connected yet
        </Text>
        <Text style={[styles.noticeSub, { color: c.sub }]}>
          Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to your .env, then restart.
        </Text>
      </SafeAreaView>
    );
  }
  if (userId === undefined) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: c.bg }]}>
        <ActivityIndicator color={c.accent} accessibilityLabel="Loading" />
      </SafeAreaView>
    );
  }
  if (userId === null) return <SignIn />;
  return <Tracker />;
}

// ── main tracker ─────────────────────────────────────────────────────────────
function Tracker() {
  const c = useTheme();
  const [tab, setTab] = useState<Tab>('daily');
  const [date, setDate] = useState(localDateStr());
  const [day, setDay] = useState<DayData | null>(null);
  const [ref, setRef] = useState<{ good: ReferenceItem[]; avoid: ReferenceItem[]; watch: ReferenceItem[] } | null>(null);
  const [contacts, setContacts] = useState<CareContact[]>([]);

  const refresh = useCallback(async (forDate: string) => {
    const [d, r, ct] = await Promise.all([loadDay(forDate), loadReference(), loadContacts()]);
    setDay(d);
    setRef(r);
    setContacts(ct);
  }, []);

  useEffect(() => {
    void refresh(date);
  }, [date, refresh]);

  useEffect(() => {
    void syncFromServer().then((s) => {
      if (s.synced) void refresh(date);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onToggleMed = useCallback(
    async (medId: string) => {
      await toggleMedTaken(medId, date);
      await refresh(date);
    },
    [date, refresh],
  );

  const onSymptom = useCallback(
    async (def: SymptomDef, value: number, current: number | null) => {
      if (current === value) await clearSymptom(def.key, date);
      else await setSymptom(def.key, date, value);
      await refresh(date);
    },
    [date, refresh],
  );

  const onSaveNote = useCallback(
    async (body: string) => {
      await setDayNote(date, body);
    },
    [date],
  );

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: c.bg }]} edges={['top']}>
      <View style={styles.header}>
        <Text style={[styles.appTitle, { color: c.text }]} accessibilityRole="header">
          Daily Care Tracker
        </Text>
        <Pressable
          onPress={signOut}
          accessibilityRole="button"
          accessibilityLabel="Sign out"
          hitSlop={8}
          style={[styles.signout, { borderColor: c.line }]}
        >
          <Text style={[styles.signoutText, { color: c.sub }]}>Sign out</Text>
        </Pressable>
      </View>

      <View style={styles.tabs}>
        {(['daily', 'diet', 'watch'] as Tab[]).map((t) => (
          <Pressable
            key={t}
            onPress={() => setTab(t)}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === t }}
            accessibilityLabel={t === 'daily' ? 'Daily log' : t === 'diet' ? 'Diet' : 'Watch for'}
            style={[
              styles.tab,
              { borderColor: c.line },
              tab === t && { backgroundColor: c.accent, borderColor: c.accent },
            ]}
          >
            <Text style={[styles.tabText, { color: tab === t ? c.accentText : c.sub }]}>
              {t === 'daily' ? 'Daily log' : t === 'diet' ? 'Diet' : 'Watch for'}
            </Text>
          </Pressable>
        ))}
      </View>

      {tab === 'daily' && (
        <DailyTab
          c={c}
          date={date}
          day={day}
          onPrev={() => setDate(addDays(date, -1))}
          onNext={() => setDate(addDays(date, 1))}
          onToday={() => setDate(localDateStr())}
          onToggleMed={onToggleMed}
          onSymptom={onSymptom}
          onSaveNote={onSaveNote}
        />
      )}
      {tab === 'diet' && <DietTab c={c} reference={ref} />}
      {tab === 'watch' && <WatchTab c={c} watch={ref?.watch ?? []} contacts={contacts} />}
    </SafeAreaView>
  );
}

// ── Daily tab ────────────────────────────────────────────────────────────────
function DailyTab({
  c,
  date,
  day,
  onPrev,
  onNext,
  onToday,
  onToggleMed,
  onSymptom,
  onSaveNote,
}: {
  c: Palette;
  date: string;
  day: DayData | null;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onToggleMed: (medId: string) => void;
  onSymptom: (def: SymptomDef, value: number, current: number | null) => void;
  onSaveNote: (body: string) => void;
}) {
  return (
    <ScrollView contentContainerStyle={styles.body}>
      <View style={styles.dateBar}>
        <NavBtn c={c} glyph="‹" label="Previous day" onPress={onPrev} />
        <View style={styles.dateMid}>
          <Text style={[styles.dateLabel, { color: c.text }]}>
            {isToday(date) ? 'Today' : formatHuman(date)}
          </Text>
          {!isToday(date) && (
            <Pressable onPress={onToday} accessibilityRole="button" accessibilityLabel="Go to today">
              <Text style={[styles.todayLink, { color: c.accent }]}>Go to today</Text>
            </Pressable>
          )}
        </View>
        <NavBtn c={c} glyph="›" label="Next day" onPress={onNext} />
      </View>

      {day == null ? (
        <ActivityIndicator color={c.accent} accessibilityLabel="Loading your day" />
      ) : day.medGroups.length === 0 ? (
        <Text style={[styles.muted, { color: c.sub }]}>
          No medications loaded yet. Run your seed in Supabase, then pull to refresh.
        </Text>
      ) : (
        <>
          <ProgressBar c={c} done={day.progress.done} total={day.progress.total} />
          {day.medGroups.map((g) => (
            <View key={g.block} style={[styles.card, { backgroundColor: c.card, borderColor: c.line }]}>
              <Text style={[styles.blockTitle, { color: c.text }]}>{g.label}</Text>
              {g.items.map((it) => (
                <MedRow
                  key={it.med.id}
                  c={c}
                  name={it.med.name}
                  dose={it.med.dose}
                  tag={it.med.tag}
                  note={it.med.note}
                  taken={it.status === 'taken'}
                  onToggle={() => onToggleMed(it.med.id)}
                />
              ))}
            </View>
          ))}

          {day.symptoms.length > 0 && (
            <View style={[styles.card, { backgroundColor: c.card, borderColor: c.line }]}>
              <Text style={[styles.blockTitle, { color: c.text }]}>How he&apos;s doing today</Text>
              {day.symptoms.map((s) => (
                <SymptomQuestion
                  key={s.def.key}
                  c={c}
                  def={s.def}
                  value={s.value}
                  onSelect={(v) => onSymptom(s.def, v, s.value)}
                />
              ))}
            </View>
          )}

          <View style={[styles.card, { backgroundColor: c.card, borderColor: c.line }]}>
            <Text style={[styles.blockTitle, { color: c.text }]}>Notes for the day</Text>
            <NoteEditor key={date} c={c} initial={day.note} onSave={onSaveNote} />
          </View>
        </>
      )}
    </ScrollView>
  );
}

function ProgressBar({ c, done, total }: { c: Palette; done: number; total: number }) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <View style={styles.progressWrap} accessibilityLabel={`${done} of ${total} scheduled doses done`}>
      <Text style={[styles.progressText, { color: c.sub }]}>
        {done} of {total} scheduled doses done
      </Text>
      <View style={[styles.barTrack, { backgroundColor: c.line }]}>
        <View style={[styles.barFill, { backgroundColor: c.accent, width: `${pct}%` }]} />
      </View>
    </View>
  );
}

function MedRow({
  c,
  name,
  dose,
  tag,
  note,
  taken,
  onToggle,
}: {
  c: Palette;
  name: string;
  dose: string | null;
  tag: string | null;
  note: string | null;
  taken: boolean;
  onToggle: () => void;
}) {
  const label = `${name}${dose ? `, ${dose}` : ''}${tag ? `, ${tag}` : ''}`;
  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: taken }}
      accessibilityLabel={label}
      style={[styles.medRow, taken && { backgroundColor: c.doneBg }]}
    >
      <View style={[styles.checkbox, { borderColor: c.accent }, taken && { backgroundColor: c.accent }]}>
        {taken && <Text style={[styles.check, { color: c.accentText }]}>✓</Text>}
      </View>
      <View style={styles.medText}>
        <Text style={[styles.medName, { color: c.text }]}>
          {name}
          {tag ? <Text style={[styles.tag, { color: c.warnText }]}> · {tag}</Text> : null}
        </Text>
        {dose ? <Text style={[styles.medDose, { color: c.sub }]}>{dose}</Text> : null}
        {note ? <Text style={[styles.medNote, { color: c.sub }]}>{note}</Text> : null}
      </View>
    </Pressable>
  );
}

function SymptomQuestion({
  c,
  def,
  value,
  onSelect,
}: {
  c: Palette;
  def: SymptomDef;
  value: number | null;
  onSelect: (v: number) => void;
}) {
  const sev: Severity = symptomSeverity(def, value);
  const sevBg = sev === 'red' ? c.redBg : sev === 'warn' ? c.warnBg : sev === 'ok' ? c.okBg : c.accent;
  const sevText = sev === 'red' ? c.redText : sev === 'warn' ? c.warnText : sev === 'ok' ? c.okText : c.accentText;
  const flag = redFlagMessage(def, value);
  return (
    <View style={styles.symptom}>
      <Text style={[styles.symptomQ, { color: c.text }]}>{def.question}</Text>
      <View style={styles.segRow}>
        {def.options.map((opt, i) => {
          const selected = value === i;
          return (
            <Pressable
              key={opt}
              onPress={() => onSelect(i)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={`${def.question}: ${opt}`}
              style={[
                styles.seg,
                { borderColor: c.line },
                selected && { backgroundColor: sevBg, borderColor: sevBg },
              ]}
            >
              <Text style={[styles.segText, { color: selected ? sevText : c.sub }]}>{opt}</Text>
            </Pressable>
          );
        })}
      </View>
      {flag && (
        <Text style={[styles.redFlag, { color: c.redText, backgroundColor: c.redBg }]}>{flag}</Text>
      )}
    </View>
  );
}

function NoteEditor({ c, initial, onSave }: { c: Palette; initial: string; onSave: (b: string) => void }) {
  const [text, setText] = useState(initial);
  return (
    <TextInput
      value={text}
      onChangeText={setText}
      onEndEditing={() => onSave(text)}
      multiline
      placeholder="How he felt, appetite, sleep, anything to tell the doctor…"
      placeholderTextColor={c.sub}
      accessibilityLabel="Notes for the day"
      style={[styles.note, { color: c.text, borderColor: c.line }]}
    />
  );
}

// ── Diet tab ─────────────────────────────────────────────────────────────────
function DietTab({
  c,
  reference,
}: {
  c: Palette;
  reference: { good: ReferenceItem[]; avoid: ReferenceItem[]; watch: ReferenceItem[] } | null;
}) {
  return (
    <ScrollView contentContainerStyle={styles.body}>
      <PillSection c={c} title="Good to use" tone="ok" items={reference?.good ?? []} />
      <PillSection c={c} title="Avoid in Phase 1" tone="red" items={reference?.avoid ?? []} />
    </ScrollView>
  );
}

function PillSection({
  c,
  title,
  tone,
  items,
}: {
  c: Palette;
  title: string;
  tone: 'ok' | 'red';
  items: ReferenceItem[];
}) {
  const bg = tone === 'ok' ? c.okBg : c.redBg;
  const fg = tone === 'ok' ? c.okText : c.redText;
  return (
    <View style={[styles.card, { backgroundColor: c.card, borderColor: c.line }]}>
      <Text style={[styles.blockTitle, { color: c.text }]}>{title}</Text>
      <View style={styles.pillWrap}>
        {items.map((i) => (
          <Text key={i.id} style={[styles.pill, { backgroundColor: bg, color: fg }]}>
            {i.title}
          </Text>
        ))}
      </View>
    </View>
  );
}

// ── Watch tab ────────────────────────────────────────────────────────────────
function WatchTab({
  c,
  watch,
  contacts,
}: {
  c: Palette;
  watch: ReferenceItem[];
  contacts: CareContact[];
}) {
  return (
    <ScrollView contentContainerStyle={styles.body}>
      {watch.map((w) => (
        <View key={w.id} style={[styles.card, { backgroundColor: c.card, borderColor: c.line }]}>
          <Text style={[styles.blockTitle, { color: c.text }]}>{w.title}</Text>
          {w.body ? <Text style={[styles.watchBody, { color: c.sub }]}>{w.body}</Text> : null}
        </View>
      ))}
      {contacts.length > 0 && (
        <View style={[styles.card, { backgroundColor: c.card, borderColor: c.line }]}>
          <Text style={[styles.blockTitle, { color: c.text }]}>Contacts</Text>
          {contacts.map((ct) => (
            <Text key={ct.id} style={[styles.contact, { color: c.text }]}>
              {ct.label}: {[ct.name, ct.phone].filter(Boolean).join(' · ')}
            </Text>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

function NavBtn({
  c,
  glyph,
  label,
  onPress,
}: {
  c: Palette;
  glyph: string;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[styles.navBtn, { borderColor: c.line }]}
    >
      <Text style={[styles.navGlyph, { color: c.text }]}>{glyph}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 },
  notice: { fontSize: 22, fontWeight: '700' },
  noticeSub: { fontSize: 15, textAlign: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  appTitle: { fontSize: 24, fontWeight: '700' },
  signout: { minHeight: 36, paddingHorizontal: 12, borderWidth: 1, borderRadius: 999, justifyContent: 'center' },
  signoutText: { fontSize: 13, fontWeight: '600' },
  tabs: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 12 },
  tab: { minHeight: 40, paddingHorizontal: 14, borderWidth: 1, borderRadius: 999, justifyContent: 'center' },
  tabText: { fontSize: 14, fontWeight: '600' },
  body: { padding: 16, paddingBottom: 48, gap: 14 },
  dateBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dateMid: { alignItems: 'center', flex: 1 },
  dateLabel: { fontSize: 19, fontWeight: '700' },
  todayLink: { fontSize: 13, fontWeight: '600', marginTop: 2 },
  navBtn: { width: 44, height: 44, borderWidth: 1, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  navGlyph: { fontSize: 24, lineHeight: 26 },
  muted: { fontSize: 15, lineHeight: 22 },
  card: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 4 },
  blockTitle: { fontSize: 16, fontWeight: '700', marginBottom: 6 },
  progressWrap: { gap: 6 },
  progressText: { fontSize: 13 },
  barTrack: { height: 8, borderRadius: 99, overflow: 'hidden' },
  barFill: { height: '100%' },
  medRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 10, paddingHorizontal: 6, borderRadius: 10, minHeight: 56 },
  checkbox: { width: 26, height: 26, borderRadius: 7, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  check: { fontSize: 16, fontWeight: '900', lineHeight: 18 },
  medText: { flex: 1 },
  medName: { fontSize: 16, fontWeight: '600' },
  tag: { fontSize: 13, fontWeight: '700' },
  medDose: { fontSize: 13, marginTop: 1 },
  medNote: { fontSize: 13, marginTop: 3, fontStyle: 'italic' },
  symptom: { marginBottom: 12 },
  symptomQ: { fontSize: 14, fontWeight: '600', marginBottom: 7 },
  segRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  seg: { minHeight: 40, paddingHorizontal: 14, borderWidth: 1, borderRadius: 10, justifyContent: 'center' },
  segText: { fontSize: 14, fontWeight: '600' },
  redFlag: { marginTop: 8, padding: 9, borderRadius: 10, fontSize: 13, fontWeight: '600' },
  note: { minHeight: 90, borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 15, textAlignVertical: 'top' },
  pillWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pill: { fontSize: 13, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999, overflow: 'hidden' },
  watchBody: { fontSize: 14, lineHeight: 20 },
  contact: { fontSize: 14, marginBottom: 4 },
});
