// DialogueConfig.cs — the Reconcile skill's shipped worked example (OUTPUT 2 of the
// example-workflow Arcgram, the "Config + tuning panel" node). It lives here beside
// reconcile.mjs as the one runnable real-file demo: pair it with the diagram
// example-workflow.html (in ../../examples/) and Reconcile confirms they agree.
// Each value below is declared @spec on the diagram's CONFIG / FEATURE nodes; run
// Reconcile to keep this file and the diagram in lockstep:
//
//     cd arcgram-v2/public/skills/reconcile
//     node reconcile.mjs ../../examples/example-workflow.html example-workflow.config.cs
//
// In Unity these would be the default values of a ScriptableObject the designer tunes;
// here they are plain constants so the diagram <-> code bijection is easy to read.
public static class DialogueConfig
{
    public const int SLIDE_IN_MS     = 180;   // @spec CONFIG.slide_in_ms  — bubble slide-in
    public const int HOLD_MS         = 800;   // @spec CONFIG.hold_ms       — how long a line holds
    public const int FADE_MS         = 200;   // @spec CONFIG.fade_ms       — fade-out duration
    public const int IDLE_TIMEOUT_MS = 6000;  // @spec CONFIG.idle_timeout_ms — auto-advance timeout
    public const int MAX_LINES       = 3;     // @spec FEATURE.max_lines    — cap before yielding
}
