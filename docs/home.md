# Setlist playback

...

# Activity feature recording

Mostly don't do it on the server because:

1. the point of these is to track client activity
for feature usage, not an audit log of backend changes.
2. the server doesn't get direct access to a lot of the important data like screen info.

### on the client

  * `<AppContextMarker>`
  * `useClientTelemetryEvent` react hook provides a callable to record a feature use.
  * (obsolete) `useFeatureRecorder` react hook provides a callable to record a feature use using a normal mutation. Actually we can consider this obsolete because it is the same thing but less efficient than `useClientTelemetryEvent`

### on the server

  * `recordAction` will accept a context string. Server doesn't have a DOM hierarchy so there's no equivalent to `<AppContextMarker>`.
