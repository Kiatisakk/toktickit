/**
 * The seeded accounts and their credentials.
 *
 * A separate module from `seed.ts` because the tests need to sign in as these
 * people, and `seed.ts` runs its seed at import time. D-15 says tests
 * authenticate through the real endpoint, so they need the real passwords;
 * hard-coding them in each test file instead would mean the seed and the tests
 * could drift apart silently.
 *
 * These are demonstration credentials for a course project against a local
 * database. They are deliberately in the repository — an assessor is expected
 * to be able to clone, seed and sign in.
 */

export interface SeedAccount {
  email: string;
  name: string;
  isActive: boolean;
  password: string;
  /** BR-02: set for the account that demonstrates the first-sign-in flow. */
  mustChangePassword: boolean;
}

/**
 * Development Requesters — the identities Lab 2's selection screen offers and
 * Lab 3's sign-in screen accepts.
 *
 * Five active and one inactive. The inactive one exists to be refused: BR-07
 * keeps it out of the selector, and BR-09 makes signing in as it answer
 * `ACCOUNT_INACTIVE` — but only once its password has verified, which is why it
 * needs a real password like everyone else.
 *
 * Every row is a REQUESTER. IT Staff and Administrator accounts arrive with the
 * tickets that need them.
 */
export const REQUESTER_ACCOUNTS: SeedAccount[] = [
  {
    email: "jennifer.anderson@example.ac.th",
    name: "Jennifer Anderson",
    isActive: true,
    password: "Requester1!",
    mustChangePassword: false,
  },
  {
    email: "somchai.wattana@example.ac.th",
    name: "Somchai Wattana",
    isActive: true,
    password: "Requester2!",
    mustChangePassword: false,
  },
  {
    email: "pimchanok.srisai@example.ac.th",
    name: "Pimchanok Srisai",
    isActive: true,
    password: "Requester3!",
    mustChangePassword: false,
  },
  {
    email: "thanakorn.boonmee@example.ac.th",
    name: "Thanakorn Boonmee",
    isActive: true,
    password: "Requester4!",
    mustChangePassword: false,
  },
  {
    // The first-sign-in demonstration. The flag is restored on every seed run
    // (D-16): the test that demonstrates the flow consumes it, so a
    // create-if-absent seed would let that test pass once and fail afterwards.
    email: "kanya.pongsakorn@example.ac.th",
    name: "Kanya Pongsakorn",
    isActive: true,
    password: "Starting1!",
    mustChangePassword: true,
  },
  {
    email: "natthaphong.chaiyaporn@example.ac.th",
    name: "Natthaphong Chaiyaporn",
    isActive: false,
    password: "Requester5!",
    mustChangePassword: false,
  },
];

/** Convenience readers, so a test names the person rather than an index. */
export const accountByEmail = (email: string): SeedAccount => {
  const account = REQUESTER_ACCOUNTS.find((row) => row.email === email);

  if (!account) {
    throw new Error(`No seeded account for ${email}.`);
  }

  return account;
};

export const ACTIVE_REQUESTER = accountByEmail(
  "jennifer.anderson@example.ac.th"
);
export const SECOND_REQUESTER = accountByEmail("somchai.wattana@example.ac.th");
export const MUST_CHANGE_REQUESTER = accountByEmail(
  "kanya.pongsakorn@example.ac.th"
);
export const INACTIVE_REQUESTER = accountByEmail(
  "natthaphong.chaiyaporn@example.ac.th"
);
