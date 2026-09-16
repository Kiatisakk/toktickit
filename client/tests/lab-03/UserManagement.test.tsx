import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ManagedUser } from "../../src/lib/adminUsers";
import { PASSWORD_RULES } from "../../src/lib/passwordRules";
import { UserManagement } from "../../src/routes/UserManagement";
import { authContext, renderWithAuth } from "../support/auth";

/**
 * UI-21 to UI-24 — the Administrator User Management screen (ui-spec.md §8).
 *
 * `fetch` is stubbed: these assert what the screen does with each answer. That
 * the server gives those answers is the API suite's job (API-32 to API-39).
 */

const ADMIN: ManagedUser = {
  id: 11,
  name: "Wanida Thongchai",
  email: "wanida.thongchai@example.ac.th",
  role: "ADMIN",
  isActive: true,
};

const REQUESTER: ManagedUser = {
  id: 1,
  name: "Jennifer Anderson",
  email: "jennifer.anderson@example.ac.th",
  role: "REQUESTER",
  isActive: true,
};

const INACTIVE: ManagedUser = {
  id: 6,
  name: "Natthaphong Chaiyaporn",
  email: "natthaphong.chaiyaporn@example.ac.th",
  role: "REQUESTER",
  isActive: false,
};

const USERS = [REQUESTER, INACTIVE, ADMIN];

const json = (body: unknown, status = 200) =>
  ({ ok: status < 400, status, json: async () => body }) as Response;

const refusal = (code: string, message: string, details?: object) =>
  json({ error: { code, message, ...(details ? { details } : {}) } }, 409);

/**
 * Answers the list with `USERS` and every write with `onWrite`, and records the
 * writes so a test can say what was — and was not — sent.
 */
const stubApi = (onWrite: (init: RequestInit) => Response = () => json({})) => {
  const fetchMock = vi.fn((_url: string, init?: RequestInit) =>
    Promise.resolve(
      init?.method && init.method !== "GET" ? onWrite(init) : json(USERS)
    )
  );

  vi.stubGlobal("fetch", fetchMock);

  return fetchMock;
};

const writesOf = (fetchMock: ReturnType<typeof stubApi>) =>
  fetchMock.mock.calls
    .filter(([, init]) => init?.method && init.method !== "GET")
    .map(([url, init]) => ({
      url,
      method: init?.method,
      body: JSON.parse(String(init?.body)),
    }));

const renderScreen = () =>
  renderWithAuth(<UserManagement />, {
    context: authContext({
      user: { ...ADMIN },
    }),
    path: "/admin/users",
  });

/** The visible table, not the cards that stand in for it on mobile. */
const table = () => screen.getByRole("table");

const rowFor = (name: string) => {
  const cell = within(table()).getByText(name);
  const row = cell.closest("tr");

  if (!row) {
    throw new Error(`No row for ${name}.`);
  }

  return row;
};

const openEdit = async (user: ManagedUser) => {
  await screen.findByRole("table");
  await userEvent.click(
    within(rowFor(user.name)).getByRole("button", {
      name: new RegExp(`^Edit ${user.name}`, "u"),
    })
  );

  return screen.getByRole("region", { name: `Edit ${user.name}` });
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("UI-21 the user list", () => {
  it("shows name, email, role and status for each user, with an Edit action", async () => {
    stubApi();
    renderScreen();

    await screen.findByRole("table");

    expect(
      within(table())
        .getAllByRole("columnheader")
        .map((header) => header.textContent)
    ).toStrictEqual(["Name", "Email", "Role", "Status", "Edit"]);

    const row = within(rowFor(REQUESTER.name));

    expect(row.getByText(REQUESTER.email)).toBeInTheDocument();
    expect(row.getByText("Requester")).toBeInTheDocument();
    expect(row.getByText("Active")).toBeInTheDocument();
    expect(
      row.getByRole("button", { name: `Edit ${REQUESTER.name}` })
    ).toBeInTheDocument();
  });

  it("shows inactive users as Inactive rather than hiding them", async () => {
    stubApi();
    renderScreen();

    await screen.findByRole("table");

    expect(
      within(rowFor(INACTIVE.name)).getByText("Inactive")
    ).toBeInTheDocument();
  });

  it("names roles in words, never enum values", async () => {
    stubApi();
    renderScreen();

    await screen.findByRole("table");

    expect(
      within(rowFor(ADMIN.name)).getByText("Administrator")
    ).toBeInTheDocument();
    expect(within(table()).queryByText("ADMIN")).not.toBeInTheDocument();
  });

  it("asks the API for the search and the role chosen", async () => {
    const fetchMock = stubApi();
    renderScreen();

    await screen.findByRole("table");
    await userEvent.type(screen.getByLabelText("Search"), "jen");
    await userEvent.selectOptions(screen.getByLabelText("Role"), "IT_STAFF");

    await waitFor(() => {
      const last = String(fetchMock.mock.calls.at(-1)?.[0]);

      expect(last).toContain("search=jen");
      expect(last).toContain("role=IT_STAFF");
    });
  });

  it("offers a retry when the list cannot be loaded", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new TypeError("Failed to fetch")))
    );
    renderScreen();

    expect(await screen.findByText("Could not load users")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Try again" })
    ).toBeInTheDocument();
  });
});

describe("UI-22 the create form", () => {
  it("offers exactly one role, as a select", async () => {
    stubApi();
    renderScreen();

    await userEvent.click(
      await screen.findByRole("button", { name: "Create User" })
    );

    const panel = screen.getByRole("region", { name: "Create User" });
    const role = within(panel).getByLabelText(/^Role/u);

    expect(role.tagName).toBe("SELECT");
    expect(role).not.toHaveAttribute("multiple");
    expect(
      within(panel).queryByRole("checkbox", { name: /requester|staff|admin/iu })
    ).toBeNull();
    expect(
      within(role)
        .getAllByRole("option")
        .map((option) => option.textContent)
    ).toStrictEqual(["Requester", "IT Staff", "Administrator"]);
  });

  it("shows the password rules on the initial password, ticking as they are met", async () => {
    stubApi();
    renderScreen();

    await userEvent.click(
      await screen.findByRole("button", { name: "Create User" })
    );

    const panel = screen.getByRole("region", { name: "Create User" });
    const rules = within(panel).getByRole("list", {
      name: "Password requirements",
    });

    expect(within(rules).getAllByText(/— not yet met/u)).toHaveLength(
      PASSWORD_RULES.length
    );

    await userEvent.type(
      within(panel).getByLabelText(/^Initial password/u),
      "Starting9!"
    );

    expect(within(rules).getAllByText(/— met/u)).toHaveLength(
      PASSWORD_RULES.length
    );
  });

  it("does not send a starting password that breaks the rules", async () => {
    const fetchMock = stubApi();
    renderScreen();

    await userEvent.click(
      await screen.findByRole("button", { name: "Create User" })
    );

    const panel = screen.getByRole("region", { name: "Create User" });

    await userEvent.type(within(panel).getByLabelText(/^Name/u), "New Person");
    await userEvent.type(
      within(panel).getByLabelText(/^Email/u),
      "new.person@example.ac.th"
    );
    await userEvent.type(
      within(panel).getByLabelText(/^Initial password/u),
      "weak"
    );
    await userEvent.click(
      within(panel).getByRole("button", { name: "Create User" })
    );

    expect(writesOf(fetchMock)).toStrictEqual([]);
  });

  it("sends name, email, one role, the active state and the starting password", async () => {
    const created = {
      ...REQUESTER,
      id: 99,
      name: "New Person",
      email: "new.person@example.ac.th",
      role: "IT_STAFF" as const,
    };
    const fetchMock = stubApi(() => json(created, 201));
    renderScreen();

    await userEvent.click(
      await screen.findByRole("button", { name: "Create User" })
    );

    const panel = screen.getByRole("region", { name: "Create User" });

    await userEvent.type(within(panel).getByLabelText(/^Name/u), "New Person");
    await userEvent.type(
      within(panel).getByLabelText(/^Email/u),
      "new.person@example.ac.th"
    );
    await userEvent.selectOptions(
      within(panel).getByLabelText(/^Role/u),
      "IT_STAFF"
    );
    await userEvent.type(
      within(panel).getByLabelText(/^Initial password/u),
      "Starting9!"
    );
    await userEvent.click(
      within(panel).getByRole("button", { name: "Create User" })
    );

    await waitFor(() => {
      expect(writesOf(fetchMock)).toStrictEqual([
        {
          url: expect.stringContaining("/api/admin/users"),
          method: "POST",
          body: {
            name: "New Person",
            email: "new.person@example.ac.th",
            role: "IT_STAFF",
            isActive: true,
            initialPassword: "Starting9!",
          },
        },
      ]);
    });
  });
});

describe("UI-23 a duplicate email", () => {
  it("is reported against the Email field", async () => {
    stubApi(() =>
      refusal(
        "EMAIL_ALREADY_EXISTS",
        "Another account already uses that email address.",
        {
          email: "Another account already uses this email address.",
        }
      )
    );
    renderScreen();

    const panel = await openEdit(REQUESTER);
    const email = within(panel).getByLabelText(/^Email/u);

    await userEvent.clear(email);
    await userEvent.type(email, ADMIN.email);
    await userEvent.click(
      within(panel).getByRole("button", { name: "Save Changes" })
    );

    const message = await within(panel).findByText(
      "Another account already uses this email address."
    );

    // Beneath the field it concerns (§8.3), and announced as that field's error.
    expect(email.closest(".tkt-field-group")).toContainElement(message);
    expect(email).toHaveAttribute("aria-invalid", "true");
  });
});

describe("UI-24 refusals", () => {
  it("springs the Active toggle back when an Administrator deactivates themselves", async () => {
    stubApi(() =>
      refusal(
        "CANNOT_DEACTIVATE_SELF",
        "You cannot deactivate your own account."
      )
    );
    renderScreen();

    const panel = await openEdit(ADMIN);
    const active = within(panel).getByRole("switch", { name: "Active" });

    await userEvent.click(active);
    expect(active).not.toBeChecked();

    await userEvent.click(
      within(panel).getByRole("button", { name: "Save Changes" })
    );

    expect(
      await within(panel).findByText(/cannot deactivate your own account/iu)
    ).toBeInTheDocument();
    expect(active).toBeChecked();
  });

  it("puts the role and state back, with its own message, when the last Administrator would be lost", async () => {
    stubApi(() =>
      refusal("LAST_ACTIVE_ADMIN", "This is the only active Administrator.")
    );
    renderScreen();

    const panel = await openEdit(ADMIN);
    const role = within(panel).getByLabelText(/^Role/u);

    await userEvent.selectOptions(role, "IT_STAFF");
    await userEvent.click(
      within(panel).getByRole("button", { name: "Save Changes" })
    );

    const message = await within(panel).findByText(
      /only active Administrator/iu
    );

    expect(message).toHaveAttribute("role", "alert");
    expect(message.textContent).not.toMatch(/deactivate your own/iu);
    expect(role).toHaveValue("ADMIN");
  });

  it("does not update the row until the server has agreed", async () => {
    stubApi(() =>
      refusal(
        "CANNOT_DEACTIVATE_SELF",
        "You cannot deactivate your own account."
      )
    );
    renderScreen();

    const panel = await openEdit(ADMIN);

    await userEvent.click(
      within(panel).getByRole("switch", { name: "Active" })
    );
    await userEvent.click(
      within(panel).getByRole("button", { name: "Save Changes" })
    );
    await within(panel).findByText(/cannot deactivate your own account/iu);

    expect(within(rowFor(ADMIN.name)).getByText("Active")).toBeInTheDocument();
  });

  it("updates the row with what the server returned once it has", async () => {
    stubApi(() => json({ ...REQUESTER, isActive: false }));
    renderScreen();

    const panel = await openEdit(REQUESTER);

    await userEvent.click(
      within(panel).getByRole("switch", { name: "Active" })
    );
    await userEvent.click(
      within(panel).getByRole("button", { name: "Save Changes" })
    );

    await waitFor(() => {
      expect(
        within(rowFor(REQUESTER.name)).getByText("Inactive")
      ).toBeInTheDocument();
    });
  });

  it("sends only the fields that changed", async () => {
    const fetchMock = stubApi(() => json({ ...REQUESTER, role: "IT_STAFF" }));
    renderScreen();

    const panel = await openEdit(REQUESTER);

    await userEvent.selectOptions(
      within(panel).getByLabelText(/^Role/u),
      "IT_STAFF"
    );
    await userEvent.click(
      within(panel).getByRole("button", { name: "Save Changes" })
    );

    await waitFor(() => {
      expect(writesOf(fetchMock)).toStrictEqual([
        {
          url: expect.stringContaining(`/api/admin/users/${REQUESTER.id}`),
          method: "PATCH",
          body: { role: "IT_STAFF" },
        },
      ]);
    });
  });
});

describe("setting a new initial password", () => {
  it("is confirmed before it fires, and never shows an existing password", async () => {
    const fetchMock = stubApi(
      () => ({ ok: true, status: 204, json: async () => null }) as Response
    );
    renderScreen();

    const panel = await openEdit(REQUESTER);

    await userEvent.click(
      within(panel).getByRole("button", { name: /Set a New Initial Password/u })
    );

    // Opening the action sends nothing.
    expect(writesOf(fetchMock)).toStrictEqual([]);
    expect(
      within(panel).getByText(/signed out everywhere/iu)
    ).toBeInTheDocument();

    const field = within(panel).getByLabelText(/^New initial password/u);

    expect(field).toHaveValue("");

    await userEvent.type(field, "Replaced7!");
    await userEvent.click(
      within(panel).getByRole("button", { name: "Set Password" })
    );

    await waitFor(() => {
      expect(writesOf(fetchMock)).toStrictEqual([
        {
          url: expect.stringContaining(
            `/api/admin/users/${REQUESTER.id}/password`
          ),
          method: "POST",
          body: { initialPassword: "Replaced7!" },
        },
      ]);
    });
    expect(await within(panel).findByRole("status")).toHaveTextContent(
      /must choose their own/iu
    );
  });
});

/* PR #61 review — three paths the first version got wrong. */

const renderAs = (refresh: () => Promise<void>) =>
  renderWithAuth(<UserManagement />, {
    context: authContext({ user: { ...ADMIN }, refresh }),
    path: "/admin/users",
  });

const listReads = (fetchMock: ReturnType<typeof stubApi>) =>
  fetchMock.mock.calls.filter(
    ([, init]) => !init?.method || init.method === "GET"
  ).length;

describe("after saving an account", () => {
  it("re-reads the list when a search is active, since the edit may take the row out of it", async () => {
    const fetchMock = stubApi(() => json({ ...REQUESTER, role: "IT_STAFF" }));
    renderScreen();

    await screen.findByRole("table");
    await userEvent.type(screen.getByLabelText(/^Search/u), "Jen");
    await waitFor(() => {
      expect(fetchMock.mock.calls.at(-1)?.[0]).toContain("search=Jen");
    });

    const panel = await openEdit(REQUESTER);
    const before = listReads(fetchMock);

    await userEvent.selectOptions(
      within(panel).getByLabelText(/^Role/u),
      "IT_STAFF"
    );
    await userEvent.click(
      within(panel).getByRole("button", { name: "Save Changes" })
    );

    // Patching the row in place would keep a row the search may no longer
    // match; the list is asked for again with the same search instead.
    await waitFor(() => {
      expect(listReads(fetchMock)).toBeGreaterThan(before);
    });
    expect(fetchMock.mock.calls.at(-1)?.[0]).toContain("search=Jen");
  });

  it("re-reads the signed-in identity when the account saved is your own", async () => {
    const refresh = vi.fn(() => Promise.resolve());
    stubApi(() => json({ ...ADMIN, role: "IT_STAFF" }));
    renderAs(refresh);

    const panel = await openEdit(ADMIN);

    await userEvent.selectOptions(
      within(panel).getByLabelText(/^Role/u),
      "IT_STAFF"
    );
    await userEvent.click(
      within(panel).getByRole("button", { name: "Save Changes" })
    );

    // Without this the header and navigation would stay Administrator while
    // every call answered 403 (BR-15 applies the role on the next request).
    await waitFor(() => {
      expect(refresh).toHaveBeenCalledTimes(1);
    });
  });

  it("does not re-read the identity for somebody else's account", async () => {
    const refresh = vi.fn(() => Promise.resolve());
    stubApi(() => json({ ...REQUESTER, name: "Jennifer A." }));
    renderAs(refresh);

    const panel = await openEdit(REQUESTER);

    await userEvent.clear(within(panel).getByLabelText(/^Name/u));
    await userEvent.type(within(panel).getByLabelText(/^Name/u), "Jennifer A.");
    await userEvent.click(
      within(panel).getByRole("button", { name: "Save Changes" })
    );

    await within(table()).findByText("Jennifer A.");
    expect(refresh).not.toHaveBeenCalled();
  });
});

describe("setting your own new initial password", () => {
  it("re-reads the identity instead of reporting success, because your session has ended", async () => {
    const refresh = vi.fn(() => Promise.resolve());
    stubApi(
      () => ({ ok: true, status: 204, json: async () => null }) as Response
    );
    renderAs(refresh);

    const panel = await openEdit(ADMIN);

    await userEvent.click(
      within(panel).getByRole("button", { name: /Set a New Initial Password/u })
    );
    await userEvent.type(
      within(panel).getByLabelText(/^New initial password/u),
      "Replaced7!"
    );
    await userEvent.click(
      within(panel).getByRole("button", { name: "Set Password" })
    );

    // The server ended every session this user holds, this one included. The
    // refreshed identity is anonymous and the route guard sends them to sign in.
    await waitFor(() => {
      expect(refresh).toHaveBeenCalledTimes(1);
    });
    expect(
      within(panel).queryByText(/must choose their own/iu)
    ).not.toBeInTheDocument();
  });
});
