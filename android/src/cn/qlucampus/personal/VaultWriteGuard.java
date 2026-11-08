package cn.qlucampus.personal;

/** Main-thread-owned persistence policy. Default deny until a load result is known. */
public final class VaultWriteGuard {
    public enum State { ABSENT, READY, UNREADABLE }
    private State state = State.UNREADABLE;
    private boolean loadCompleted;

    public void loaded(State state) {
        if (state == null) throw new IllegalArgumentException("state");
        this.state = state;
        loadCompleted = true;
    }
    public State state() { return state; }
    public String wireState() { return state.name().toLowerCase(java.util.Locale.ROOT); }
    public boolean loadCompleted() { return loadCompleted; }
    public boolean mayWrite(boolean explicitReplacement, boolean completeCredentials) {
        return loadCompleted && (state != State.UNREADABLE || (explicitReplacement && completeCredentials));
    }
    /** Call only after the actual encrypted write and rename have succeeded. */
    public void committed() { state = State.READY; loadCompleted = true; }
    public String persistence(boolean completeCredentials, boolean remembered) {
        if (!loadCompleted || state == State.UNREADABLE) return "unavailable";
        if (!completeCredentials) return "none";
        return remembered ? "saved" : "sessionOnly";
    }
}
