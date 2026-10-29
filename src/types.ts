export type Locale = "ru" | "en";
export type Localized = string | { ru: string; en: string };
export type Mode = "learn" | "work";
export interface Course {
  id: string;
  title: Localized;
  description: Localized;
  art?: string;
  lessonIds?: string[];
  duration?: string;
  level?: Localized;
  prerequisites?: Localized;
  outcomes?: Localized[];
}
export interface Lesson {
  id: string;
  courseId?: string;
  title: Localized;
  goal?: Localized;
  explanation?: Localized;
  markdown?: Localized;
  content?: Localized;
  example?: string;
  task?: Localized;
  starter?: string;
  starterCode?: string;
  files?: Record<string, string>;
  entry?: string;
  hints?: Localized[];
  solution?: string;
  walkthrough?: Localized;
  transfer?: Localized;
  duration?: number;
  tests?: unknown[];
}
export interface Catalog {
  version?: number;
  courses: Course[];
  lessons: Lesson[];
}
export interface Diagnostic {
  message: string;
  code?: string;
  severity?: string;
  file?: string;
  line?: number;
  column?: number;
  endLine?: number;
  endColumn?: number;
  startLineNumber?: number;
  startColumn?: number;
  endLineNumber?: number;
}
export interface RunResult {
  stdout?: string;
  stderr?: string;
  diagnostics?: Diagnostic[];
  exitCode?: number;
  code?: number;
  formatted?: string;
  files?: Record<string, string>;
  emittedC?: string;
  tests?: Array<{
    name: string;
    passed: boolean;
    expected?: string;
    actual?: string;
    message?: string;
  }>;
  passed?: boolean;
  message?: string;
}
export interface Project {
  id?: string;
  name: string;
  path?: string;
  files: Record<string, string>;
  entry?: string;
  modified?: number;
}
export interface Session {
  files: Record<string, string>;
  activeFile: string;
  lessonId: string;
  mode: Mode;
  project?: Project;
}
export interface Toolchain {
  ready?: boolean;
  version?: string;
  compiler?: string;
  backend?: string;
  isolation?: string;
  platform?: string;
  message?: string;
}
export interface Bootstrap {
  progress?: Record<string, unknown> | string[];
  projects?: Project[];
  session?: Session;
  settings?: Record<string, unknown>;
  toolchain?: Toolchain;
}
export type Request = { action: string; [key: string]: unknown };
