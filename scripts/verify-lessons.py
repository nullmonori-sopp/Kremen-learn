#!/usr/bin/env python3
"""Verify the offline curriculum with the pinned, real Kremen compiler.

Trusted repository curriculum is compiled and executed; this developer script is
not the application sandbox. Every runtime case uses a fresh working directory.
"""
from __future__ import annotations
import argparse
import datetime
import json
import os
from pathlib import Path
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]
PIN = '671140cd1ef4ea453a07047df07c945efa7184e2'
EXAMPLE_RESULTS = {
    '01-first-program': ('', 'Hello, Kremen!\n'),
    '02-variables': ('', 'cost: 20\n'),
    '03-expressions': ('', '14\n20\n3 2\n'),
    '04-conditions': ('', 'above freezing\n'),
    '05-loops': ('', '6\n'),
    '06-functions': ('', '42\n'),
    '07-arrays': ('', '2 9\n'),
    '08-structs-methods': ('', '2\n'),
    '09-results': ('', 'error: 1001\n'),
    '10-enums-match': ('', '42\n'),
    '11-input-output': ('17\n', 'Read: 17\n'),
    '12-defer-resources': ('', 'current: 2\ncaptured: 1\n'),
}

def invoke(arguments: list[str], cwd: Path, stdin: str = '', timeout: float = 30) -> subprocess.CompletedProcess:
    return subprocess.run(arguments, cwd=cwd, input=stdin, text=True,
                          capture_output=True, timeout=timeout, check=False)

def require(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)

def compile_source(compiler: Path, source: str, directory: Path, build: bool = True) -> Path:
    (directory / 'main.kr').write_text(source, encoding='utf-8')
    command = [str(compiler), 'build' if build else 'check', 'main.kr', '--mode=learn', '--diagnostic-format=json']
    binary = directory / ('program.exe' if os.name == 'nt' else 'program')
    if build:
        command += ['-o', str(binary)]
    result = invoke(command, directory)
    require(result.returncode == 0, f"Compile failed: {result.stderr}\n{result.stdout}\n{source}")
    return binary

def runtime_case(binary: Path, case: dict, workspace: Path) -> None:
    output_limit = case.get('outputLimitBytes', 65536)
    result = invoke([str(binary)], workspace, case.get('stdin', ''), case.get('timeLimitMs', 2000) / 1000)
    require(len(result.stdout.encode()) + len(result.stderr.encode()) <= output_limit, 'Output exceeded fixture limit')
    for field, actual in [('stdout', result.stdout), ('stderr', result.stderr), ('exitCode', result.returncode)]:
        expected = case.get(field, '' if field != 'exitCode' else 0)
        require(actual == expected, f'{field}: expected {expected!r}; actual {actual!r}')
    for fixture in case.get('files', []):
        relative = Path(fixture['path'])
        require(not relative.is_absolute() and '..' not in relative.parts, 'Unsafe fixture path')
        actual = (workspace / relative).read_text(encoding='utf-8')
        require(actual == fixture['content'], f"File {relative}: expected {fixture['content']!r}; actual {actual!r}")

def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--compiler', type=Path, default=ROOT / 'src-tauri/resources/toolchain/bin/kremen')
    parser.add_argument('--report', type=Path, default=ROOT / 'artifacts/lesson-validation.json')
    args = parser.parse_args()
    compiler = args.compiler.resolve()
    require(compiler.is_file(), f'Compiler not found: {compiler}; supply --compiler')
    version = invoke([str(compiler), '--version'], ROOT)
    require(version.returncode == 0 and '0.4.6' in version.stdout, f'Unexpected compiler: {version.stdout}')
    catalog = json.loads((ROOT / 'content/catalog.json').read_text(encoding='utf-8'))
    require(catalog['schemaVersion'] == 1, 'Unsupported curriculum version')
    seen = set()
    records = []
    for lesson in catalog['lessons']:
        lesson_id = lesson['id']
        require(lesson_id not in seen, f'Duplicate lesson id: {lesson_id}')
        seen.add(lesson_id)
        for language in ('en', 'ru'):
            require((ROOT / 'content' / lesson['markdown'][language]).is_file(), f'Missing Markdown: {lesson_id}/{language}')
            for field in ('title', 'goal', 'explanation', 'task', 'walkthrough', 'transfer'):
                require(bool(lesson[field][language]), f'Missing {field}/{language}: {lesson_id}')
            require(len(lesson['hints'][language]) >= 3, f'Insufficient hints: {lesson_id}/{language}')
        with tempfile.TemporaryDirectory(prefix='kremen-curriculum-') as temporary:
            base = Path(temporary)
            starter = base / 'starter'; starter.mkdir()
            compile_source(compiler, lesson['starter'], starter, build=False)
            example = base / 'example'; example.mkdir()
            example_binary = compile_source(compiler, lesson['example'], example)
            example_stdin, example_stdout = EXAMPLE_RESULTS[lesson_id]
            example_run = base / 'example-run'; example_run.mkdir()
            runtime_case(example_binary, {'stdin':example_stdin,'stdout':example_stdout}, example_run)
            solution = base / 'solution'; solution.mkdir()
            solution_binary = compile_source(compiler, lesson['solution'], solution)
            for index, case in enumerate(lesson['tests']):
                workspace = base / f'test-{index}'; workspace.mkdir()
                runtime_case(solution_binary, case, workspace)
        records.append({'lessonId':lesson_id, 'starterCheck':'passed', 'example':'passed',
                        'solutionTests':len(lesson['tests']), 'status':'passed'})
        print(f"PASS {lesson_id}: starter, example, {len(lesson['tests'])} solution test(s)", flush=True)
    require(len(records) >= 12, 'Expected at least twelve lessons')
    report = {'schemaVersion':1,'compilerVersion':version.stdout.strip(),'compilerCommit':PIN,
              'platform':os.uname().sysname if hasattr(os, 'uname') else os.name,
              'verifiedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),
              'lessons':records,'totals':{'lessons':len(records),'examples':len(records),
              'starterChecks':len(records),'solutionTests':sum(r['solutionTests'] for r in records)}}
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(report['totals']))

if __name__ == '__main__':
    main()
