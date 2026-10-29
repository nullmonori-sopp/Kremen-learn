"use client";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  Code2,
  Command,
  Download,
  ExternalLink,
  FileCode2,
  FilePlus2,
  Files,
  FlaskConical,
  Folder,
  FolderOpen,
  GitBranch,
  GraduationCap,
  Home,
  Info,
  Keyboard,
  Layers,
  Library,
  Lightbulb,
  LoaderCircle,
  Maximize2,
  Minus,
  Monitor,
  Moon,
  MoreHorizontal,
  PanelLeftClose,
  Play,
  Plus,
  RotateCcw,
  Save,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Square,
  Sun,
  Terminal,
  Upload,
  X,
  Zap,
} from "lucide-react";
import Editor from "@monaco-editor/react";
import ReactMarkdown from "react-markdown";
import { monaco } from "./monaco";
import { api, isDesktop } from "./bridge";
import type {
  Bootstrap,
  Catalog,
  Course,
  Diagnostic,
  Lesson,
  Locale,
  Localized,
  Mode,
  Project,
  RunResult,
  Session,
  Toolchain,
} from "./types";

const navs = [
  { id: "home", ru: "Главная", en: "Home", icon: Home },
  { id: "courses", ru: "Курсы", en: "Courses", icon: Library },
  { id: "practice", ru: "Практика", en: "Practice", icon: FlaskConical },
  { id: "sandbox", ru: "Песочница", en: "Sandbox", icon: Code2 },
  { id: "projects", ru: "Мои проекты", en: "My projects", icon: Folder },
  { id: "reference", ru: "Справочник", en: "Reference", icon: BookOpen },
  { id: "settings", ru: "Настройки", en: "Settings", icon: Settings },
];
const arts = [
  "foundations",
  "algorithms",
  "memory",
  "systems",
  "errors",
  "concurrency",
];
const initialCode =
  'package main\n\nfunc main() {\n    println("Hello, Kremen!")\n}\n';
const initialCatalog: Catalog = { courses: [], lessons: [] };
function Brand({ small = false }: { small?: boolean }) {
  return (
    <div className={`brand ${small ? "small" : ""}`}>
      <svg viewBox="0 0 36 40" aria-hidden="true">
        <path
          d="M4 3h8v14L25 3h10L18 21l17 16H24L12 25v12H4z"
          fill="currentColor"
        />
        <path d="m13 17 6-6 6 7-6 6z" fill="#F39BAC" />
      </svg>
      {!small && (
        <span>
          Kremen<span>Learn</span>
        </span>
      )}
    </div>
  );
}
function readPref(key: string, fallback: string) {
  try {
    return localStorage.getItem(`kremen.${key}`) || fallback;
  } catch {
    return fallback;
  }
}
function Cover({
  course,
  index = 0,
  className = "",
}: {
  course?: Course;
  index?: number;
  className?: string;
}) {
  const art = course?.art;
  const src = art
    ? art.startsWith("/")
      ? art
      : art.endsWith(".svg")
        ? `/art/${art}`
        : `/art/${art}.svg`
    : `/art/${arts[index % arts.length]}.svg`;
  return (
    <div className={`cover ${className}`}>
      <img src={src} alt="" />
      <span className="cover-brand">K / L</span>
      <span className="cover-number">0{index + 1}</span>
    </div>
  );
}
function Button({
  children,
  onClick,
  secondary = false,
  disabled = false,
  className = "",
  title,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  secondary?: boolean;
  disabled?: boolean;
  className?: string;
  title?: string;
}) {
  return (
    <button
      className={`button ${secondary ? "secondary" : ""} ${className}`}
      onClick={onClick}
      disabled={disabled}
      title={title}
    >
      {children}
    </button>
  );
}
function ResizeHandle({
  onChange,
  vertical = false,
}: {
  onChange: (delta: number) => void;
  vertical?: boolean;
}) {
  return (
    <div
      tabIndex={0}
      role="separator"
      aria-orientation={vertical ? "horizontal" : "vertical"}
      className={`resize ${vertical ? "vertical" : ""}`}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        let last = vertical ? e.clientY : e.clientX;
        const el = e.currentTarget;
        const move = (ev: PointerEvent) => {
          const next = vertical ? ev.clientY : ev.clientX;
          onChange(next - last);
          last = next;
        };
        const up = () => {
          el.removeEventListener("pointermove", move);
          el.removeEventListener("pointerup", up);
        };
        el.addEventListener("pointermove", move);
        el.addEventListener("pointerup", up);
      }}
      onKeyDown={(e) => {
        if (["ArrowLeft", "ArrowUp"].includes(e.key)) {
          e.preventDefault();
          onChange(-16);
        }
        if (["ArrowRight", "ArrowDown"].includes(e.key)) {
          e.preventDefault();
          onChange(16);
        }
      }}
    >
      <span />
    </div>
  );
}

function sameSources(
  left: Record<string, string>,
  right: Record<string, string>,
) {
  const keys = Object.keys(left);
  return (
    keys.length === Object.keys(right).length &&
    keys.every((key) => left[key] === right[key])
  );
}

export default function App() {
  const [locale, setLocale] = useState<Locale>("ru");
  const [theme, setTheme] = useState("dark");
  const [scale, setScale] = useState(1);
  const [page, setPage] = useState("home");
  const [catalog, setCatalog] = useState<Catalog>(initialCatalog);
  const [catalogError, setCatalogError] = useState("");
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null);
  const [lessonId, setLessonId] = useState("");
  const [workspace, setWorkspace] = useState(false);
  const [files, setFiles] = useState<Record<string, string>>({
    "main.kr": initialCode,
  });
  const [activeFile, setActiveFile] = useState("main.kr");
  const [stdin, setStdin] = useState("");
  const [mode, setMode] = useState<Mode>("learn");
  const [completed, setCompleted] = useState<string[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [project, setProject] = useState<Project | undefined>();
  const [toolchain, setToolchain] = useState<Toolchain>({ ready: false });
  const [busy, setBusy] = useState("");
  const [result, setResult] = useState<RunResult | null>(null);
  const [toast, setToast] = useState("");
  const [saved, setSaved] = useState(true);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [hints, setHints] = useState(0);
  const [markdown, setMarkdown] = useState("");
  const [lessonTab, setLessonTab] = useState("lesson");
  const [outputTab, setOutputTab] = useState("output");
  const [sideWidth, setSideWidth] = useState(360);
  const [outputHeight, setOutputHeight] = useState(205);
  const [dialog, setDialog] = useState<{ kind: string; value: string } | null>(
    null,
  );
  const [explanation, setExplanation] = useState("");
  const [explainCode, setExplainCode] = useState("E107");
  const [windowActive, setWindowActive] = useState(true);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const restored = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const native = isDesktop();
  const t = useCallback(
    (ru: string, en: string) => (locale === "ru" ? ru : en),
    [locale],
  );
  const l = useCallback(
    (value: Localized | undefined) =>
      typeof value === "string" ? value : value?.[locale] || value?.en || "",
    [locale],
  );
  const lesson =
    catalog.lessons.find((x) => x.id === lessonId) || catalog.lessons[0];
  const currentCourse =
    catalog.courses.find((x) => x.id === lesson?.courseId) ||
    catalog.courses[0];
  const course = catalog.courses.find((x) => x.id === selectedCourse);
  const currentIndex = Math.max(
    0,
    catalog.lessons.findIndex((x) => x.id === lesson?.id),
  );
  const recommendedLesson =
    catalog.lessons.find(
      (item, index) => index > currentIndex && !completed.includes(item.id),
    ) ||
    catalog.lessons.find((item) => !completed.includes(item.id)) ||
    lesson;
  const progress = catalog.lessons.length
    ? Math.round((completed.length / catalog.lessons.length) * 100)
    : 0;
  const sourceFiles = useRef(files);
  const executionContext = useRef({
    mode,
    lessonId: lesson?.id,
    entry: project?.entry || "main.kr",
    projectPath: project?.path,
  });
  executionContext.current = {
    mode,
    lessonId: lesson?.id,
    entry: project?.entry || "main.kr",
    projectPath: project?.path,
  };
  const updateFiles = useCallback(
    (update: React.SetStateAction<Record<string, string>>) => {
      const next =
        typeof update === "function" ? update(sourceFiles.current) : update;
      if (sameSources(next, sourceFiles.current)) return;
      sourceFiles.current = next;
      setFiles(next);
      setResult(null);
    },
    [],
  );
  useEffect(() => {
    setResult(null);
  }, [mode, lessonId, project?.path]);
  const notify = useCallback((msg: string) => {
    setToast(msg);
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => setToast(""), 6500);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    setLocale(readPref("locale", "ru") as Locale);
    setTheme(readPref("theme", "dark"));
    setScale(Number(readPref("scale", "1")));
    const loadCatalog = fetch("/content/catalog.json").then((r) => {
      if (!r.ok) throw new Error(`Catalog ${r.status}`);
      return r.json() as Promise<Catalog>;
    });
    const loadBootstrap = native
      ? api<Bootstrap>({ action: "bootstrap" }).catch((e) => {
          notify(String(e));
          return {} as Bootstrap;
        })
      : Promise.resolve({} as Bootstrap);
    Promise.all([loadCatalog, loadBootstrap])
      .then(([data, b]) => {
        setCatalog(data);
        setToolchain(b.toolchain || { ready: false });
        setProjects(b.projects || []);
        const p = b.progress as {
          completed?: string[];
          currentLessonId?: string;
        };
        setCompleted(
          Array.isArray(b.progress)
            ? (b.progress as string[])
            : p?.completed || [],
        );
        if (b.settings) {
          if (b.settings.locale) setLocale(b.settings.locale as Locale);
          if (b.settings.theme) setTheme(String(b.settings.theme));
          if (b.settings.scale) setScale(Number(b.settings.scale));
          if (b.settings.mode) setMode(b.settings.mode as Mode);
        }
        if (b.session && b.session.files) {
          const savedSession = b.session;
          updateFiles(savedSession.files);
          setActiveFile(savedSession.activeFile);
          setLessonId(savedSession.lessonId);
          setMode(savedSession.mode);
          setProject(savedSession.project);
        } else {
          const first =
            data.lessons.find((x) => x.id === p?.currentLessonId) ||
            data.lessons[0];
          setLessonId(first?.id || "");
          updateFiles(
            first?.files || { "main.kr": first?.starter || initialCode },
          );
          setActiveFile(first?.entry || "main.kr");
        }
        restored.current = true;
      })
      .catch((e) => {
        setCatalogError(String(e));
        restored.current = true;
      });
    const focus = () => setWindowActive(true);
    const blur = () => setWindowActive(false);
    window.addEventListener("focus", focus);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("focus", focus);
      window.removeEventListener("blur", blur);
    };
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.fontSize = `${scale * 16}px`;
    try {
      localStorage.setItem("kremen.theme", theme);
      localStorage.setItem("kremen.locale", locale);
      localStorage.setItem("kremen.scale", String(scale));
    } catch {}
    if (native && restored.current)
      api({
        action: "saveSettings",
        settings: { theme, locale, scale, mode },
      }).catch((e) => notify(String(e)));
  }, [theme, locale, scale, mode]);
  useEffect(() => {
    if (!restored.current) return;
    setSaved(false);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const session: Session = { files, activeFile, lessonId, mode, project };
      if (native)
        api({ action: "saveSession", session })
          .then(() => setSaved(true))
          .catch((e) => notify(String(e)));
      else {
        try {
          localStorage.setItem(
            "kremen.previewSession",
            JSON.stringify(session),
          );
          setSaved(true);
        } catch {}
      }
    }, 700);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [files, activeFile, lessonId, mode, project]);
  useEffect(() => {
    if (!lesson) {
      setMarkdown("");
      return;
    }
    const md = (lesson.markdown as Record<string, string> | undefined)?.[
      locale
    ];
    if (md && /\.md$/.test(md)) {
      fetch(md.startsWith("/") ? md : `/content/${md}`)
        .then((r) => r.text())
        .then(setMarkdown)
        .catch(() => setMarkdown(""));
    } else
      setMarkdown(l(lesson.explanation || lesson.content || lesson.markdown));
  }, [lesson?.id, locale]);
  const beginLesson = (next: Lesson, resume = false) => {
    setLessonId(next.id);
    if (!resume || next.id !== lesson?.id || project) {
      updateFiles(
        next.files || {
          "main.kr": next.starter || next.starterCode || initialCode,
        },
      );
      setActiveFile(next.entry || "main.kr");
      setResult(null);
      setHints(0);
    }
    setMode("learn");
    setProject(undefined);
    setWorkspace(true);
    setLessonTab("lesson");
  };
  const newSandbox = () => {
    setMode("work");
    setProject(undefined);
    updateFiles({ "main.kr": initialCode });
    setActiveFile("main.kr");
    setResult(null);
    setWorkspace(true);
    setPage("sandbox");
  };
  const run = useCallback(
    async (operation: string, testId?: string) => {
      if (busy) return;
      const sourceSnapshot = sourceFiles.current;
      const contextSnapshot = executionContext.current;
      setBusy(operation);
      setOutputTab(
        operation === "test"
          ? "tests"
          : operation === "check"
            ? "diagnostics"
            : "output",
      );
      try {
        const raw = await api<
          RunResult & {
            results?: RunResult["tests"];
            generatedC?: string;
            ok?: boolean;
            durationMs?: number;
          }
        >({
          action: operation === "test" ? "test" : "execute",
          operation: operation === "test" ? "run" : operation,
          files: sourceSnapshot,
          entry: contextSnapshot.entry,
          stdin,
          mode: contextSnapshot.mode,
          lessonId:
            contextSnapshot.mode === "learn"
              ? contextSnapshot.lessonId
              : undefined,
          testId,
        });
        if (
          !sameSources(sourceFiles.current, sourceSnapshot) ||
          JSON.stringify(executionContext.current) !==
            JSON.stringify(contextSnapshot)
        ) {
          notify(
            t(
              "Код или режим изменился. Запустите проверку ещё раз.",
              "Source or mode changed. Run the check again.",
            ),
          );
          return;
        }
        const next = {
          ...raw,
          tests: raw.tests || raw.results,
          emittedC: raw.emittedC || raw.generatedC,
        };
        setResult(next);
        if (next.diagnostics?.length) setOutputTab("diagnostics");
        if (next.message) notify(next.message);
        if (operation === "fmt" && raw.ok !== false) {
          if (next.files) updateFiles(next.files);
          else if (next.formatted)
            updateFiles((f) => ({ ...f, [activeFile]: next.formatted! }));
          notify(t("Форматирование завершено", "Formatting complete"));
        }
        if (operation === "emit-c") setOutputTab("c");
        if (
          operation === "test" &&
          next.tests?.length &&
          next.tests.every((x) => x.passed) &&
          !testId &&
          contextSnapshot.lessonId
        ) {
          await api({
            action: "saveProgress",
            lessonId: contextSnapshot.lessonId,
          });
          setCompleted((c) =>
            Array.from(new Set([...c, contextSnapshot.lessonId!])),
          );
          notify(t("Отлично! Урок пройден.", "Well done! Lesson complete."));
        }
      } catch (e) {
        notify(String(e));
        if (
          sameSources(sourceFiles.current, sourceSnapshot) &&
          JSON.stringify(executionContext.current) ===
            JSON.stringify(contextSnapshot)
        )
          setResult({ stderr: String(e), diagnostics: [] });
      } finally {
        setBusy("");
      }
    },
    [busy, files, project, stdin, mode, lesson, activeFile, t, notify],
  );
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        e.stopPropagation();
        setSearchOpen((v) => !v);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && workspace) {
        e.preventDefault();
        e.stopPropagation();
        void run("run");
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        e.stopPropagation();
        if (project) void projectAction("saveProject");
        else
          notify(
            t(
              "Сессия сохраняется автоматически",
              "Your session saves automatically",
            ),
          );
      }
      if (e.key === "Escape") {
        setSearchOpen(false);
        setDialog(null);
        setExplanation("");
      }
      if (e.key === "F5" && workspace) {
        e.preventDefault();
        e.stopPropagation();
        void run("run");
      }
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [run, workspace, project, t]);
  useEffect(() => {
    if (!searchOpen && !dialog && !explanation) return;
    const modal = document.querySelector<HTMLElement>(".modal");
    if (!modal) return;
    const previous = document.activeElement as HTMLElement | null;
    const elements = () =>
      Array.from(
        modal.querySelectorAll<HTMLElement>(
          'button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]',
        ),
      ).filter((element) => element.getClientRects().length > 0);
    if (!modal.contains(document.activeElement)) elements()[0]?.focus();
    const trap = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const list = elements();
      if (!list.length) return;
      const first = list[0],
        last = list[list.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", trap, true);
    return () => {
      window.removeEventListener("keydown", trap, true);
      if (previous?.isConnected) previous.focus();
    };
  }, [searchOpen, dialog?.kind, explanation]);
  useEffect(() => {
    const model = editorRef.current?.getModel();
    if (!model) return;
    const ds = (result?.diagnostics || []).filter(
      (d) => !d.file || d.file.endsWith(activeFile),
    );
    monaco.editor.setModelMarkers(
      model,
      "kremen",
      ds.map((d) => {
        const q = d as Diagnostic & { startLine?: number };
        return {
          message: d.message,
          code: d.code,
          severity:
            d.severity === "warning"
              ? monaco.MarkerSeverity.Warning
              : monaco.MarkerSeverity.Error,
          startLineNumber: q.startLine || d.startLineNumber || d.line || 1,
          startColumn: d.startColumn || d.column || 1,
          endLineNumber:
            d.endLine || d.endLineNumber || q.startLine || d.line || 1,
          endColumn: d.endColumn || (d.startColumn || d.column || 1) + 1,
        };
      }),
    );
  }, [result, activeFile, files]);
  const projectAction = async (action: string, name?: string) => {
    try {
      const p = await api<Project | { projects?: Project[]; path?: string }>({
        action,
        name,
        path: action === "openProjectAt" ? name : undefined,
        project: project
          ? { ...project, files }
          : { name: name || "Untitled", files, entry: "main.kr" },
      });
      if (
        action === "createProject" ||
        action === "openProject" ||
        action === "openProjectAt"
      ) {
        const pr = p as Project;
        setProject(pr);
        updateFiles(pr.files);
        setActiveFile(pr.entry || Object.keys(pr.files)[0] || "main.kr");
        setMode("work");
        setWorkspace(true);
        setPage("projects");
        setResult(null);
        setProjects((ps) => [pr, ...ps.filter((x) => x.path !== pr.path)]);
      }
      if (action === "saveProject") {
        const pr = p as Project;
        setProject(pr);
        setProjects((ps) => [pr, ...ps.filter((x) => x.path !== pr.path)]);
      }
      notify(
        t(
          action === "saveProject"
            ? "Проект сохранён"
            : action === "exportProject"
              ? "Проект экспортирован"
              : "Проект открыт",
          action === "saveProject"
            ? "Project saved"
            : action === "exportProject"
              ? "Project exported"
              : "Project opened",
        ),
      );
    } catch (e) {
      if (
        action === "saveProject" &&
        String(e).toLowerCase().includes("conflict")
      )
        setDialog({ kind: "conflict", value: String(e) });
      else notify(String(e));
    }
  };
  const exportAction = async (action: string) => {
    try {
      const r = await api<unknown>({ action });
      notify(typeof r === "string" ? r : t("Готово", "Done"));
      if (action === "importProgress") {
        const b = await api<Bootstrap>({ action: "bootstrap" });
        const p = b.progress as { completed?: string[] };
        setCompleted(p?.completed || []);
      }
    } catch (e) {
      notify(String(e));
    }
  };
  const jump = (d: Diagnostic) => {
    const name = d.file && Object.keys(files).find((f) => d.file?.endsWith(f));
    if (name) setActiveFile(name);
    const q = d as Diagnostic & { startLine?: number };
    setTimeout(() => {
      editorRef.current?.revealLineInCenter(q.startLine || d.line || 1);
      editorRef.current?.setPosition({
        lineNumber: q.startLine || d.line || 1,
        column: d.startColumn || d.column || 1,
      });
      editorRef.current?.focus();
    }, 60);
  };
  const navigate = (id: string) => {
    if (id === "sandbox") {
      newSandbox();
      return;
    }
    setPage(id);
    setWorkspace(false);
    setSelectedCourse(null);
  };
  const courseLessons = (c: Course) =>
    catalog.lessons.filter(
      (x) => x.courseId === c.id || c.lessonIds?.includes(x.id),
    );
  const nextLesson = (c: Course) =>
    courseLessons(c).find((x) => !completed.includes(x.id)) ||
    courseLessons(c)[0];
  const courseProgress = (c: Course) => {
    const ls = courseLessons(c);
    return ls.length
      ? Math.round(
          (ls.filter((x) => completed.includes(x.id)).length / ls.length) * 100,
        )
      : 0;
  };
  const searchResults = catalog.lessons.filter((x) =>
    l(x.title).toLowerCase().includes(query.toLowerCase()),
  );
  const hintsList = Array.isArray(lesson?.hints)
    ? lesson.hints
    : (lesson?.hints as unknown as Record<string, string[]> | undefined)?.[
        locale
      ] || [];
  const diagnosticCount = result?.diagnostics?.length || 0;
  const diskDirty = !!project && !sameSources(project.files, files);
  const courseCard = (c: Course, i: number) => (
    <motion.button
      className="course-card"
      key={c.id}
      onClick={() => {
        setSelectedCourse(c.id);
        setPage("courses");
      }}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: i * 0.045 }}
    >
      <motion.div layoutId={`cover-${c.id}`}>
        <Cover course={c} index={i} />
      </motion.div>
      <span className="card-eyebrow">
        {l(c.level) || t("КУРС", "COURSE")}{" "}
        <span>
          · {courseLessons(c).length} {t("уроков", "lessons")}
        </span>
      </span>
      <h3>{l(c.title)}</h3>
      <p>{l(c.description)}</p>
      {courseProgress(c) > 0 && (
        <div className="thin-progress">
          <i style={{ width: `${courseProgress(c)}%` }} />
        </div>
      )}
    </motion.button>
  );
  return (
    <MotionConfig reducedMotion="user">
      <div className={`app ${windowActive ? "" : "inactive"}`}>
        <aside className="sidebar">
          <Brand />
          <button
            className="search-trigger"
            onClick={() => setSearchOpen(true)}
          >
            <Search size={17} />
            <span>{t("Поиск", "Search")}</span>
            <kbd>⌘ K</kbd>
          </button>
          <div className="nav-label">{t("ОБУЧЕНИЕ", "LEARN")}</div>
          <nav>
            {navs.slice(0, 4).map((n) => (
              <button
                key={n.id}
                className={page === n.id && !selectedCourse ? "active" : ""}
                onClick={() => navigate(n.id)}
              >
                <n.icon size={19} />
                {t(n.ru, n.en)}
                {n.id === "sandbox" && <span className="tiny-dot" />}
              </button>
            ))}
          </nav>
          <div className="nav-label library-label">
            {t("БИБЛИОТЕКА", "LIBRARY")}
          </div>
          <nav>
            {navs.slice(4).map((n) => (
              <button
                key={n.id}
                className={page === n.id ? "active" : ""}
                onClick={() => navigate(n.id)}
              >
                <n.icon size={19} />
                {t(n.ru, n.en)}
              </button>
            ))}
          </nav>
          <div className="sidebar-course">
            <span className="mini-k">
              <GraduationCap size={19} />
            </span>
            <p>
              {t("Маленький шаг.", "One small step.")}
              <br />
              <strong>{t("Большая идея.", "One big idea.")}</strong>
            </p>
            <div className="thin-progress">
              <i style={{ width: `${Math.max(3, progress)}%` }} />
            </div>
            <span>
              {completed.length} {t("уроков пройдено", "lessons completed")}
            </span>
          </div>
          <div className="sidebar-bottom">
            <span className={`status-dot ${toolchain.ready ? "ready" : ""}`} />
            <div>
              {native
                ? t("Локальное окружение", "Local workspace")
                : t("Предпросмотр интерфейса", "Interface preview")}
              <small>
                {toolchain.ready
                  ? toolchain.version || "Kremen 0.4.6"
                  : native
                    ? t("Проверьте тулчейн", "Check toolchain")
                    : t(
                        "Для запуска откройте приложение",
                        "Open desktop app to run code",
                      )}
              </small>
            </div>
            <button
              className="icon-button"
              onClick={() => navigate("settings")}
              aria-label={t("Настройки", "Settings")}
            >
              <SlidersHorizontal size={16} />
            </button>
          </div>
        </aside>
        <main className={`main ${workspace ? "workspace-main" : ""}`}>
          <header className="topbar">
            <div className="breadcrumb">
              <span>Kremen Learn</span>
              <ChevronRight size={13} />
              <strong>
                {workspace
                  ? mode === "learn"
                    ? l(lesson?.title)
                    : project?.name || t("Песочница", "Sandbox")
                  : selectedCourse
                    ? l(course?.title)
                    : t(
                        navs.find((x) => x.id === page)?.ru || "",
                        navs.find((x) => x.id === page)?.en || "",
                      )}
              </strong>
            </div>
            <div className="top-actions">
              <span className="offline">
                <span /> {t("Работает офлайн", "Offline ready")}
              </span>
              <button
                className="icon-button"
                onClick={() => {
                  setTheme((v) => (v === "dark" ? "light" : "dark"));
                }}
                aria-label={t("Переключить тему", "Toggle theme")}
              >
                {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
              </button>
              <button
                className="language-button"
                onClick={() => setLocale((v) => (v === "ru" ? "en" : "ru"))}
              >
                {locale.toUpperCase()}
              </button>
              <span className="profile">K</span>
            </div>
          </header>
          <AnimatePresence mode="wait">
            {workspace ? (
              <motion.section
                key="workspace"
                layoutId="lesson-player"
                transition={{ type: "spring", stiffness: 260, damping: 30 }}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="workspace"
              >
                <div className="workspace-heading">
                  <button
                    className="back-button"
                    onClick={() => setWorkspace(false)}
                  >
                    <ArrowLeft size={16} />
                    {t("В библиотеку", "Library")}
                  </button>
                  <div>
                    <span className="eyebrow">
                      {mode === "learn"
                        ? `${t("УРОК", "LESSON")} ${String(currentIndex + 1).padStart(2, "0")}`
                        : "WORKSPACE"}
                    </span>
                    <h1>
                      {mode === "learn"
                        ? l(lesson?.title)
                        : project?.name || t("Песочница", "Sandbox")}
                    </h1>
                  </div>
                  <div className="mode-switch">
                    <button
                      className={mode === "learn" ? "selected" : ""}
                      onClick={() => setMode("learn")}
                    >
                      Learn
                    </button>
                    <button
                      className={mode === "work" ? "selected" : ""}
                      onClick={() => setMode("work")}
                    >
                      Work
                    </button>
                  </div>
                </div>
                <div
                  className="work-grid"
                  style={{
                    gridTemplateColumns: `${sideWidth}px 7px minmax(340px,1fr)`,
                  }}
                >
                  <article className="lesson-panel">
                    <div className="panel-tabs">
                      <button
                        className={lessonTab === "lesson" ? "selected" : ""}
                        onClick={() => setLessonTab("lesson")}
                      >
                        <BookOpen size={14} />
                        {t("Урок", "Lesson")}
                      </button>
                      <button
                        className={lessonTab === "hints" ? "selected" : ""}
                        onClick={() => setLessonTab("hints")}
                      >
                        <Lightbulb size={14} />
                        {t("Подсказки", "Hints")}
                      </button>
                    </div>
                    <div className="lesson-content">
                      {mode === "work" ? (
                        <>
                          <span className="eyebrow">YOUR IDEAS, YOUR CODE</span>
                          <h2>
                            {t("Место для экспериментов", "Room to experiment")}
                          </h2>
                          <p>
                            {t(
                              "Создавайте файлы .kr и .krh, подключайте локальные модули и запускайте настоящий Kremen. Изменения сессии сохраняются автоматически.",
                              "Create .kr and .krh files, import local modules and run the real Kremen compiler. Your session saves automatically.",
                            )}
                          </p>
                          <div className="callout">
                            <ShieldCheck size={19} />
                            <p>
                              {t(
                                "Work запускает обычные проверки компилятора. Подробности фактической изоляции доступны в настройках.",
                                "Work uses standard compiler checks. See Settings for the actual isolation model.",
                              )}
                            </p>
                          </div>
                          <Button
                            secondary
                            onClick={() =>
                              setDialog({ kind: "project", value: "" })
                            }
                          >
                            <FolderOpen size={16} />
                            {t("Создать проект", "Create project")}
                          </Button>
                        </>
                      ) : lessonTab === "hints" ? (
                        <>
                          <span className="eyebrow">A LITTLE NUDGE</span>
                          <h2>{t("Путь к решению", "Find your way")}</h2>
                          <p>
                            {t(
                              "Открывайте подсказки по одной. Ошибка — часть исследования.",
                              "Reveal one hint at a time. Mistakes are part of exploring.",
                            )}
                          </p>
                          {hintsList.slice(0, hints).map((h, i) => (
                            <div className="hint" key={i}>
                              <span>0{i + 1}</span>
                              <p>{l(h)}</p>
                            </div>
                          ))}
                          <Button
                            secondary
                            disabled={hints >= hintsList.length}
                            onClick={() => setHints((v) => v + 1)}
                          >
                            <Lightbulb size={16} />
                            {hints >= hintsList.length
                              ? t("Все подсказки открыты", "All hints revealed")
                              : t("Открыть подсказку", "Reveal a hint")}
                          </Button>
                          <details className="solution">
                            <summary>
                              {t("Разбор решения", "Solution walkthrough")}
                            </summary>
                            <pre>{lesson?.solution}</pre>
                            {l(lesson?.walkthrough) && (
                              <p>{l(lesson?.walkthrough)}</p>
                            )}
                          </details>
                        </>
                      ) : (
                        <>
                          <span className="eyebrow">
                            {t("УЧИМСЯ ЧЕРЕЗ ПРАКТИКУ", "LEARN BY DOING")}
                          </span>
                          <h2>{l(lesson?.goal) || l(lesson?.title)}</h2>
                          {markdown ? (
                            <ReactMarkdown>{markdown}</ReactMarkdown>
                          ) : (
                            <>
                              <p>{l(lesson?.explanation)}</p>
                              {lesson?.example && (
                                <pre>
                                  <code>{lesson.example}</code>
                                </pre>
                              )}
                              {lesson?.task && (
                                <>
                                  <h3>{t("Ваша задача", "Your task")}</h3>
                                  <p>{l(lesson.task)}</p>
                                </>
                              )}
                            </>
                          )}
                          {l(lesson?.transfer) && (
                            <div className="callout">
                              <Sparkles size={18} />
                              <p>{l(lesson?.transfer)}</p>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </article>
                  <ResizeHandle
                    onChange={(d) =>
                      setSideWidth((v) => Math.min(600, Math.max(230, v + d)))
                    }
                  />
                  <div
                    className="coding-area"
                    style={{
                      gridTemplateRows: `minmax(190px,1fr) 7px ${outputHeight}px`,
                    }}
                  >
                    <div className="editor-panel">
                      <div className="editor-bar">
                        <div className="file-tabs">
                          {Object.keys(files).map((name) => (
                            <button
                              key={name}
                              className={activeFile === name ? "active" : ""}
                              onClick={() => setActiveFile(name)}
                            >
                              <FileCode2 size={14} />
                              {name}
                              {(!saved || diskDirty) && activeFile === name && (
                                <span className="unsaved-dot" />
                              )}
                            </button>
                          ))}
                        </div>
                        <button
                          className="icon-button"
                          onClick={() => setDialog({ kind: "file", value: "" })}
                          aria-label={t("Добавить файл", "Add file")}
                        >
                          <FilePlus2 size={16} />
                        </button>
                      </div>
                      <div className="editor-inner">
                        <div className="file-tree">
                          <div>
                            <Files size={15} />
                          </div>
                          {Object.keys(files).map((f) => (
                            <button
                              title={f}
                              aria-label={f}
                              className={activeFile === f ? "active" : ""}
                              onClick={() => setActiveFile(f)}
                              key={f}
                            >
                              <FileCode2 size={16} />
                              <span>{f}</span>
                            </button>
                          ))}
                        </div>
                        <div className="monaco-wrap">
                          <Editor
                            path={`kremen://project/${activeFile}`}
                            language="kremen"
                            theme={theme === "dark" ? "kremen-dark" : "vs"}
                            value={files[activeFile] || ""}
                            onChange={(v) =>
                              updateFiles((f) => ({
                                ...f,
                                [activeFile]: v || "",
                              }))
                            }
                            onMount={(editor) => {
                              editorRef.current = editor;
                            }}
                            loading={
                              <div className="loading-editor">
                                <LoaderCircle className="spin" size={22} />
                                {t("Открываем редактор…", "Opening editor…")}
                              </div>
                            }
                            options={{
                              fontFamily:
                                '"JetBrains Mono", "Cascadia Code", "SFMono-Regular", Consolas, monospace',
                              fontSize: Math.round(13 * scale),
                              lineHeight: 23,
                              minimap: { enabled: false },
                              padding: { top: 20, bottom: 16 },
                              scrollBeyondLastLine: false,
                              automaticLayout: true,
                              tabSize: 4,
                              insertSpaces: true,
                              wordWrap: "on",
                              renderLineHighlight: "line",
                              smoothScrolling: true,
                              contextmenu: true,
                              overviewRulerBorder: false,
                              fixedOverflowWidgets: true,
                            }}
                          />
                        </div>
                      </div>
                      <div className="editor-status">
                        <span>
                          <GitBranch size={12} />
                          {mode} <i /> Kremen 0.4.6
                        </span>
                        <span>
                          {saved ? (
                            <>
                              <Check size={12} />
                              {diskDirty
                                ? t(
                                    "Сессия сохранена · проект изменён",
                                    "Session saved · project modified",
                                  )
                                : t("Сохранено", "Saved")}
                            </>
                          ) : (
                            t("Сохранение…", "Saving…")
                          )}
                          <i />
                          UTF-8
                        </span>
                      </div>
                    </div>
                    <ResizeHandle
                      vertical
                      onChange={(d) =>
                        setOutputHeight((v) =>
                          Math.min(440, Math.max(120, v - d)),
                        )
                      }
                    />
                    <section className="output-panel">
                      <div className="panel-tabs output-tabs">
                        <button
                          className={outputTab === "output" ? "selected" : ""}
                          onClick={() => setOutputTab("output")}
                        >
                          <Terminal size={14} />
                          {t("Вывод", "Output")}
                        </button>
                        <button
                          className={outputTab === "stdin" ? "selected" : ""}
                          onClick={() => setOutputTab("stdin")}
                        >
                          stdin
                        </button>
                        <button
                          className={
                            outputTab === "diagnostics" ? "selected" : ""
                          }
                          onClick={() => setOutputTab("diagnostics")}
                        >
                          {t("Диагностика", "Problems")}{" "}
                          {diagnosticCount > 0 && (
                            <span className="count-badge">
                              {diagnosticCount}
                            </span>
                          )}
                        </button>
                        <button
                          className={outputTab === "tests" ? "selected" : ""}
                          onClick={() => setOutputTab("tests")}
                        >
                          {t("Тесты", "Tests")}
                        </button>
                        {result?.emittedC && (
                          <button
                            className={outputTab === "c" ? "selected" : ""}
                            onClick={() => setOutputTab("c")}
                          >
                            C
                          </button>
                        )}
                        <button
                          className="clear-output icon-button"
                          onClick={() => setResult(null)}
                          aria-label={t("Очистить вывод", "Clear output")}
                        >
                          <RotateCcw size={13} />
                        </button>
                      </div>
                      <div className="output-body">
                        {outputTab === "stdin" ? (
                          <textarea
                            value={stdin}
                            onChange={(e) => setStdin(e.target.value)}
                            placeholder={t(
                              "Ввод для программы…",
                              "Input for your program…",
                            )}
                            aria-label="stdin"
                          />
                        ) : outputTab === "diagnostics" ? (
                          diagnosticCount ? (
                            result?.diagnostics?.map((d, i) => (
                              <div key={i} className="diagnostic">
                                <button onClick={() => jump(d)}>
                                  <span className="error-code">
                                    {d.code || "ERROR"}
                                  </span>
                                  <span>
                                    {d.message}
                                    <small>
                                      {d.file || activeFile}:
                                      {(
                                        d as Diagnostic & { startLine?: number }
                                      ).startLine ||
                                        d.line ||
                                        1}
                                      :{d.startColumn || d.column || 1}
                                    </small>
                                  </span>
                                  <ArrowUpRight size={14} />
                                </button>
                                {d.code && (
                                  <button
                                    className="explain-button"
                                    onClick={async () => {
                                      try {
                                        const e = await api<unknown>({
                                          action: "explain",
                                          code: d.code,
                                        });
                                        setExplanation(
                                          typeof e === "string"
                                            ? e
                                            : String(
                                                (
                                                  e as {
                                                    text?: string;
                                                    stdout?: string;
                                                  }
                                                ).text ||
                                                  (e as { stdout?: string })
                                                    .stdout ||
                                                  JSON.stringify(e, null, 2),
                                              ),
                                        );
                                      } catch (e) {
                                        notify(String(e));
                                      }
                                    }}
                                  >
                                    {t("Объяснение ошибки", "Explain error")}{" "}
                                    <ArrowUpRight size={12} />
                                  </button>
                                )}
                              </div>
                            ))
                          ) : (
                            <div className="output-empty">
                              <CheckCheck size={20} />
                              <p>
                                {t(
                                  "Здесь появятся сообщения компилятора",
                                  "Compiler messages appear here",
                                )}
                              </p>
                            </div>
                          )
                        ) : outputTab === "tests" ? (
                          result?.tests?.length ? (
                            <div className="test-results">
                              {result.tests.map((test, i) => (
                                <details
                                  key={i}
                                  className={test.passed ? "pass" : "fail"}
                                >
                                  <summary>
                                    {test.passed ? (
                                      <Check size={15} />
                                    ) : (
                                      <X size={15} />
                                    )}
                                    <span>
                                      {typeof test.name === "object"
                                        ? l(test.name as Localized)
                                        : test.name || `Test ${i + 1}`}
                                    </span>
                                    <small>
                                      {test.passed
                                        ? t("Пройден", "Passed")
                                        : t("Ошибка", "Failed")}
                                    </small>
                                    <button
                                      className="icon-button"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        void run(
                                          "test",
                                          (test as { id?: string }).id,
                                        );
                                      }}
                                      aria-label={t(
                                        "Запустить тест",
                                        "Run test",
                                      )}
                                    >
                                      <Play size={13} />
                                    </button>
                                  </summary>
                                  {!test.passed && (
                                    <div className="test-diff">
                                      <p>{test.message}</p>
                                      <label>
                                        {t("Ожидалось", "Expected")}
                                        <pre>
                                          {typeof test.expected === "object"
                                            ? JSON.stringify(
                                                test.expected,
                                                null,
                                                2,
                                              )
                                            : test.expected}
                                        </pre>
                                      </label>
                                      <label>
                                        {t("Получено", "Actual")}
                                        <pre>
                                          {typeof test.actual === "object"
                                            ? JSON.stringify(
                                                test.actual,
                                                null,
                                                2,
                                              )
                                            : test.actual}
                                        </pre>
                                      </label>
                                    </div>
                                  )}
                                </details>
                              ))}
                            </div>
                          ) : (
                            <div className="output-empty">
                              <FlaskConical size={20} />
                              <p>
                                {t(
                                  "Нажмите «Проверить решение»",
                                  "Select “Check solution” to run tests",
                                )}
                              </p>
                            </div>
                          )
                        ) : outputTab === "c" ? (
                          <pre>{result?.emittedC}</pre>
                        ) : result ? (
                          <>
                            <pre className="stdout">{result.stdout}</pre>
                            {result.stderr && (
                              <pre className="stderr">{result.stderr}</pre>
                            )}
                            {result.message && (
                              <pre className="stderr">{result.message}</pre>
                            )}
                            {result.exitCode !== undefined && (
                              <div
                                className={`exit-status ${result.exitCode === 0 ? "success" : ""}`}
                              >
                                {result.exitCode === 0 ? (
                                  <Check size={13} />
                                ) : (
                                  <Info size={13} />
                                )}{" "}
                                {t("Код завершения", "Exit code")}:{" "}
                                {result.exitCode}
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="output-empty">
                            <Terminal size={21} />
                            <p>
                              {t(
                                "Всё начинается с запуска",
                                "It all starts with a run",
                              )}
                              <span>
                                {t(
                                  "Ctrl + Enter — запустить программу",
                                  "Ctrl + Enter — run your program",
                                )}
                              </span>
                            </p>
                          </div>
                        )}
                      </div>
                    </section>
                  </div>
                </div>
                <footer className="workspace-controls">
                  <div
                    className="control-state"
                    role="status"
                    aria-live="polite"
                  >
                    {busy ? (
                      <>
                        <LoaderCircle className="spin" size={17} />
                        {t(
                          busy === "test" ? "Проверяем решение…" : "Выполняем…",
                          busy === "test" ? "Checking solution…" : "Running…",
                        )}
                      </>
                    ) : result?.tests?.every((x) => x.passed) &&
                      result.tests.length ? (
                      <>
                        <CheckCheck size={18} />
                        {t("Решение верно", "Solution passed")}
                      </>
                    ) : result &&
                      (result.diagnostics?.length ||
                        (result.stderr && result.exitCode === undefined) ||
                        result.message ||
                        (result.exitCode !== undefined &&
                          result.exitCode !== 0) ||
                        result.tests?.some((item) => !item.passed)) ? (
                      <>
                        <Info size={17} />
                        {t("Проверьте ошибки", "Review the errors")}
                      </>
                    ) : result?.exitCode === 0 ? (
                      <>
                        <Check size={17} />
                        {t("Завершено успешно", "Completed successfully")}
                      </>
                    ) : (
                      <>
                        <span
                          className={`status-dot ${toolchain.ready ? "ready" : ""}`}
                        />
                        {toolchain.ready
                          ? t("Готов к запуску", "Ready when you are")
                          : native
                            ? t(
                                "Проверьте тулчейн в настройках",
                                "Check toolchain in Settings",
                              )
                            : t(
                                "Запуск доступен в приложении",
                                "Run code in the desktop app",
                              )}
                      </>
                    )}
                  </div>
                  <div className="secondary-tools">
                    <button
                      onClick={() => void run("fmt")}
                      disabled={!!busy}
                      title="Format"
                    >
                      {t("Форматировать", "Format")}
                    </button>
                    <button onClick={() => void run("check")} disabled={!!busy}>
                      Check
                    </button>
                    <button onClick={() => void run("build")} disabled={!!busy}>
                      Build
                    </button>
                    <button
                      onClick={() => void run("emit-c")}
                      disabled={!!busy}
                    >
                      Emit C
                    </button>
                    {project && (
                      <button onClick={() => void projectAction("saveProject")}>
                        <Save size={14} />
                      </button>
                    )}
                  </div>
                  {busy ? (
                    <Button
                      secondary
                      onClick={() =>
                        api({ action: "stop" })
                          .then(() =>
                            notify(t("Остановка запрошена", "Stop requested")),
                          )
                          .catch((e) => notify(String(e)))
                      }
                    >
                      <Square size={14} />
                      {t("Остановить", "Stop")}
                    </Button>
                  ) : (
                    <Button secondary onClick={() => void run("run")}>
                      <Play size={15} fill="currentColor" />
                      {t("Запустить", "Run")}
                      <kbd>⌃ ↵</kbd>
                    </Button>
                  )}
                  {mode === "learn" && (
                    <Button onClick={() => void run("test")} disabled={!!busy}>
                      <CheckCheck size={17} />
                      {t("Проверить решение", "Check solution")}
                    </Button>
                  )}
                  {mode === "learn" &&
                    completed.includes(lesson?.id || "") &&
                    catalog.lessons[currentIndex + 1] && (
                      <Button
                        secondary
                        onClick={() =>
                          beginLesson(catalog.lessons[currentIndex + 1])
                        }
                      >
                        <ArrowRight size={17} />
                      </Button>
                    )}
                </footer>
              </motion.section>
            ) : (
              <motion.div
                key={selectedCourse || page}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.23 }}
                className="page-content"
              >
                {page === "home" && (
                  <>
                    <div className="page-heading">
                      <div>
                        <div className="eyebrow">YOUR NEXT CHAPTER</div>
                        <h1>
                          {t(
                            "Каждая идея начинается с кода.",
                            "Every idea starts with code.",
                          )}
                        </h1>
                        <p>
                          {t(
                            "Ваше пространство для изучения программирования. В своём ритме.",
                            "Your space to learn programming. At your own pace.",
                          )}
                        </p>
                      </div>
                      <span className="date-label">
                        {t(
                          "УЧИТЬСЯ. СОЗДАВАТЬ. ПОНИМАТЬ.",
                          "LEARN. BUILD. UNDERSTAND.",
                        )}
                      </span>
                    </div>
                    <section className="featured-section">
                      <div className="section-heading">
                        <h2>
                          {t(
                            "Продолжить обучение",
                            "Keep your curiosity going",
                          )}
                        </h2>
                        <span>
                          {t("Ваш следующий шаг", "Your next step")}{" "}
                          <ArrowDownToLine size={13} />
                        </span>
                      </div>
                      <div className="featured-grid">
                        <button
                          className="feature-card primary-feature"
                          onClick={() => lesson && beginLesson(lesson, true)}
                        >
                          <div className="feature-copy">
                            <span className="pill">
                              <span />
                              {t("ПРОДОЛЖИТЬ ОБУЧЕНИЕ", "CONTINUE LEARNING")}
                            </span>
                            <h2>
                              {l(currentCourse?.title) ||
                                t("Основы Kremen", "Kremen essentials")}
                            </h2>
                            <p>
                              {l(lesson?.title) ||
                                t(
                                  "Первый шаг в мир программирования",
                                  "Your first step into programming",
                                )}
                            </p>
                            <div className="feature-bottom">
                              <span className="round-play">
                                <Play size={17} fill="currentColor" />
                              </span>
                              <span>
                                {t("Начать урок", "Start lesson")}
                                <small>
                                  {String(currentIndex + 1).padStart(2, "0")} /{" "}
                                  {catalog.lessons.length || 12}{" "}
                                  {t("уроков", "lessons")}
                                </small>
                              </span>
                              <span className="feature-duration">
                                {lesson?.duration || 12} {t("мин", "min")}
                              </span>
                            </div>
                          </div>
                          <div className="feature-art">
                            <img src="/art/foundations.svg" alt="" />
                          </div>
                          <div className="feature-line">
                            <i style={{ width: `${progress}%` }} />
                          </div>
                        </button>
                        <button
                          className="feature-card secondary-feature"
                          onClick={() =>
                            recommendedLesson && beginLesson(recommendedLesson)
                          }
                        >
                          <img src="/art/algorithms.svg" alt="" />
                          <div className="feature-copy">
                            <span className="pill">
                              {t("СЛЕДУЮЩИЙ УРОК", "UP NEXT")}
                            </span>
                            <h2>{l(recommendedLesson?.title)}</h2>
                            <p>{l(recommendedLesson?.goal)}</p>
                            <span className="text-link">
                              {t("Открыть урок", "Open lesson")}{" "}
                              <ArrowUpRight size={17} />
                            </span>
                          </div>
                        </button>
                      </div>
                    </section>
                    <section className="course-section">
                      <div className="section-heading">
                        <div>
                          <h2>
                            {t(
                              "Найдите свою следующую идею",
                              "Find your next idea",
                            )}
                          </h2>
                          <p>
                            {t(
                              "Фундаментальные знания. Настоящая практика.",
                              "Fundamental knowledge. Real practice.",
                            )}
                          </p>
                        </div>
                        <button onClick={() => navigate("courses")}>
                          {t("Все курсы", "All courses")}
                          <ChevronRight size={16} />
                        </button>
                      </div>
                      <div className="course-row">
                        {catalog.courses.map((c, i) => courseCard(c, i))}
                        {!catalog.courses.length && (
                          <div className="catalog-loading">
                            {catalogError ||
                              t(
                                "Загружаем библиотеку…",
                                "Loading your library…",
                              )}
                          </div>
                        )}
                      </div>
                    </section>
                    <section className="bottom-grid">
                      <div className="sandbox-banner">
                        <div className="sandbox-icon">
                          <Code2 size={26} />
                        </div>
                        <div>
                          <span className="eyebrow">MAKE SOMETHING YOURS</span>
                          <h3>
                            {t(
                              "А что, если попробовать?",
                              "What if you tried?",
                            )}
                          </h3>
                          <p>
                            {t(
                              "Чистый редактор. Настоящий компилятор. Полная свобода.",
                              "A clean editor. A real compiler. Room for your ideas.",
                            )}
                          </p>
                        </div>
                        <button
                          className="round-button"
                          onClick={newSandbox}
                          aria-label={t("Открыть песочницу", "Open sandbox")}
                        >
                          <ArrowUpRight size={22} />
                        </button>
                      </div>
                      <div className="project-preview">
                        <div className="section-heading">
                          <h3>{t("Ваши проекты", "Your projects")}</h3>
                          <button onClick={() => navigate("projects")}>
                            <ArrowUpRight size={16} />
                          </button>
                        </div>
                        {projects[0] ? (
                          <button
                            className="project-row"
                            onClick={() =>
                              void projectAction(
                                "openProjectAt",
                                projects[0].path,
                              )
                            }
                          >
                            <Folder size={23} />
                            <span>
                              {projects[0].name}
                              <small>
                                {t("Локальный проект", "Local project")}
                              </small>
                            </span>
                            <ChevronRight size={17} />
                          </button>
                        ) : (
                          <button
                            className="project-row"
                            onClick={() =>
                              setDialog({ kind: "project", value: "" })
                            }
                          >
                            <Plus size={23} />
                            <span>
                              {t(
                                "Создать первый проект",
                                "Create your first project",
                              )}
                              <small>
                                {t(
                                  "Сохраните свою идею",
                                  "Make room for an idea",
                                )}
                              </small>
                            </span>
                            <ChevronRight size={17} />
                          </button>
                        )}
                      </div>
                    </section>
                  </>
                )}
                {page === "courses" && !course && (
                  <>
                    <div className="page-heading">
                      <div>
                        <span className="eyebrow">
                          THE KNOWLEDGE COLLECTION
                        </span>
                        <h1>{t("Библиотека курсов", "The course library")}</h1>
                        <p>
                          {t(
                            "Постройте прочный фундамент. Найдите то, что зажигает интерес.",
                            "Build a strong foundation. Find what sparks your curiosity.",
                          )}
                        </p>
                      </div>
                      <span className="collection-count">
                        {catalog.courses.length} {t("курсов", "courses")}
                      </span>
                    </div>
                    <div className="catalog-grid">
                      {catalog.courses.map((c, i) => courseCard(c, i))}
                    </div>
                  </>
                )}
                {course && (
                  <section className="course-detail">
                    <button
                      className="back-button"
                      onClick={() => {
                        setSelectedCourse(null);
                        setPage("courses");
                      }}
                    >
                      <ArrowLeft size={16} />
                      {t("Все курсы", "All courses")}
                    </button>
                    <div className="course-hero">
                      <motion.div layoutId={`cover-${course.id}`}>
                        <Cover
                          course={course}
                          index={catalog.courses.indexOf(course)}
                        />
                      </motion.div>
                      <div>
                        <span className="eyebrow">
                          {t("КУРС · KREMEN LEARN", "COURSE · KREMEN LEARN")}
                        </span>
                        <h1>{l(course.title)}</h1>
                        <p>{l(course.description)}</p>
                        <div className="course-meta">
                          <span>
                            <BookOpen size={16} />
                            {courseLessons(course).length}{" "}
                            {t("уроков", "lessons")}
                          </span>
                          <span>
                            {(course as Course & { durationMinutes?: number })
                              .durationMinutes
                              ? `${(course as Course & { durationMinutes?: number }).durationMinutes} ${t("мин", "min")}`
                              : course.duration || "~ 2 h"}
                          </span>
                          <span>
                            {l(course.level) ||
                              t("Начальный уровень", "Beginner")}
                          </span>
                        </div>
                        <div className="course-cta">
                          <Button
                            onClick={() => {
                              const n = nextLesson(course);
                              if (n) beginLesson(n, n.id === lesson?.id);
                            }}
                            disabled={!nextLesson(course)}
                          >
                            <Play size={15} fill="currentColor" />
                            {courseProgress(course)
                              ? t("Продолжить", "Continue")
                              : t("Начать обучение", "Start learning")}
                          </Button>
                          <span>
                            {courseProgress(course)}%{" "}
                            {t("пройдено", "complete")}
                          </span>
                        </div>
                        <div className="thin-progress">
                          <i style={{ width: `${courseProgress(course)}%` }} />
                        </div>
                      </div>
                    </div>
                    <div className="course-info-grid">
                      <div>
                        <h2>{t("Чему вы научитесь", "What you will learn")}</h2>
                        {course.outcomes?.length ? (
                          <ul>
                            {course.outcomes.map((o, i) => (
                              <li key={i}>{l(o)}</li>
                            ))}
                          </ul>
                        ) : (
                          <p>{l(course.description)}</p>
                        )}
                      </div>
                      <div>
                        <h2>{t("Перед началом", "Before you start")}</h2>
                        <p>
                          {l(course.prerequisites) ||
                            t(
                              "Любопытство и желание разобраться. Все новые конструкции объясняются по ходу курса.",
                              "Bring your curiosity. Each new language construct is explained as you go.",
                            )}
                        </p>
                      </div>
                    </div>
                    <div className="section-heading">
                      <h2>{t("Содержание курса", "Inside this course")}</h2>
                      <span>
                        {courseLessons(course).length} {t("уроков", "lessons")}
                      </span>
                    </div>
                    <div className="lesson-list">
                      {courseLessons(course).map((ls, i) => (
                        <button
                          key={ls.id}
                          onClick={() => beginLesson(ls, ls.id === lesson?.id)}
                        >
                          <span
                            className={`lesson-number ${completed.includes(ls.id) ? "complete" : ""}`}
                          >
                            {completed.includes(ls.id) ? (
                              <Check size={18} />
                            ) : (
                              String(i + 1).padStart(2, "0")
                            )}
                          </span>
                          <span>
                            <strong>{l(ls.title)}</strong>
                            <small>{l(ls.goal)}</small>
                          </span>
                          <span className="lesson-time">
                            {ls.duration || 12} {t("мин", "min")}
                          </span>
                          <Play size={15} />
                        </button>
                      ))}
                    </div>
                    {!courseLessons(course).length && (
                      <div className="empty-state">
                        <Layers size={30} />
                        <h3>
                          {t("Следующая глава библиотеки", "The next chapter")}
                        </h3>
                        <p>
                          {t(
                            "Структура этого курса готова к расширению. Начните с основ Kremen — все 12 уроков доступны сейчас.",
                            "This course is prepared for expansion. Start with Kremen essentials — all 12 lessons are available now.",
                          )}
                        </p>
                        <Button
                          secondary
                          onClick={() =>
                            setSelectedCourse(catalog.courses[0]?.id)
                          }
                        >
                          {t("Открыть основы", "Explore essentials")}
                          <ArrowRight size={15} />
                        </Button>
                      </div>
                    )}
                  </section>
                )}
                {page === "practice" && !course && (
                  <>
                    <div className="page-heading">
                      <div>
                        <span className="eyebrow">
                          A LITTLE PRACTICE, EVERY DAY
                        </span>
                        <h1>
                          {t(
                            "Знания становятся навыком.",
                            "Turn knowledge into skill.",
                          )}
                        </h1>
                        <p>
                          {t(
                            "Небольшие задачи, которые помогают понять большую картину.",
                            "Small challenges that help you see the bigger picture.",
                          )}
                        </p>
                      </div>
                      <span className="practice-icon">
                        <FlaskConical size={32} />
                      </span>
                    </div>
                    <div className="practice-stats">
                      <div>
                        <strong>{catalog.lessons.length}</strong>
                        <span>
                          {t("задач в библиотеке", "library challenges")}
                        </span>
                      </div>
                      <div>
                        <strong>{completed.length}</strong>
                        <span>
                          {t("решений проверено", "solutions verified")}
                        </span>
                      </div>
                      <div>
                        <strong>{progress}%</strong>
                        <span>{t("вашего пути", "of your journey")}</span>
                      </div>
                    </div>
                    <div className="section-heading">
                      <h2>{t("Практика основ", "Essential practice")}</h2>
                      <span>
                        {t(
                          "Реальный компилятор. Воспроизводимые тесты.",
                          "Real compiler. Reproducible tests.",
                        )}
                      </span>
                    </div>
                    <div className="lesson-list">
                      {catalog.lessons.map((ls, i) => (
                        <button key={ls.id} onClick={() => beginLesson(ls)}>
                          <span
                            className={`lesson-number ${completed.includes(ls.id) ? "complete" : ""}`}
                          >
                            {completed.includes(ls.id) ? (
                              <Check size={18} />
                            ) : (
                              String(i + 1).padStart(2, "0")
                            )}
                          </span>
                          <span>
                            <strong>{l(ls.title)}</strong>
                            <small>{l(ls.goal)}</small>
                          </span>
                          <span className="lesson-time">
                            {ls.duration || 12} {t("мин", "min")}
                          </span>
                          <ArrowRight size={17} />
                        </button>
                      ))}
                    </div>
                  </>
                )}
                {page === "projects" && !course && (
                  <>
                    <div className="page-heading">
                      <div>
                        <span className="eyebrow">ROOM FOR YOUR IDEAS</span>
                        <h1>{t("Мои проекты", "Your projects")}</h1>
                        <p>
                          {t(
                            "Создавайте что-то своё. Все файлы остаются на вашем компьютере.",
                            "Make something of your own. Your files stay on your computer.",
                          )}
                        </p>
                      </div>
                      <div className="heading-actions">
                        <Button
                          secondary
                          onClick={() =>
                            setDialog({ kind: "openPath", value: "" })
                          }
                        >
                          <Folder size={16} />
                          {t("Открыть по пути", "Open by path")}
                        </Button>
                        <Button
                          secondary
                          onClick={() => void projectAction("openProject")}
                        >
                          <FolderOpen size={16} />
                          {t("Открыть", "Open")}
                        </Button>
                        <Button
                          onClick={() =>
                            setDialog({ kind: "project", value: "" })
                          }
                        >
                          <Plus size={16} />
                          {t("Новый проект", "New project")}
                        </Button>
                      </div>
                    </div>
                    {projects.length ? (
                      <div className="projects-grid">
                        {projects.map((p, i) => (
                          <div className="project-card" key={p.path || i}>
                            <div className="project-card-top">
                              <Folder size={30} />
                              <span>LOCAL / WORK</span>
                            </div>
                            <h3>{p.name}</h3>
                            <p>
                              {Object.keys(p.files || {}).length}{" "}
                              {t("файлов", "files")}
                            </p>
                            <small>{p.path}</small>
                            <Button
                              secondary
                              onClick={() =>
                                void projectAction("openProjectAt", p.path)
                              }
                            >
                              {t("Открыть проект", "Open project")}
                              <ArrowRight size={15} />
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="empty-state project-empty">
                        <div className="empty-folder">
                          <FolderOpen size={56} />
                        </div>
                        <h2>
                          {t(
                            "Здесь начнётся ваша следующая идея",
                            "Your next idea starts here",
                          )}
                        </h2>
                        <p>
                          {t(
                            "Создайте проект с несколькими файлами или откройте папку с существующим кодом Kremen.",
                            "Create a project with multiple files, or open a folder of existing Kremen code.",
                          )}
                        </p>
                        <div>
                          <Button
                            onClick={() =>
                              setDialog({ kind: "project", value: "" })
                            }
                          >
                            <Plus size={16} />
                            {t("Создать проект", "Create project")}
                          </Button>
                          <Button
                            secondary
                            onClick={() => void projectAction("openProject")}
                          >
                            <FolderOpen size={16} />
                            {t("Открыть папку", "Open folder")}
                          </Button>
                        </div>
                      </div>
                    )}
                    {project && (
                      <div className="settings-card">
                        <h3>
                          {t("Текущий проект", "Current project")}:{" "}
                          {project.name}
                        </h3>
                        <Button
                          secondary
                          onClick={() => void projectAction("exportProject")}
                        >
                          <Download size={16} />
                          {t("Экспортировать", "Export project")}
                        </Button>
                      </div>
                    )}
                  </>
                )}
                {page === "reference" && !course && (
                  <>
                    <div className="page-heading">
                      <div>
                        <span className="eyebrow">KEEP IT CLOSE</span>
                        <h1>
                          {t("Справочник Kremen", "The Kremen reference")}
                        </h1>
                        <p>
                          {t(
                            "Небольшие напоминания для больших идей. Проверено на версии 0.4.6.",
                            "Small reminders for big ideas. Based on version 0.4.6.",
                          )}
                        </p>
                      </div>
                      <BookOpen size={36} />
                    </div>
                    <div className="reference-grid">
                      {[
                        {
                          ru: "Первая программа",
                          en: "First program",
                          code: 'package main\n\nfunc main() {\n    println("Hello, Kremen!")\n}',
                        },
                        {
                          ru: "Переменные и функции",
                          en: "Variables and functions",
                          code: "package main\n\nfunc add(a i64, b i64) i64 {\n    return a + b\n}\nfunc main() {\n    count := 3\n    println(add(count, 2))\n}",
                        },
                        {
                          ru: "Условия и циклы",
                          en: "Conditions and loops",
                          code: 'package main\n\nfunc main() {\n    count := 3\n    if count > 0 {\n        println("ready")\n    }\n    for i := 0; i < 3; i++ {\n        println(i)\n    }\n}',
                        },
                        {
                          ru: "Режимы компилятора",
                          en: "Compiler modes",
                          code: "kremen check --mode=work main.kr\nkremen check --mode=learn main.kr\nkremen fmt main.kr\nkremen explain E107",
                        },
                      ].map((x) => (
                        <article className="reference-card" key={x.en}>
                          <h3>{t(x.ru, x.en)}</h3>
                          <pre>{x.code}</pre>
                        </article>
                      ))}
                    </div>
                    <div className="callout">
                      <Info size={20} />
                      <p>
                        {t(
                          "Подсказки редактора содержат ключевые слова. Семантическое автодополнение не заявлено. Справочник ошибок использует настоящую команду kremen explain.",
                          "Editor suggestions provide keywords. Semantic autocomplete is not advertised. Error explanations use the real kremen explain command.",
                        )}
                      </p>
                    </div>
                    <div className="settings-card explain-search">
                      <h3>{t("Объяснить ошибку", "Understand an error")}</h3>
                      <div>
                        <input
                          value={explainCode}
                          onChange={(e) => setExplainCode(e.target.value)}
                          placeholder="E107"
                        />
                        <Button
                          secondary
                          onClick={async () => {
                            try {
                              const r = await api<unknown>({
                                action: "explain",
                                code: explainCode,
                              });
                              setExplanation(
                                typeof r === "string"
                                  ? r
                                  : String(
                                      (r as { text?: string; stdout?: string })
                                        .text ||
                                        (r as { stdout?: string }).stdout ||
                                        JSON.stringify(r, null, 2),
                                    ),
                              );
                            } catch (e) {
                              notify(String(e));
                            }
                          }}
                        >
                          {t("Открыть объяснение", "Open explanation")}
                          <ArrowUpRight size={15} />
                        </Button>
                      </div>
                    </div>
                  </>
                )}
                {page === "settings" && !course && (
                  <>
                    <div className="page-heading">
                      <div>
                        <span className="eyebrow">MAKE YOURSELF AT HOME</span>
                        <h1>{t("Ваше пространство", "Make it yours")}</h1>
                        <p>
                          {t(
                            "Комфортный интерфейс и прозрачное состояние окружения.",
                            "A comfortable interface and a clear view of your toolchain.",
                          )}
                        </p>
                      </div>
                      <Settings size={32} />
                    </div>
                    <div className="settings-grid">
                      <section className="settings-card">
                        <div className="settings-title">
                          <Monitor size={19} />
                          <h2>{t("Внешний вид", "Appearance")}</h2>
                        </div>
                        <label className="setting-row">
                          <span>
                            {t("Тема оформления", "Theme")}
                            <small>
                              {t(
                                "Читаемый код в любой теме",
                                "Readable code in either theme",
                              )}
                            </small>
                          </span>
                          <div className="segmented">
                            <button
                              className={theme === "dark" ? "selected" : ""}
                              onClick={() => setTheme("dark")}
                            >
                              <Moon size={15} />
                              {t("Тёмная", "Dark")}
                            </button>
                            <button
                              className={theme === "light" ? "selected" : ""}
                              onClick={() => setTheme("light")}
                            >
                              <Sun size={15} />
                              {t("Светлая", "Light")}
                            </button>
                          </div>
                        </label>
                        <label className="setting-row">
                          <span>
                            {t("Язык интерфейса", "Interface language")}
                          </span>
                          <select
                            value={locale}
                            onChange={(e) =>
                              setLocale(e.target.value as Locale)
                            }
                          >
                            <option value="ru">Русский</option>
                            <option value="en">English</option>
                          </select>
                        </label>
                        <label className="setting-row">
                          <span>
                            {t("Масштаб интерфейса", "Interface scale")}
                          </span>
                          <div className="scale-control">
                            <button
                              onClick={() =>
                                setScale((v) =>
                                  Math.max(
                                    0.8,
                                    Math.round((v - 0.1) * 10) / 10,
                                  ),
                                )
                              }
                            >
                              <Minus size={15} />
                            </button>
                            <span>{Math.round(scale * 100)}%</span>
                            <button
                              onClick={() =>
                                setScale((v) =>
                                  Math.min(
                                    1.4,
                                    Math.round((v + 0.1) * 10) / 10,
                                  ),
                                )
                              }
                            >
                              <Plus size={15} />
                            </button>
                          </div>
                        </label>
                        <div className="settings-note">
                          <Info size={15} />
                          {t(
                            "Уменьшение движения следует системной настройке. Фоновые эффекты приостанавливаются в неактивном окне.",
                            "Reduced motion follows your system preference. Background effects pause when the window is inactive.",
                          )}
                        </div>
                      </section>
                      <section className="settings-card">
                        <div className="settings-title">
                          <Terminal size={19} />
                          <h2>{t("Локальный тулчейн", "Local toolchain")}</h2>
                          <span
                            className={`toolchain-badge ${toolchain.ready ? "ready" : ""}`}
                          >
                            {toolchain.ready
                              ? t("Готов", "Ready")
                              : t("Не готов", "Not ready")}
                          </span>
                        </div>
                        <dl className="toolchain-list">
                          <div>
                            <dt>Kremen</dt>
                            <dd>
                              {toolchain.version || "0.4.6"}
                              <small>
                                {toolchain.compiler ||
                                  t(
                                    "Проверяется нативной частью",
                                    "Checked by native runtime",
                                  )}
                              </small>
                            </dd>
                          </div>
                          <div>
                            <dt>{t("C backend", "C backend")}</dt>
                            <dd>
                              {toolchain.backend ||
                                t("Не обнаружен", "Not detected")}
                            </dd>
                          </div>
                          <div>
                            <dt>{t("Платформа", "Platform")}</dt>
                            <dd>
                              {toolchain.platform ||
                                t("Браузерный предпросмотр", "Browser preview")}
                            </dd>
                          </div>
                          <div>
                            <dt>{t("Изоляция", "Isolation")}</dt>
                            <dd>
                              {toolchain.isolation ||
                                t(
                                  "Недоступна в браузере",
                                  "Unavailable in browser",
                                )}
                            </dd>
                          </div>
                        </dl>
                        {toolchain.message && (
                          <p className="settings-note">{toolchain.message}</p>
                        )}
                        <Button
                          secondary
                          onClick={async () => {
                            try {
                              const b = await api<Toolchain>({
                                action: "refreshToolchain",
                              });
                              setToolchain(b);
                              notify(
                                t("Состояние обновлено", "Status refreshed"),
                              );
                            } catch (e) {
                              notify(String(e));
                            }
                          }}
                        >
                          <RotateCcw size={15} />
                          {t("Проверить окружение", "Check toolchain")}
                        </Button>
                      </section>
                      <section className="settings-card">
                        <div className="settings-title">
                          <Layers size={19} />
                          <h2>{t("Прогресс и данные", "Progress and data")}</h2>
                        </div>
                        <p className="settings-description">
                          {t(
                            "Ваш прогресс хранится локально. Экспортируйте копию, чтобы перенести обучение на другой компьютер.",
                            "Your progress lives locally. Export a copy to continue learning on another computer.",
                          )}
                        </p>
                        <div className="data-actions">
                          <Button
                            secondary
                            onClick={() => void exportAction("exportProgress")}
                          >
                            <Download size={15} />
                            {t("Экспорт прогресса", "Export progress")}
                          </Button>
                          <Button
                            secondary
                            onClick={() => void exportAction("importProgress")}
                          >
                            <Upload size={15} />
                            {t("Импорт", "Import")}
                          </Button>
                          <Button
                            secondary
                            onClick={() => void exportAction("backup")}
                          >
                            <Save size={15} />
                            {t("Резервная копия", "Backup")}
                          </Button>
                        </div>
                      </section>
                      <section className="settings-card">
                        <div className="settings-title">
                          <Keyboard size={19} />
                          <h2>{t("Клавиатура", "Keyboard")}</h2>
                        </div>
                        <div className="shortcut-row">
                          <span>
                            {t("Поиск по библиотеке", "Search the library")}
                          </span>
                          <kbd>Ctrl K</kbd>
                        </div>
                        <div className="shortcut-row">
                          <span>
                            {t("Запуск программы", "Run your program")}
                          </span>
                          <kbd>Ctrl Enter</kbd>
                        </div>
                        <div className="shortcut-row">
                          <span>{t("Сохранение проекта", "Save project")}</span>
                          <kbd>Ctrl S</kbd>
                        </div>
                        <div className="shortcut-row">
                          <span>
                            {t(
                              "Поиск / замена в редакторе",
                              "Find / replace in editor",
                            )}
                          </span>
                          <kbd>Ctrl F / H</kbd>
                        </div>
                      </section>
                    </div>
                    <div className="about-line">
                      <Brand small />
                      <span>
                        Kremen Learn <strong>0.1.0</strong>
                        <small>
                          {t(
                            "Бесплатно. Открыто. На вашем компьютере.",
                            "Free. Open source. On your computer.",
                          )}
                        </small>
                      </span>
                      <span>MIT / Kremen 0.4.6</span>
                    </div>
                  </>
                )}
                <div className="page-footer">
                  <span>KREMEN LEARN</span>
                  <span>
                    {t("Знания остаются с вами.", "Knowledge stays with you.")}
                  </span>
                  <span>LOCAL FIRST · OPEN SOURCE</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>
        <AnimatePresence>
          {!workspace && lesson && (
            <motion.div
              className="mini-player"
              layoutId="lesson-player"
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 30 }}
            >
              <button
                className="mini-play"
                onClick={() => beginLesson(lesson, true)}
                aria-label={t("Продолжить урок", "Continue lesson")}
              >
                <Play size={18} fill="currentColor" />
              </button>
              <img src="/art/foundations.svg" alt="" />
              <button
                className="mini-title"
                onClick={() => beginLesson(lesson, true)}
              >
                <strong>{l(lesson.title)}</strong>
                <span>
                  {l(currentCourse?.title)} <i />{" "}
                  {mode === "learn" ? "Learn" : "Work"}
                </span>
              </button>
              <div className="mini-progress">
                <span>
                  {String(currentIndex + 1).padStart(2, "0")}{" "}
                  <small>/ {catalog.lessons.length}</small>
                </span>
                <div className="thin-progress">
                  <i style={{ width: `${Math.max(5, progress)}%` }} />
                </div>
                <span>{progress}%</span>
              </div>
              <button
                className="mini-continue"
                onClick={() => beginLesson(lesson, true)}
              >
                {t("Продолжить", "Continue")}
                <ArrowRight size={17} />
              </button>
              <button
                className="icon-button"
                onClick={() => beginLesson(lesson, true)}
                aria-label={t("Развернуть занятие", "Expand lesson")}
              >
                <Maximize2 size={16} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
        <AnimatePresence>
          {toast && (
            <motion.div
              role="status"
              className="toast"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 15 }}
            >
              <Info size={17} />
              <span>{toast}</span>
              <button
                className="icon-button"
                onClick={() => setToast("")}
                aria-label={t("Закрыть", "Close")}
              >
                <X size={15} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
        {(searchOpen || dialog || explanation) && (
          <div
            className="modal-backdrop"
            onMouseDown={(e) => {
              if (e.currentTarget === e.target) {
                setSearchOpen(false);
                setDialog(null);
                setExplanation("");
              }
            }}
          >
            <motion.section
              className={`modal ${searchOpen ? "search-modal" : ""}`}
              role="dialog"
              aria-modal="true"
              initial={{ opacity: 0, scale: 0.97, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
            >
              <button
                className="modal-close icon-button"
                onClick={() => {
                  setSearchOpen(false);
                  setDialog(null);
                  setExplanation("");
                }}
                aria-label={t("Закрыть", "Close")}
              >
                <X size={19} />
              </button>
              {searchOpen ? (
                <>
                  <div className="search-input">
                    <Search size={22} />
                    <input
                      autoFocus
                      placeholder={t(
                        "Что хочется изучить?",
                        "What are you curious about?",
                      )}
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                    <kbd>ESC</kbd>
                  </div>
                  <div className="search-results">
                    <span className="eyebrow">
                      {t("УРОКИ В БИБЛИОТЕКЕ", "LESSONS IN YOUR LIBRARY")}
                    </span>
                    {searchResults.slice(0, 9).map((ls) => (
                      <button
                        key={ls.id}
                        onClick={() => {
                          beginLesson(ls);
                          setSearchOpen(false);
                        }}
                      >
                        <BookOpen size={17} />
                        <span>{l(ls.title)}</span>
                        <ArrowUpRight size={16} />
                      </button>
                    ))}
                    {!searchResults.length && (
                      <p>{t("Пока ничего не найдено", "No results yet")}</p>
                    )}
                  </div>
                </>
              ) : explanation ? (
                <>
                  <span className="eyebrow">KREMEN EXPLAIN</span>
                  <h2>{t("Разберёмся вместе", "Let’s understand it")}</h2>
                  <pre className="explain-output">{explanation}</pre>
                </>
              ) : dialog?.kind === "conflict" ? (
                <>
                  <span className="eyebrow">SAVE CONFLICT</span>
                  <h2>
                    {t("Файлы изменились на диске", "Files changed on disk")}
                  </h2>
                  <p>
                    {t(
                      "Ваши изменения остаются в редакторе. Экспортируйте их в отдельную папку или откройте версию с диска через выбор папки.",
                      "Your edits remain in the editor. Export them to a separate folder, or choose the project folder to reopen the disk version.",
                    )}
                  </p>
                  <div className="conflict-actions">
                    <Button
                      onClick={() => {
                        void projectAction("exportProject");
                        setDialog(null);
                      }}
                    >
                      <Download size={16} />
                      {t("Экспортировать мои изменения", "Export my edits")}
                    </Button>
                    <Button
                      secondary
                      onClick={() => {
                        void projectAction("openProject");
                        setDialog(null);
                      }}
                    >
                      <FolderOpen size={16} />
                      {t("Открыть версию с диска", "Reopen disk version")}
                    </Button>
                  </div>
                </>
              ) : dialog ? (
                <>
                  <span className="eyebrow">
                    {dialog.kind === "file" ? "PROJECT FILE" : "YOUR NEXT IDEA"}
                  </span>
                  <h2>
                    {dialog.kind === "file"
                      ? t("Новый файл", "New file")
                      : dialog.kind === "openPath"
                        ? t("Открыть проект", "Open project")
                        : t("Новый проект", "New project")}
                  </h2>
                  <label className="dialog-field">
                    {dialog.kind === "file"
                      ? t("Имя файла (.kr или .krh)", "File name (.kr or .krh)")
                      : dialog.kind === "openPath"
                        ? t(
                            "Абсолютный путь к папке",
                            "Absolute directory path",
                          )
                        : t("Название проекта", "Project name")}
                    <input
                      autoFocus
                      value={dialog.value}
                      placeholder={
                        dialog.kind === "file"
                          ? "utils.kr"
                          : dialog.kind === "openPath"
                            ? "/home/me/projects/hello"
                            : t("Моя новая идея", "My new idea")
                      }
                      onChange={(e) =>
                        setDialog({ ...dialog, value: e.target.value })
                      }
                    />
                  </label>
                  <Button
                    disabled={!dialog.value.trim()}
                    onClick={() => {
                      const value = dialog.value.trim();
                      if (dialog.kind === "file") {
                        if (
                          !/^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[a-zA-Z0-9_\-/.]+\.krh?$/.test(
                            value,
                          )
                        ) {
                          notify(
                            t(
                              "Используйте безопасное имя .kr или .krh",
                              "Use a safe .kr or .krh file name",
                            ),
                          );
                          return;
                        }
                        if (files[value] !== undefined) {
                          notify(
                            t("Файл уже существует", "File already exists"),
                          );
                          return;
                        }
                        updateFiles((f) => ({
                          ...f,
                          [value]: value.endsWith(".krh")
                            ? ""
                            : "package main\n",
                        }));
                        setActiveFile(value);
                      } else if (dialog.kind === "openPath")
                        void projectAction("openProjectAt", value);
                      else void projectAction("createProject", value);
                      setDialog(null);
                    }}
                  >
                    <Plus size={16} />
                    {dialog.kind === "openPath"
                      ? t("Открыть", "Open")
                      : t("Создать", "Create")}
                  </Button>
                </>
              ) : null}
            </motion.section>
          </div>
        )}
      </div>
    </MotionConfig>
  );
}
