import { describe, expect, it } from "vitest";

import {
  ACTIVE_LIMIT,
  contentDispositionFor,
  MAX_BYTES,
  PERMITTED,
  storedNameFor,
  validateRemovalReason,
  validateUpload,
} from "../../src/attachments/rules.js";

/**
 * The attachment rules, as a list, tested from the list.
 *
 * §4.5 fixes all of them — four types, five megabytes, five active per ticket,
 * a required removal reason — so the rules arrive already enumerated and every
 * one gets a test rather than a sample. Written before the implementation, the
 * way the query parser was in #18.
 *
 * None of this needs a database or an HTTP request, which is the reason it is a
 * module rather than a stretch of route handler: a rule that can only be
 * exercised through a multipart upload is a rule that gets tested once.
 */

const file = (over: Partial<Parameters<typeof validateUpload>[0]> = {}) => ({
  originalname: "battery-report.pdf",
  mimetype: "application/pdf",
  size: 284_119,
  ...over,
});

describe("permitted types", () => {
  it.each([
    ["image/jpeg", "photo.jpg"],
    ["image/png", "screen.png"],
    ["image/webp", "screen.webp"],
    ["application/pdf", "report.pdf"],
  ])("accepts %s", (mimetype, originalname) => {
    expect(validateUpload(file({ mimetype, originalname })).ok).toBe(true);
  });

  it.each([
    ["application/x-msdownload", "setup.exe"],
    ["text/html", "page.html"],
    ["image/svg+xml", "logo.svg"],
    ["application/zip", "bundle.zip"],
  ])("rejects %s", (mimetype, originalname) => {
    const result = validateUpload(file({ mimetype, originalname }));

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.code).toBe("UNSUPPORTED_FILE_TYPE");
  });

  // A browser sets Content-Type from the file extension, so a renamed
  // executable arrives claiming to be a PDF. Neither half is trustworthy alone;
  // requiring both to agree costs nothing and closes the trivial case.
  it("rejects a permitted type carrying a foreign extension", () => {
    const result = validateUpload(
      file({ mimetype: "application/pdf", originalname: "payload.exe" })
    );

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.code).toBe("UNSUPPORTED_FILE_TYPE");
  });

  it("accepts either spelling of a JPEG extension", () => {
    for (const originalname of ["holiday.jpg", "holiday.jpeg"]) {
      expect(
        validateUpload(file({ mimetype: "image/jpeg", originalname })).ok
      ).toBe(true);
    }
  });

  it("does not care about the case of the extension", () => {
    expect(
      validateUpload(
        file({ mimetype: "image/png", originalname: "SCREEN.PNG" })
      ).ok
    ).toBe(true);
  });

  it("rejects a file with no extension at all", () => {
    const result = validateUpload(
      file({ mimetype: "application/pdf", originalname: "report" })
    );

    expect(result.ok).toBe(false);
  });
});

describe("size", () => {
  it("accepts a file exactly at the limit", () => {
    expect(validateUpload(file({ size: MAX_BYTES })).ok).toBe(true);
  });

  it("rejects the first byte past it", () => {
    const result = validateUpload(file({ size: MAX_BYTES + 1 }));

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.code).toBe("FILE_TOO_LARGE");
  });

  // An empty file is not a useful attachment and is usually a failed pick.
  it("rejects an empty file", () => {
    const result = validateUpload(file({ size: 0 }));

    expect(result.ok).toBe(false);
  });

  it("states the limit in a way a person can act on", () => {
    const result = validateUpload(file({ size: MAX_BYTES + 1 }));

    expect(result.ok === false && result.message).toMatch(/5 MB/u);
  });
});

describe("the active limit", () => {
  it("is five", () => {
    expect(ACTIVE_LIMIT).toBe(5);
  });

  it("names the four permitted types and nothing else", () => {
    expect([...PERMITTED.keys()].toSorted()).toStrictEqual([
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/webp",
    ]);
  });
});

describe("the stored name", () => {
  // BR-24. The uploaded name is metadata; the name on disk is generated, so an
  // uploaded name can never become a path and never drives authorization.
  it("keeps nothing of the uploaded name but its extension", () => {
    const stored = storedNameFor("battery report.pdf");

    expect(stored).not.toContain("battery");
    expect(stored.endsWith(".pdf")).toBe(true);
  });

  it("differs every time, so two uploads of one name cannot collide", () => {
    const names = new Set(
      Array.from({ length: 50 }, () => storedNameFor("report.pdf"))
    );

    expect(names.size).toBe(50);
  });

  it.each([
    "../../etc/passwd.pdf",
    "..\\..\\windows\\system32\\config.png",
    "report.pdf .exe",
  ])("cannot be talked into a path by %s", (uploaded) => {
    const stored = storedNameFor(uploaded);

    expect(stored).not.toMatch(/[/\\]/u);
    expect(stored).not.toContain("..");
    expect(stored).not.toContain(" ");
  });
});

/**
 * A filename is user input and this is a header. A quote closes the quoted
 * string early; a newline closes the header entirely, and everything past it is
 * read as a header of its own.
 */
const filenameIn = (header: string) =>
  // Not anchored to the end of the string any more: the header now carries a
  // second parameter after the quoted one, per RFC 6266.
  /filename="(?<name>[^"]*)"/u.exec(header)?.groups?.["name"] ?? "";

describe("the download disposition", () => {
  // BR-25, D-08. Serving uploaded content inline from our own origin is how an
  // upload becomes script execution.
  it("forces a download for an image, not only for a PDF", () => {
    expect(contentDispositionFor("holiday.jpg")).toMatch(/^attachment;/u);
  });

  it("carries the name the person uploaded", () => {
    expect(contentDispositionFor("battery-report.pdf")).toContain(
      'filename="battery-report.pdf"'
    );
  });

  it.each([
    ['re"port.pdf', '"'],
    ["re\r\nport.pdf", "\r"],
    ["re\nport.pdf", "\n"],
    ["re\\\\port.pdf", "\\\\"],
    ["re\u0000port.pdf", "\u0000"],
  ])("refuses to let %j break out of the header", (uploaded, forbidden) => {
    expect(filenameIn(contentDispositionFor(uploaded))).not.toContain(
      forbidden
    );
  });

  it("still names the file after stripping what it had to strip", () => {
    expect(filenameIn(contentDispositionFor('re"port.pdf'))).toBe("report.pdf");
  });

  // Left empty the header reads `filename=""`, which some clients save as
  // a file with no name at all.
  it("falls back to a name when nothing survives", () => {
    const nothingButQuotes = String.raw`"""`;

    expect(filenameIn(contentDispositionFor(nothingButQuotes))).toBe(
      "attachment"
    );
  });
});

/**
 * RFC 6266 — from the code review of this branch.
 *
 * A header is Latin-1. A Thai filename written into `filename=` alone reaches
 * the browser mangled and saves under a corrupted name, which matters rather
 * more here than usually: this is a Thai university, and a requester attaching
 * evidence is likely to name it in Thai.
 */
describe("a filename that is not ASCII", () => {
  const THAI = "รายงานแบตเตอรี่.pdf";

  it("carries the real name in the encoded parameter", () => {
    const header = contentDispositionFor(THAI);

    expect(header).toContain(`filename*=UTF-8''${encodeURIComponent(THAI)}`);
  });

  it("still offers an ASCII fallback for anything that reads only that", () => {
    const header = contentDispositionFor(THAI);
    const fallback = /filename="(?<name>[^"]*)"/u.exec(header)?.groups?.[
      "name"
    ];

    // eslint-disable-next-line no-control-regex
    expect(fallback).toMatch(/^[ -~]*$/u);
    expect(fallback).toContain(".pdf");
  });

  it("leaves an ASCII name exactly as it was", () => {
    const header = contentDispositionFor("battery-report.pdf");

    expect(header).toContain('filename="battery-report.pdf"');
  });

  it("still forces a download", () => {
    expect(contentDispositionFor(THAI)).toMatch(/^attachment;/u);
  });

  // The encoded parameter is percent-encoded, so a quote or a newline cannot
  // reach the header through it either.
  it("encodes rather than trusts the second parameter", () => {
    const header = contentDispositionFor('re"port\r\n.pdf');

    expect(header.split("filename*=")[1]).not.toContain('"');
    expect(header.split("filename*=")[1]).not.toContain("\r");
  });
});

describe("the removal reason", () => {
  it("is required", () => {
    expect(validateRemovalReason().ok).toBe(false);
  });

  it.each(["", "  ", "\n"])("rejects %o as blank", (reason) => {
    expect(validateRemovalReason(reason).ok).toBe(false);
  });

  it("rejects anything shorter than three characters once trimmed", () => {
    expect(validateRemovalReason("  ab  ").ok).toBe(false);
  });

  it("accepts exactly three", () => {
    expect(validateRemovalReason("oops").ok).toBe(true);
  });

  it("rejects more than five hundred", () => {
    expect(validateRemovalReason("x".repeat(501)).ok).toBe(false);
  });

  it("accepts exactly five hundred", () => {
    expect(validateRemovalReason("x".repeat(500)).ok).toBe(true);
  });

  it("stores the trimmed reason, not what was typed around it", () => {
    const result = validateRemovalReason("  wrong screenshot  ");

    expect(result.ok && result.value).toBe("wrong screenshot");
  });

  it("rejects a non-string, rather than reading it as absent", () => {
    expect(validateRemovalReason(42).ok).toBe(false);
    expect(validateRemovalReason(["a", "b"]).ok).toBe(false);
  });
});
