import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * MIG-13 — the identifiers in `docs/lab-04/tests.md` and in the Lab 4 test
 * files agree, mechanically.
 *
 * Four properties, each a way the plan and the tests drifted apart before:
 *
 * 1. every ID in tests.md appears once (a duplicated ID made two rows claim one
 *    label, and two tests claim one row);
 * 2. every ID a Lab 4 test file cites resolves to a row in tests.md;
 * 3. every row that points at a Lab 4 test file is cited by at least one of
 *    them — a row that names a file which never mentions it proves nothing;
 * 4. an ID that heads a `describe`, `it` or `test` title sits in a file its row
 *    names, so the row points at the test that carries its label.
 *
 * What it cannot see is two *different* behaviours given one ID inside one
 * file. That was UI-35's clash, and it is fixed by renaming, not detected.
 */

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const PLAN = path.join(ROOT, "docs", "lab-04", "tests.md");

const TEST_DIRECTORIES = [
  "server/tests/lab-04",
  "client/tests/lab-04",
  "e2e/lab-04",
];

const ROW = /^\| (?<id>[A-Z0-9]+-\d{2}) \|/u;
const FILE_IN_ROW = /`(?<file>(?:server|client|e2e)\/[^`\s]+)`/gu;
const CITED_ID = /\b(?<id>[A-Z0-9]+-\d{2})\b/gu;
const TITLE_ID =
  /\b(?:describe|it|test)(?:\.\w+)?\(\s*[`"'](?<id>[A-Z0-9]+-\d{2})\b/gu;

interface Row {
  id: string;
  files: string[];
  line: number;
}

/** Section 2 only: the later sections list criteria and rules, not tests. */
const sectionOfTests = (text: string): { text: string; offset: number } => {
  const start = text.indexOf("## 2. Planned Tests");
  const end = text.indexOf("## 3. ");

  if (start === -1 || end === -1 || end < start) {
    throw new Error("tests.md no longer has sections 2 and 3 in that order.");
  }

  return {
    text: text.slice(start, end),
    offset: text.slice(0, start).split(/\r?\n/u).length - 1,
  };
};

const rowsOfPlan = (whole: string): Row[] => {
  const { text, offset } = sectionOfTests(whole);

  return text.split(/\r?\n/u).flatMap((line, index) => {
    const match = ROW.exec(line);

    const id = match?.groups?.["id"];

    if (!id) {
      return [];
    }

    return [
      {
        id,
        files: [...line.matchAll(FILE_IN_ROW)].map(
          (one) => one.groups?.["file"] ?? ""
        ),
        line: offset + index + 1,
      },
    ];
  });
};

const sourceFiles = (directory: string): string[] =>
  readdirSync(path.join(ROOT, directory), { recursive: true })
    .map(String)
    .filter((name) => /\.(?:ts|tsx)$/u.test(name))
    .map((name) => `${directory}/${name.replaceAll("\\", "/")}`)
    .filter((file) => statSync(path.join(ROOT, file)).isFile());

const read = (relative: string): string =>
  readFileSync(path.join(ROOT, relative), "utf-8");

/** Whether `file` is one of the places a row's file cell may point at. */
const named = (row: Row, file: string): boolean =>
  row.files.some((one) =>
    one.endsWith("/") ? file.startsWith(one) : file === one
  );

const planText = read("docs/lab-04/tests.md");
const rows = rowsOfPlan(planText);
const planIds = new Set(rows.map((row) => row.id));
const prefixes = new Set([...planIds].map((id) => id.split("-")[0]));

const testFiles = TEST_DIRECTORIES.flatMap(sourceFiles);

/** Every `file -> ids` the Lab 4 tests cite, restricted to the plan's own prefixes. */
const citations = testFiles.map((file) => {
  const text = read(file);
  const ids = new Set(
    [...text.matchAll(CITED_ID)]
      .map((one) => one.groups?.["id"] ?? "")
      .filter((id) => prefixes.has(id.split("-")[0]))
  );
  const titled = new Set(
    [...text.matchAll(TITLE_ID)].map((one) => one.groups?.["id"] ?? "")
  );

  return { file, ids, titled };
});

describe("MIG-13 tests.md and the Lab 4 test files agree on their identifiers", () => {
  it("reads the plan and the test files it is about", () => {
    expect(rows.length).toBeGreaterThan(100);
    expect(testFiles.length).toBeGreaterThan(20);
    expect(existsSync(PLAN)).toBe(true);
  });

  it("every ID in tests.md is unique", () => {
    const seen = new Map<string, number[]>();

    for (const row of rows) {
      seen.set(row.id, [...(seen.get(row.id) ?? []), row.line]);
    }

    const duplicated = [...seen]
      .filter(([, lines]) => lines.length > 1)
      .map(([id, lines]) => `${id} on lines ${lines.join(", ")}`);

    expect(duplicated).toStrictEqual([]);
  });

  it("every ID a Lab 4 test file cites exists in tests.md", () => {
    const unknown = citations.flatMap(({ file, ids }) =>
      [...ids]
        .filter((id) => !planIds.has(id))
        .map((id) => `${file} cites ${id}`)
    );

    expect(unknown).toStrictEqual([]);
  });

  it("every file a row names exists, and every Lab 4 file it names cites the row's ID", () => {
    const problems: string[] = [];

    for (const row of rows) {
      for (const file of row.files) {
        const onDisk = path.join(ROOT, file);

        if (!existsSync(onDisk)) {
          problems.push(`${row.id}: ${file} does not exist`);
        }
      }

      const lab4 = row.files.filter((file) => /\/lab-04\//u.test(file));

      if (lab4.length === 0) {
        continue;
      }

      const cited = citations.some(
        ({ file, ids }) => named(row, file) && ids.has(row.id)
      );

      if (!cited) {
        problems.push(`${row.id}: none of ${lab4.join(", ")} cites it`);
      }
    }

    expect(problems).toStrictEqual([]);
  });

  it("an ID that heads a test title is in a file its row names", () => {
    const rowOf = new Map(rows.map((row) => [row.id, row]));
    const misplaced = citations.flatMap(({ file, titled }) =>
      [...titled].flatMap((id) => {
        const row = rowOf.get(id);

        return row && !named(row, file)
          ? [
              `${file} titles a test ${id}, but ${id} names ${row.files.join(", ")}`,
            ]
          : [];
      })
    );

    expect(misplaced).toStrictEqual([]);
  });
});
