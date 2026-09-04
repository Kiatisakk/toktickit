import { defineConfig } from "oxfmt";
import ultracite from "ultracite/oxfmt";

export default defineConfig({
  ...ultracite,
  ignorePatterns: [
    ...ultracite.ignorePatterns,

    // Markdown is prose, and these documents are graded evidence rather than
    // source. Two reasons to keep the formatter out of them:
    //
    // The Lab 1 documents under docs/lab-01/ were rendered and screenshotted
    // into a PDF that has already been submitted. Reflowing them now would mean
    // the repository no longer matches the evidence handed in.
    //
    // The Lab 2 documents are hand-wrapped so that tables stay readable and
    // paragraphs break where the argument does. A formatter reflowing them
    // gains nothing a reader would notice and loses something they would.
    //
    // Prose is reviewed by reading it. That is the check, and it already exists.
    "**/*.md",
  ],
});
