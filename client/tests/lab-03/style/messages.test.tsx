import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { InternalNotes } from "../../../src/components/InternalNotes";

/**
 * STYLE-07 — the Internal Notes restriction is stated in text (BR-04), not
 * conveyed by tint alone.
 *
 * A tint is not available to a screen reader or to a reader who cannot
 * distinguish it. The heading, the standing note and the composer's own hint
 * each say who cannot see this — three places, so removing any one of them
 * still leaves the fact on screen.
 */
describe("STYLE-07 the note section restriction is textual", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const renderNotes = () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ data: [] }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        )
      )
    );

    render(<InternalNotes ticketId={42} />);
  };

  it("states the restriction in words, more than once", async () => {
    renderNotes();

    expect(
      await screen.findByRole("heading", { name: /internal notes/iu })
    ).toBeInTheDocument();

    await waitFor(() => {
      // The standing note under the heading and the hint on the composer.
      expect(
        screen.getAllByText(/not visible to the requester/iu).length
      ).toBeGreaterThanOrEqual(2);
    });
  });

  it("labels the section for assistive technology", async () => {
    renderNotes();

    const heading = await screen.findByRole("heading", {
      name: /internal notes/iu,
    });
    const section = heading.closest("section");

    expect(section?.getAttribute("aria-labelledby")).toBe(heading.id);
    expect(heading.id).not.toBe("");
  });
});
