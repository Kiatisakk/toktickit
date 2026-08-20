import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Button } from "../../../src/components/Button";

/** STYLE-03 — see docs/lab-02/tests.md. */

describe("button hierarchy", () => {
  it("renders the primary variant", () => {
    render(<Button variant="primary">Create Ticket</Button>);

    expect(screen.getByRole("button")).toHaveClass(
      "tkt-btn",
      "tkt-btn--primary"
    );
  });

  it("renders the secondary variant", () => {
    render(<Button variant="secondary">Cancel</Button>);

    expect(screen.getByRole("button")).toHaveClass("tkt-btn--secondary");
  });

  it("renders the destructive variant", () => {
    render(<Button variant="danger">Remove</Button>);

    expect(screen.getByRole("button")).toHaveClass("tkt-btn--danger");
  });

  // §8.3: "Buttons include visible text; icons may support but must not replace
  // unclear text."
  it("always carries visible text", () => {
    render(<Button variant="primary">Create Ticket</Button>);

    expect(screen.getByRole("button")).toHaveTextContent("Create Ticket");
  });

  it("defaults to type=button so it cannot submit a form by accident", () => {
    render(<Button>Cancel</Button>);

    expect(screen.getByRole("button")).toHaveAttribute("type", "button");
  });
});

describe("busy state", () => {
  // BR-17: the disabled busy button *is* the duplicate-submission control, so
  // this test is load-bearing rather than cosmetic.
  it("disables itself while the request is in flight", () => {
    render(
      <Button busy variant="primary">
        Create Ticket
      </Button>
    );

    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("announces itself as busy", () => {
    render(
      <Button busy variant="primary">
        Create Ticket
      </Button>
    );

    expect(screen.getByRole("button")).toHaveAttribute("aria-busy", "true");
  });

  it("swaps the label for one that says work is happening", () => {
    render(
      <Button busy busyLabel="Creating…" variant="primary">
        Create Ticket
      </Button>
    );

    expect(screen.getByRole("button")).toHaveTextContent("Creating…");
  });

  it("shows a spinner that is hidden from assistive technology", () => {
    const { container } = render(<Button busy>Create Ticket</Button>);

    expect(container.querySelector(".tkt-btn__spinner")).toHaveAttribute(
      "aria-hidden",
      "true"
    );
  });

  it("cannot be activated while busy", async () => {
    const onClick = vi.fn();

    render(
      <Button busy onClick={onClick}>
        Create Ticket
      </Button>
    );

    await userEvent.click(screen.getByRole("button"));

    expect(onClick).not.toHaveBeenCalled();
  });
});

describe("disabled state", () => {
  it("cannot be activated", async () => {
    const onClick = vi.fn();

    render(
      <Button disabled onClick={onClick}>
        Continue
      </Button>
    );

    await userEvent.click(screen.getByRole("button"));

    expect(onClick).not.toHaveBeenCalled();
  });

  it("stays activatable when enabled", async () => {
    const onClick = vi.fn();

    render(<Button onClick={onClick}>Continue</Button>);

    await userEvent.click(screen.getByRole("button"));

    expect(onClick).toHaveBeenCalledOnce();
  });
});
