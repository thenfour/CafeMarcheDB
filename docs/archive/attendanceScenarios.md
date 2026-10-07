# Attendance scenarios

Open `/backstage/test/attendance` as a sysadmin, or use **Admin Tools → Attendance scenarios**.

Set the shared event's segment count, timing, and cancellation. Expand event details
to override individual segment timing or change the fixed reference clock. Expand
each user's configuration to change invitations, profile instruments, the primary
instrument, the stored event instrument, segment responses, and the comment.

The list-card and event-detail previews are interactive. They share each simulated
user's recorded values and keep their own editing state. Changes stay in React
state; the sandbox does not call the attendance mutation or record attendance
activity. The real markdown comment editor is used, with file uploads disabled.
Site-authored comment-dialog wording is replaced with local explanatory text.

**Copy current scenario** exports the current data, including changes made through
the controls. Paste it into **Scenario JSON** and choose **Load JSON** to reproduce
it. Import validates the format before replacing the current scenario. **Reset
user** and **Reset to loaded scenario** restore the last loaded configuration;
**Restore defaults** restores the initial four personas. Reloading the page also
restores defaults.

Fixtures use three sample attendance options and four sample instruments rather
than the site's database options. Response values distinguish missing rows from
explicitly cleared answers. The clock is fixed and exported; generated dates use
the production aggregate-date helper, excluding cancelled segments. An event with
no active segments has TBD aggregate dates. Dates display in the viewer's timezone.

## Shared implementation

- `EventAttendanceComponents.tsx` supplies production data, persistence, telemetry,
  feedback, and refetching to `AttendanceControlView`.
- `attendanceCalculation.ts` contains the existing calculation with explicit inputs.
- `AttendanceControlView.tsx` contains the shared interactive presentation.
- `attendanceScenario.ts` creates fixtures through the existing invitation and
  instrument-default helpers, and applies local changes.
- `AttendanceScenarioPage.tsx` supplies scenario controls and diagnostics.

This extraction preserves the current attendance policy, including compact mode
after the final answer and how cancelled responses affect `anyAnswered`. Use the
page to inspect those decisions before changing policy or adding broader automated
coverage. A hidden preview includes an explanation; the calculation panel shows
the underlying flags and dates.
