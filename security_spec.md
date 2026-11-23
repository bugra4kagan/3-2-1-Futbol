# Security Specification — 3-2-1 Football Challenge

## 1. Data Model & Ownership Invariants
- **`/users/{userId}` (`UserAccountBackup`)**:
  - Represents the private cloud save of a single authenticated, email-verified user.
  - Document ID `{userId}` MUST equal `request.auth.uid` and match `^[a-zA-Z0-9_-]{1,128}$`.
  - Contains PII (`email`), so reads (`get`) and writes are strictly owner-only; `allow list: if false` prevents user enumeration.
- **`/usernames/{usernameKey}` (`UserHandleReservation`)**:
  - Represents an atomic uniqueness lock for a normalized player username (`^[a-z0-9_]{3,32}$`).
  - Contains ZERO PII (only `usernameKey`, `displayName`, `ownerUid`, `updatedAt`).
  - `allow get` is permitted by exact normalized key so players can check username availability before signing in; `allow list: if false` forbids scraping all usernames.
  - Only an email-verified authenticated user can `create` an unclaimed handle (`ownerUid == request.auth.uid`), `update` display casing of their own handle, or `delete` their own handle when renaming.
- **`/publicProfiles/{usernameKey}` (`PublicPlayerProfile`)**:
  - Publicly inspectable non-PII profile, match statistics, and optional bounded latest activity fields (`lastActivityId`, `lastActivityType`, `lastActivityTitle`, `lastActivityCode`, `lastActivityScore`) keyed by normalized username (`^[a-z0-9_]{3,32}$`).
  - Strictly excludes PII and wallet data (`email`, `recoveryCode`, `coins`).
  - `allow get` is permitted by exact `usernameKey` lookup; `allow list: if false` forbids collection scraping.
  - Only the email-verified owner (`ownerUid == request.auth.uid`) may create, update (with immutable `ownerUid` and `usernameKey`), or delete their public profile.

## 2. The "Dirty Dozen" Payloads (Expected: PERMISSION_DENIED)
1. **Unverified email creating `/users/{uid}`**: `request.auth.token.email_verified == false`.
2. **UID spoofing on `/users/{otherUid}`**: `userId != request.auth.uid`.
3. **Email spoofing on `/users/{uid}`**: `email != request.auth.token.email`.
4. **Shadow field injection on `/users/{uid}`**: adding `isAdmin: true` or `role: 'super'` -> blocked by `hasOnly(...)`.
5. **Oversized `progressionJson` (> 100KB) or oversized ID**: blocked by `.size() <= 100000` and `isValidId()`.
6. **Client-forged timestamp (`updatedAt`)**: blocked by `updatedAt == request.time`.
7. **Mutating immutable `userId` or `email` on `/users/{uid}` update**: blocked by `incoming().userId == existing().userId && incoming().email == existing().email`.
8. **Hijacking someone else's `/usernames/{usernameKey}` on create/update**: `ownerUid` belongs to another UID -> `create` fails because document exists, `update` fails because `existing().ownerUid != request.auth.uid`.
9. **Deleting another player's `/usernames/{usernameKey}`**: blocked by `existing().ownerUid == request.auth.uid`.
10. **Invalid `usernameKey` format** (e.g., uppercase, spaces, `< 3` chars, `> 32` chars, or `usernameKey != pathKey`): blocked by `isValidUsernameKey()`.
11. **Listing all `/users`, `/usernames`, or `/publicProfiles` documents**: blocked by `allow list: if false`.
12. **Ghost PII/wallet field injection on `/usernames/{usernameKey}` or `/publicProfiles/{usernameKey}`** (e.g., adding `email`, `recoveryCode`, or `coins`) or **UID spoofing on `/publicProfiles/{usernameKey}`**: blocked by `hasOnly(...)` and `ownerUid == request.auth.uid`.
