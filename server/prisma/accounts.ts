import type { Role } from "../src/generated/prisma/enums.js";

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
 *
 * **All roles live here, in the reference seed**, because §7 requires the test
 * suites to be able to sign in as each of them. Lab 2 kept the IT Staff rows in
 * the demonstration seed and said so in a comment: *"Lab 3 moves them when
 * authentication gives them a purpose."* This is that move. It arrived earlier
 * than the staff features that need it because a password column that cannot be
 * null has to hold for every existing row, including theirs.
 */

export interface SeedAccount {
  email: string;
  name: string;
  role: Role;
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
 */
const REQUESTERS: SeedAccount[] = [
  {
    email: "jennifer.anderson@example.ac.th",
    name: "Jennifer Anderson",
    role: "REQUESTER",
    isActive: true,
    password: "Requester1!",
    mustChangePassword: false,
  },
  {
    email: "somchai.wattana@example.ac.th",
    name: "Somchai Wattana",
    role: "REQUESTER",
    isActive: true,
    password: "Requester2!",
    mustChangePassword: false,
  },
  {
    email: "pimchanok.srisai@example.ac.th",
    name: "Pimchanok Srisai",
    role: "REQUESTER",
    isActive: true,
    password: "Requester3!",
    mustChangePassword: false,
  },
  {
    email: "thanakorn.boonmee@example.ac.th",
    name: "Thanakorn Boonmee",
    role: "REQUESTER",
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
    role: "REQUESTER",
    isActive: true,
    password: "Starting1!",
    mustChangePassword: true,
  },
  {
    email: "natthaphong.chaiyaporn@example.ac.th",
    name: "Natthaphong Chaiyaporn",
    role: "REQUESTER",
    isActive: false,
    password: "Requester5!",
    mustChangePassword: false,
  },
];

/**
 * IT Staff — three active and one inactive, as §7 requires.
 *
 * The three active ones already existed as ticket owners in the demonstration
 * data, so they keep their identities rather than gaining duplicates under new
 * addresses. The inactive one is new, and exists so that the queue and the
 * ownership rules have a staff account that must be refused.
 */
const IT_STAFF: SeedAccount[] = [
  {
    email: "michael.brown@example.ac.th",
    name: "Michael Brown",
    role: "IT_STAFF",
    isActive: true,
    password: "ItStaff1!",
    mustChangePassword: false,
  },
  {
    email: "sarah.johnson@example.ac.th",
    name: "Sarah Johnson",
    role: "IT_STAFF",
    isActive: true,
    password: "ItStaff2!",
    mustChangePassword: false,
  },
  {
    email: "david.lee@example.ac.th",
    name: "David Lee",
    role: "IT_STAFF",
    isActive: true,
    password: "ItStaff3!",
    mustChangePassword: false,
  },
  {
    email: "arthit.saelim@example.ac.th",
    name: "Arthit Sae-Lim",
    role: "IT_STAFF",
    isActive: false,
    password: "ItStaff4!",
    mustChangePassword: false,
  },
];

/**
 * Administrators.
 *
 * One, per A-01: a single account is sufficient for the demonstration provided
 * the last-Administrator rule is tested with at least two, and that test makes
 * its own second one rather than the seed leaving a spare lying around.
 */
const ADMINISTRATORS: SeedAccount[] = [
  {
    email: "wanida.thongchai@example.ac.th",
    name: "Wanida Thongchai",
    role: "ADMIN",
    isActive: true,
    password: "Admin1!pass",
    mustChangePassword: false,
  },
];

/** Every account the reference seed writes, in a stable order. */
export const SEED_ACCOUNTS: SeedAccount[] = [
  ...REQUESTERS,
  ...IT_STAFF,
  ...ADMINISTRATORS,
];

export const accountByEmail = (email: string): SeedAccount => {
  const account = SEED_ACCOUNTS.find((row) => row.email === email);

  if (!account) {
    throw new Error(`No seeded account for ${email}.`);
  }

  return account;
};

/** Named readers, so a test says who it is signing in as. */
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
export const ACTIVE_STAFF = accountByEmail("michael.brown@example.ac.th");
export const INACTIVE_STAFF = accountByEmail("arthit.saelim@example.ac.th");
export const ADMINISTRATOR = accountByEmail("wanida.thongchai@example.ac.th");
