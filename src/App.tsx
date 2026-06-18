import {
  BookOpen,
  Calculator,
  CheckCircle2,
  ClipboardList,
  ExternalLink,
  GraduationCap,
  Info,
  Plus,
  RotateCcw,
  Save,
  Trash2,
} from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';

type ExamWeightPreset = 'secondary45' | 'custom';

type GradeScenario = {
  id: string;
  courseName: string;
  studentName: string;
  term1: string;
  term2: string;
  term3: string;
  targetGrade: string;
  examWeight: string;
  plannedExamGrade: string;
  preset: ExamWeightPreset;
};

type CalculationResult = {
  schoolGrade: number;
  requiredExamGrade: number;
  projectedFinalGrade: number | null;
  hasAllTerms: boolean;
  message: string;
  tone: 'good' | 'warning' | 'danger';
};

const storageKey = 'quebec-ministry-exam-calculator-v1';

const defaultScenario: GradeScenario = {
  id: 'current',
  courseName: 'Secondary 4 Mathematics',
  studentName: '',
  term1: '',
  term2: '',
  term3: '',
  targetGrade: '60',
  examWeight: '50',
  plannedExamGrade: '',
  preset: 'secondary45',
};

const termWeights = [
  { id: 'term1', label: 'Term 1', weight: 20 },
  { id: 'term2', label: 'Term 2', weight: 20 },
  { id: 'term3', label: 'Term 3', weight: 60 },
] as const;

const officialLinks = [
  {
    label: 'Quebec final results for Secondary 4 and 5',
    url: 'https://www.quebec.ca/education/prescolaire-primaire-et-secondaire/programmes-formations-evaluation/epreuves-ministerielles-evaluation-apprentissages/resultats-finaux',
  },
  {
    label: 'Quebec secondary report-card subject weightings',
    url: 'https://www.quebec.ca/education/prescolaire-primaire-et-secondaire/programmes-formations-evaluation/epreuves-ministerielles-evaluation-apprentissages/ponderations-libelles-bulletin/secondaire',
  },
];

function makeId() {
  return `scenario-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function clampPercent(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(100, Math.max(0, value));
}

function parsePercent(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? clampPercent(parsed) : 0;
}

function formatPercent(value: number) {
  return `${value.toFixed(1).replace(/\.0$/, '')}%`;
}

function calculateScenario(scenario: GradeScenario): CalculationResult {
  const grades = termWeights.map((term) => parsePercent(scenario[term.id]));
  const hasAllTerms = termWeights.every((term) => scenario[term.id].trim() !== '');
  const schoolGrade = grades.reduce(
    (total, grade, index) => total + grade * (termWeights[index].weight / 100),
    0,
  );
  const targetGrade = parsePercent(scenario.targetGrade || '60');
  const examWeight = parsePercent(scenario.examWeight || '50') / 100;
  const schoolWeight = 1 - examWeight;
  const requiredExamGrade =
    examWeight > 0 ? (targetGrade - schoolGrade * schoolWeight) / examWeight : targetGrade;
  const plannedExamGrade =
    scenario.plannedExamGrade.trim() === '' ? null : parsePercent(scenario.plannedExamGrade);
  const projectedFinalGrade =
    plannedExamGrade === null ? null : schoolGrade * schoolWeight + plannedExamGrade * examWeight;

  if (!hasAllTerms) {
    return {
      schoolGrade,
      requiredExamGrade,
      projectedFinalGrade,
      hasAllTerms,
      message: 'Enter all three term grades to calculate the required exam mark.',
      tone: 'warning',
    };
  }

  if (requiredExamGrade <= 0) {
    return {
      schoolGrade,
      requiredExamGrade,
      projectedFinalGrade,
      hasAllTerms,
      message: 'The entered school result already reaches the target in the simple weighted model.',
      tone: 'good',
    };
  }

  if (requiredExamGrade > 100) {
    return {
      schoolGrade,
      requiredExamGrade,
      projectedFinalGrade,
      hasAllTerms,
      message: 'The target cannot be reached with a 100% exam mark in the simple weighted model.',
      tone: 'danger',
    };
  }

  return {
    schoolGrade,
    requiredExamGrade,
    projectedFinalGrade,
    hasAllTerms,
    message: `A ministry exam mark of ${formatPercent(requiredExamGrade)} is required to reach ${formatPercent(
      targetGrade,
    )}.`,
    tone: requiredExamGrade <= 60 ? 'good' : 'warning',
  };
}

function loadScenarios() {
  if (typeof window === 'undefined') {
    return [defaultScenario];
  }

  const saved = window.localStorage.getItem(storageKey);
  if (!saved) {
    return [defaultScenario];
  }

  try {
    const parsed = JSON.parse(saved) as GradeScenario[];
    return parsed.length ? parsed : [defaultScenario];
  } catch {
    return [defaultScenario];
  }
}

function ResultCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <p className="label">{label}</p>
      <p className="mt-2 text-3xl font-bold text-slate-950">{value}</p>
      <p className="mt-2 text-sm leading-5 text-slate-600">{helper}</p>
    </article>
  );
}

function App() {
  const [scenarios, setScenarios] = useState<GradeScenario[]>(() => loadScenarios());
  const [activeScenarioId, setActiveScenarioId] = useState(() => scenarios[0]?.id ?? 'current');

  const activeScenario =
    scenarios.find((scenario) => scenario.id === activeScenarioId) ?? scenarios[0] ?? defaultScenario;

  const result = useMemo(() => calculateScenario(activeScenario), [activeScenario]);

  useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify(scenarios));
  }, [scenarios]);

  function updateScenario<K extends keyof GradeScenario>(field: K, value: GradeScenario[K]) {
    setScenarios((current) =>
      current.map((scenario) =>
        scenario.id === activeScenario.id ? { ...scenario, [field]: value } : scenario,
      ),
    );
  }

  function handlePresetChange(preset: ExamWeightPreset) {
    updateScenario('preset', preset);
    if (preset === 'secondary45') {
      updateScenario('examWeight', '50');
    }
  }

  function saveScenario(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    window.localStorage.setItem(storageKey, JSON.stringify(scenarios));
  }

  function addScenario() {
    const nextScenario = {
      ...defaultScenario,
      id: makeId(),
      courseName: 'New course',
    };
    setScenarios((current) => [...current, nextScenario]);
    setActiveScenarioId(nextScenario.id);
  }

  function removeScenario(id: string) {
    setScenarios((current) => {
      const next = current.filter((scenario) => scenario.id !== id);
      const fallback = next[0] ?? { ...defaultScenario, id: makeId() };
      setActiveScenarioId(fallback.id);
      return next.length ? next : [fallback];
    });
  }

  function resetScenario() {
    setScenarios((current) =>
      current.map((scenario) =>
        scenario.id === activeScenario.id
          ? { ...defaultScenario, id: scenario.id, courseName: scenario.courseName }
          : scenario,
      ),
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-red-700 text-white">
              <GraduationCap size={28} />
            </div>
            <div>
              <p className="label">Quebec ministry exam calculator</p>
              <h1 className="text-2xl font-bold tracking-normal text-slate-950 sm:text-3xl">
                Required Exam Grade
              </h1>
            </div>
          </div>
          <button type="button" className="primary-button" onClick={addScenario}>
            <Plus size={20} />
            Add Course
          </button>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-5 px-4 py-5 sm:px-6 lg:grid-cols-[280px_1fr]">
        <aside className="space-y-4">
          <section className="panel p-3">
            <div className="flex items-center gap-2 px-1 py-2">
              <ClipboardList size={20} className="text-red-700" />
              <h2 className="font-bold">Saved Courses</h2>
            </div>
            <div className="mt-2 space-y-2">
              {scenarios.map((scenario) => (
                <button
                  key={scenario.id}
                  type="button"
                  className={`w-full rounded-md border px-3 py-3 text-left text-sm font-bold transition ${
                    scenario.id === activeScenario.id
                      ? 'border-red-700 bg-red-50 text-red-900'
                      : 'border-slate-200 bg-white text-slate-800 hover:border-slate-400'
                  }`}
                  onClick={() => setActiveScenarioId(scenario.id)}
                >
                  {scenario.courseName || 'Untitled course'}
                </button>
              ))}
            </div>
          </section>

          <section className="panel p-4">
            <div className="flex items-start gap-3">
              <Info size={20} className="mt-1 shrink-0 text-red-700" />
              <div>
                <h2 className="font-bold">Official basis</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Quebec states that students need a final result of 60% or more to pass. For
                  Secondary 4 and 5 ministerial exams, the moderated school mark and exam mark each
                  count for 50% for evaluated competencies.
                </p>
              </div>
            </div>
            <div className="mt-4 space-y-2">
              {officialLinks.map((link) => (
                <a
                  key={link.url}
                  className="secondary-button w-full justify-between"
                  href={link.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  <span>{link.label}</span>
                  <ExternalLink size={18} />
                </a>
              ))}
            </div>
          </section>
        </aside>

        <form className="space-y-5" onSubmit={saveScenario}>
          <section className="panel p-4 sm:p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="label">Course setup</p>
                <h2 className="mt-1 text-xl font-bold">School terms and exam weight</h2>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <button type="submit" className="primary-button">
                  <Save size={19} />
                  Save
                </button>
                <button type="button" className="secondary-button" onClick={resetScenario}>
                  <RotateCcw size={19} />
                  Reset
                </button>
                <button
                  type="button"
                  className="secondary-button text-red-800"
                  onClick={() => removeScenario(activeScenario.id)}
                >
                  <Trash2 size={19} />
                  Delete
                </button>
              </div>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="label">Course name</span>
                <input
                  className="field mt-1"
                  value={activeScenario.courseName}
                  onChange={(event) => updateScenario('courseName', event.target.value)}
                  placeholder="Secondary 4 Science"
                />
              </label>
              <label className="block">
                <span className="label">Student name optional</span>
                <input
                  className="field mt-1"
                  value={activeScenario.studentName}
                  onChange={(event) => updateScenario('studentName', event.target.value)}
                  placeholder="Student"
                />
              </label>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {termWeights.map((term) => (
                <label key={term.id} className="block">
                  <span className="label">
                    {term.label} grade ({term.weight}%)
                  </span>
                  <input
                    className="field mt-1 text-lg font-bold"
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    inputMode="decimal"
                    value={activeScenario[term.id]}
                    onChange={(event) => updateScenario(term.id, event.target.value)}
                    placeholder="0-100"
                  />
                </label>
              ))}
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <label className="block md:col-span-2">
                <span className="label">Calculation rule</span>
                <select
                  className="field mt-1"
                  value={activeScenario.preset}
                  onChange={(event) => handlePresetChange(event.target.value as ExamWeightPreset)}
                >
                  <option value="secondary45">Secondary 4/5 ministry exam: 50% exam</option>
                  <option value="custom">Custom exam weight</option>
                </select>
              </label>
              <label className="block">
                <span className="label">Exam weight</span>
                <input
                  className="field mt-1 text-lg font-bold"
                  type="number"
                  min="1"
                  max="100"
                  step="1"
                  inputMode="numeric"
                  value={activeScenario.examWeight}
                  disabled={activeScenario.preset === 'secondary45'}
                  onChange={(event) => updateScenario('examWeight', event.target.value)}
                />
              </label>
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-3">
            <ResultCard
              label="School result"
              value={formatPercent(result.schoolGrade)}
              helper="Term 1 at 20%, Term 2 at 20%, Term 3 at 60%."
            />
            <ResultCard
              label="Required exam"
              value={
                result.hasAllTerms
                  ? result.requiredExamGrade > 100
                    ? '>100%'
                    : formatPercent(Math.max(0, result.requiredExamGrade))
                  : '-'
              }
              helper="Minimum ministry exam mark needed for the target."
            />
            <ResultCard
              label="Target final result"
              value={formatPercent(parsePercent(activeScenario.targetGrade))}
              helper="Default target is the Quebec passing mark."
            />
          </section>

          <section
            className={`rounded-lg border p-4 ${
              result.tone === 'good'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-950'
                : result.tone === 'danger'
                  ? 'border-red-200 bg-red-50 text-red-950'
                  : 'border-amber-200 bg-amber-50 text-amber-950'
            }`}
          >
            <div className="flex items-start gap-3">
              <CheckCircle2 size={22} className="mt-0.5 shrink-0" />
              <div>
                <h2 className="font-bold">Result</h2>
                <p className="mt-1 text-sm leading-6">{result.message}</p>
              </div>
            </div>
          </section>

          <section className="panel p-4 sm:p-5">
            <div className="flex items-center gap-3">
              <Calculator size={22} className="text-red-700" />
              <div>
                <p className="label">What-if check</p>
                <h2 className="text-lg font-bold">Try an expected exam grade</h2>
              </div>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <label className="block">
                <span className="label">Passing target</span>
                <input
                  className="field mt-1 text-lg font-bold"
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  inputMode="decimal"
                  value={activeScenario.targetGrade}
                  onChange={(event) => updateScenario('targetGrade', event.target.value)}
                />
              </label>
              <label className="block">
                <span className="label">Expected exam grade</span>
                <input
                  className="field mt-1 text-lg font-bold"
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  inputMode="decimal"
                  value={activeScenario.plannedExamGrade}
                  onChange={(event) => updateScenario('plannedExamGrade', event.target.value)}
                  placeholder="Optional"
                />
              </label>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <p className="label">Projected final</p>
                <p className="mt-2 text-3xl font-bold">
                  {result.projectedFinalGrade === null
                    ? '-'
                    : formatPercent(result.projectedFinalGrade)}
                </p>
              </div>
            </div>
          </section>

          <section className="panel p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <BookOpen size={22} className="mt-1 shrink-0 text-red-700" />
              <div>
                <h2 className="font-bold">Calculation used</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  School result = Term 1 x 20% + Term 2 x 20% + Term 3 x 60%. Required exam =
                  (target - school result x school weight) / exam weight.
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  This is a planning calculator. Quebec final results may use conversion and
                  moderation, and the official result in the student record is the authority.
                </p>
              </div>
            </div>
          </section>
        </form>
      </main>
    </div>
  );
}

export default App;
