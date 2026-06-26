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

type ExamRule = 'uniform20Bonus' | 'nonUniform' | 'custom';

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
  examRule: ExamRule;
};

type CalculationResult = {
  schoolGrade: number;
  requiredExamGrade: number;
  projectedFinalGrade: number | null;
  examWeight: number;
  finalWithoutExam: number;
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
  examWeight: '20',
  plannedExamGrade: '',
  examRule: 'uniform20Bonus',
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

const uniformCourses = [
  'Sec IV Science and Technology',
  'Sec IV CST Math 414',
  'Sec IV Science Math 426',
  'Sec IV History / Histoire',
  'Sec V English',
  'Sec V French, Second Language',
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

function getExamRule(scenario: GradeScenario & { preset?: 'secondary45' | 'custom' }): ExamRule {
  return scenario.examRule ?? (scenario.preset === 'secondary45' ? 'uniform20Bonus' : 'custom');
}

function calculateProjectedFinal(schoolGrade: number, examGrade: number, examWeight: number, rule: ExamRule) {
  if (rule === 'nonUniform') {
    return schoolGrade;
  }

  if (rule === 'uniform20Bonus' && examGrade > schoolGrade) {
    return examGrade;
  }

  return schoolGrade * (1 - examWeight) + examGrade * examWeight;
}

function calculateRequiredExam(schoolGrade: number, targetGrade: number, examWeight: number, rule: ExamRule) {
  if (rule === 'nonUniform') {
    return targetGrade <= schoolGrade ? 0 : Number.POSITIVE_INFINITY;
  }

  if (rule === 'uniform20Bonus' && targetGrade > schoolGrade) {
    return targetGrade;
  }

  return examWeight > 0 ? (targetGrade - schoolGrade * (1 - examWeight)) / examWeight : targetGrade;
}

function calculateScenario(scenario: GradeScenario): CalculationResult {
  const grades = termWeights.map((term) => parsePercent(scenario[term.id]));
  const hasAllTerms = termWeights.every((term) => scenario[term.id].trim() !== '');
  const schoolGrade = grades.reduce(
    (total, grade, index) => total + grade * (termWeights[index].weight / 100),
    0,
  );
  const targetGrade = parsePercent(scenario.targetGrade || '60');
  const rule = getExamRule(scenario);
  const examWeight = rule === 'nonUniform' ? 0 : parsePercent(scenario.examWeight || '20') / 100;
  const finalWithoutExam = calculateProjectedFinal(schoolGrade, 0, examWeight, rule);
  const requiredExamGrade = calculateRequiredExam(schoolGrade, targetGrade, examWeight, rule);
  const plannedExamGrade =
    scenario.plannedExamGrade.trim() === '' ? null : parsePercent(scenario.plannedExamGrade);
  const projectedFinalGrade =
    plannedExamGrade === null
      ? null
      : calculateProjectedFinal(schoolGrade, plannedExamGrade, examWeight, rule);

  if (!hasAllTerms) {
    return {
      schoolGrade,
      requiredExamGrade,
      projectedFinalGrade,
      examWeight,
      finalWithoutExam,
      hasAllTerms,
      message: 'Enter all three term grades to calculate the required exam mark.',
      tone: 'warning',
    };
  }

  if (rule === 'nonUniform') {
    const reachesTarget = schoolGrade >= targetGrade;
    return {
      schoolGrade,
      requiredExamGrade,
      projectedFinalGrade,
      examWeight,
      finalWithoutExam,
      hasAllTerms,
      message: reachesTarget
        ? 'This course has no uniform MEQ exam, so the school result is the final mark in this calculator.'
        : 'This course has no uniform MEQ exam, so the entered school result does not reach the target.',
      tone: reachesTarget ? 'good' : 'danger',
    };
  }

  if (requiredExamGrade <= 0) {
    return {
      schoolGrade,
      requiredExamGrade,
      projectedFinalGrade,
      examWeight,
      finalWithoutExam,
      hasAllTerms,
      message: 'The entered school result already reaches the target before adding the exam mark.',
      tone: 'good',
    };
  }

  if (requiredExamGrade > 100) {
    return {
      schoolGrade,
      requiredExamGrade,
      projectedFinalGrade,
      examWeight,
      finalWithoutExam,
      hasAllTerms,
      message: 'The target cannot be reached with a 100% exam mark under the selected rule.',
      tone: 'danger',
    };
  }

  return {
    schoolGrade,
    requiredExamGrade,
    projectedFinalGrade,
    examWeight,
    finalWithoutExam,
    hasAllTerms,
    message: `An exam mark of ${formatPercent(requiredExamGrade)} is required to reach ${formatPercent(
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
    return parsed.length
      ? parsed.map((scenario) => ({
          ...scenario,
          examWeight: scenario.examWeight === '50' ? '20' : scenario.examWeight,
          examRule: getExamRule(scenario),
        }))
      : [defaultScenario];
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

  function handleExamRuleChange(examRule: ExamRule) {
    updateScenario('examRule', examRule);
    if (examRule === 'uniform20Bonus') {
      updateScenario('examWeight', '20');
    }
    if (examRule === 'nonUniform') {
      updateScenario('examWeight', '0');
    }
    if (examRule === 'custom' && activeScenario.examWeight === '0') {
      updateScenario('examWeight', '20');
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
                  WHS courses with a Uniform MEQ exam, the June school mark counts for 80% and the
                  uniform exam counts for 20%, unless the exam mark is higher than the school mark.
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
                <h2 className="mt-1 text-xl font-bold">School terms and MEQ exam rule</h2>
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
                  value={getExamRule(activeScenario)}
                  onChange={(event) => handleExamRuleChange(event.target.value as ExamRule)}
                >
                  <option value="uniform20Bonus">Uniform MEQ exam (WHS rule)</option>
                  <option value="nonUniform">No uniform MEQ exam</option>
                  <option value="custom">Custom exam weight</option>
                </select>
              </label>
              <label className="block">
                <span className="label">Exam weight</span>
                <input
                  className="field mt-1 text-lg font-bold"
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  inputMode="numeric"
                  value={activeScenario.examWeight}
                  disabled={getExamRule(activeScenario) !== 'custom'}
                  onChange={(event) => updateScenario('examWeight', event.target.value)}
                />
              </label>
            </div>

            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="label">Uniform MEQ exam courses</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {uniformCourses.join(', ')}.
              </p>
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
                getExamRule(activeScenario) === 'nonUniform'
                  ? 'N/A'
                  : result.hasAllTerms
                  ? result.requiredExamGrade > 100
                    ? '>100%'
                    : formatPercent(Math.max(0, result.requiredExamGrade))
                  : '-'
              }
              helper="Minimum uniform exam mark needed for the target."
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
                  School result = Term 1 x 20% + Term 2 x 20% + Term 3 x 60%. For WHS courses with
                  a Uniform MEQ exam, final result = school result x 80% + exam result x 20%, or
                  the exam result itself if the exam mark is higher than the school result.
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Final marks for uniform-exam courses appear on the Provincial Report Card, also
                  called the Releve des Apprentissages. WHS notes the 2026 online academic record is
                  available as of July 7, 2026. This remains a planning calculator because Quebec
                  final results may use conversion and moderation.
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
