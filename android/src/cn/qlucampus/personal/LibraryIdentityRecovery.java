package cn.qlucampus.personal;

/** Pure state policy. The host owns network, keys and durable commits.
 *  All calls are serialized on the Android main thread. No token/password is stored here. */
public final class LibraryIdentityRecovery {
    public static final long PROBE_GAP_MS = 3_000L;
    public static final long ROUND_COOLDOWN_MS = 30_000L;
    public static final int MAX_PROBES_PER_ROUND = 2;

    public static final class Owner {
        public final long epoch, generation;
        private Owner(long epoch, long generation) { this.epoch = epoch; this.generation = generation; }
    }
    public static final class Probe {
        public final Owner owner;
        public final long serial;
        private Probe(Owner owner, long serial) { this.owner = owner; this.serial = serial; }
    }
    public static final class RestoreAttempt {
        public final Owner owner;
        public final long serial;
        private RestoreAttempt(Owner owner, long serial) { this.owner = owner; this.serial = serial; }
    }
    public static final class Snapshot {
        public final long epoch, generation, revision, retryAt;
        public final String phase, code;
        private Snapshot(long epoch, long generation, long revision, String phase, String code, long retryAt) {
            this.epoch = epoch; this.generation = generation; this.revision = revision;
            this.phase = phase; this.code = code; this.retryAt = retryAt;
        }
    }

    private long epoch, generation, revision, serial;
    private String phase = "idle", code = "";
    private long retryAt, nextProbeAt;
    private int probeCount;
    private boolean hasToken, hasCredentials, automaticUsed;
    private Probe probe;
    private RestoreAttempt restore;

    public LibraryIdentityRecovery(long epoch) { reset(epoch, false, false); }
    public void reset(long newEpoch, boolean token, boolean credentials) {
        if (newEpoch < 0) throw new IllegalArgumentException("epoch");
        epoch = newEpoch;
        generation++;
        hasToken = token; hasCredentials = credentials; automaticUsed = false;
        probe = null; restore = null; probeCount = 0; nextProbeAt = 0;
        phase = "idle"; code = ""; retryAt = 0; revision++;
    }
    public Owner owner() { return new Owner(epoch, generation); }
    public boolean owns(Owner value) {
        return value != null && value.epoch == epoch && value.generation == generation;
    }
    public boolean owns(Probe value) { return value != null && value == probe && owns(value.owner); }
    public boolean owns(RestoreAttempt value) { return value != null && value == restore && owns(value.owner); }
    public Snapshot snapshot() { return new Snapshot(epoch, generation, revision, phase, code, retryAt); }
    public boolean verified() { return "verified".equals(phase) && hasToken; }
    public boolean tokenPresent() { return hasToken; }
    public boolean automaticUsed() { return automaticUsed; }
    public int probesThisRound() { return probeCount; }
    public void credentials(boolean complete) { hasCredentials = complete; }

    private void state(String nextPhase, String nextCode, long nextRetry) {
        nextRetry = Math.max(0, nextRetry);
        if (!phase.equals(nextPhase) || !code.equals(nextCode) || retryAt != nextRetry) {
            phase = nextPhase; code = nextCode; retryAt = nextRetry; revision++;
        }
    }

    /** Called after a token has been durably committed, including same-token explicit login. */
    public Owner installedToken(boolean fromLogin) {
        generation++;
        hasToken = true; probe = null; restore = null; probeCount = 0; nextProbeAt = 0;
        if (fromLogin) automaticUsed = true;
        phase = "idle"; code = ""; retryAt = 0; revision++;
        return owner();
    }

    /** Explicit user intent retires callbacks even if the underlying WebView is reused. */
    public Owner beginVisibleLogin() {
        generation++; probe = null; restore = null; probeCount = 0; nextProbeAt = 0;
        phase = "restoring"; code = ""; retryAt = 0; revision++;
        return owner();
    }
    public void endVisibleLogin(Owner owner) {
        if (!owns(owner)) return;
        state(hasToken ? "idle" : "needs_user", hasToken ? "" : "USER", 0);
    }

    public Probe beginProbe(long now, boolean eligible) {
        if (!eligible || !hasToken || probe != null || restore != null || verified()
                || "restoring".equals(phase) || "needs_user".equals(phase)
                || "mismatch".equals(phase) || "STORAGE".equals(code)) return null;
        if (now < nextProbeAt) return null;
        if (probeCount >= MAX_PROBES_PER_ROUND) {
            if (now < retryAt) return null;
            probeCount = 0;
        }
        probe = new Probe(owner(), ++serial);
        probeCount++;
        nextProbeAt = now + PROBE_GAP_MS;
        state("checking", "", 0);
        return probe;
    }
    public boolean verifiedAfterCommit(Probe ticket) {
        if (!owns(ticket)) return false;
        probe = null;
        state("verified", "", 0);
        return true;
    }
    public boolean mismatch(Probe ticket) {
        if (!owns(ticket)) return false;
        probe = null;
        state("mismatch", "IDENTITY_MISMATCH", 0);
        return true;
    }
    public boolean retryable(Probe ticket, String errorCode, long now) {
        if (!owns(ticket)) return false;
        probe = null;
        String safe = errorCode == null || errorCode.isEmpty() ? "NETWORK" : errorCode;
        long due = probeCount >= MAX_PROBES_PER_ROUND ? now + ROUND_COOLDOWN_MS : Math.max(now, nextProbeAt);
        state("retryable", safe, due);
        return true;
    }
    /** Explicit AUTH only; call after the host durably removed this owner's token. */
    public boolean rejectedToken(Owner owner) {
        if (!owns(owner)) return false;
        hasToken = false; probe = null; restore = null;
        state(automaticUsed || !hasCredentials ? "needs_user" : "idle", "AUTH", 0);
        return true;
    }
    public void storageFailure() {
        probe = null; restore = null;
        state("retryable", "STORAGE", 0);
    }
    public RestoreAttempt beginRestore(long now, boolean eligible) {
        if (!eligible || hasToken || !hasCredentials || automaticUsed || probe != null || restore != null
                || "mismatch".equals(phase) || "STORAGE".equals(code) || "restoring".equals(phase)
                || "needs_user".equals(phase)) return null;
        automaticUsed = true;
        restore = new RestoreAttempt(owner(), ++serial);
        state("restoring", "", 0);
        return restore;
    }
    public boolean restoreFailed(RestoreAttempt ticket, boolean userNeeded, long now) {
        if (!owns(ticket)) return false;
        restore = null;
        state(userNeeded ? "needs_user" : "retryable", userNeeded ? "VERIFY" : "NETWORK",
                userNeeded ? 0 : now + ROUND_COOLDOWN_MS);
        return true;
    }
    public void suspend(long now) {
        if (probe != null || restore != null) {
            probe = null; restore = null;
            state("retryable", "PAUSED", now + PROBE_GAP_MS);
        }
    }
    public static String staleResultCode(boolean sentWrite) { return sentWrite ? "UNCERTAIN" : "STALE"; }
}
