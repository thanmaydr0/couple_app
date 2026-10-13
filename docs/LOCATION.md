# Optional Android location sharing

Location is OFF on every fresh installation. Opening the map, receiving a push,
or viewing a partner's point never enables your own sharing. Each person goes
through the explanation and Android permission steps independently.

## Permissions and controls

The feature deliberately blocks real sharing until the shared Android `index.js`
imports `./src/features/location/headless` before Expo Router. This ensures tasks
and the notification Stop handler are loaded during a cold headless launch, when
React layouts are not mounted. The current feature session cannot edit that shared
entry under its ownership rules; the app clearly reports the missing integration.
The requirement follows the [TaskManager global-scope contract](https://docs.expo.dev/versions/latest/sdk/task-manager/#taskmanagerdefinetasktaskname-taskexecutor)
and [notification background-event registration guidance](https://notifee.app/react-native/docs/events/#background-events).

Choose **Live for 1 hour** (default), **8 hours**, or **Until I stop**. First grant
foreground location. The next in-app guide explains Android's **Allow all the
time** setting before opening background permission settings. Notifications must
also be enabled, including the **Location sharing controls** channel.

While sharing, an app-wide banner and a foreground-service notification say
**You're sharing your location**. The notification has a **Stop** action, and the
screen and banner also provide Stop. Expo Location creates its own service
notification; the installed Notify Kit library provides a second foreground
notification containing the Stop action. No notification contains coordinates.

Stop disables uploads immediately and removes local consent. Online, the latest
server point and temporary journey are deleted. Offline, the app clearly reports
pending server deletion and retries on reconnect/foreground recovery. The last
server point can remain visible until deletion succeeds or its expiry is reached.
**Until I stop has no expiry: an offline Stop cannot instantly revoke a remote
point.** Prefer the one-hour mode when this matters.

## Android battery settings

These are optional, per-app adjustments for **Us**, only for someone who wants
background sharing. They can increase battery use. Menu labels vary by phone and
OS release; use Settings search if the exact path is absent. The app opens its
Android app-settings page rather than attempting undocumented vendor intents.

| Phone | Settings to check for Us |
| --- | --- |
| Xiaomi / Redmi / POCO | Settings → Apps → Permissions → Background autostart; enable Us. In Us app info → Battery saver, choose No restrictions where available. |
| Oppo / Realme | App info → Battery usage / App battery management → Allow background activity. Settings → Apps → Auto launch, enable Us if this menu exists. Older ColorOS uses Phone Manager → Startup Manager. |
| Vivo / iQOO | Settings → Battery → Background power consumption management → Us; allow High background power consumption where available. Also allow Autostart in app/permission management if offered. |
| OnePlus | Settings → Battery → App battery management → Us → Allow background activity. Older OxygenOS offers Battery optimization → Don't optimize. Check Apps → Auto launch if present. |
| Samsung | Settings → Battery and device care → Battery → Background usage limits → Never sleeping apps; add Us and remove it from Sleeping/Deep sleeping apps. |

Manufacturer references: [Xiaomi autostart](https://www.mi.com/global/support/faq/details/KA-507611/),
[Xiaomi app battery limits](https://www.mi.com/global/support/article/KA-61830/),
[OPPO startup manager](https://support.oppo.com/co/answer/?aid=neu119),
[OPPO background activity guide from Huawei](https://consumer.huawei.com/ph/support/content/en-us15848664/),
[Vivo battery support](https://www.vivo.com/en/support/questionList?categoryId=54716),
[OnePlus manual](https://service.oneplus.com/content/dam/support/user-manuals/en/OnePlus_Open_User_Manual_EN.pdf),
[Samsung background app exceptions](https://developer.samsung.com/mobile/app-management.html).

Android can interrupt updates after force-stop, a vendor kill, or reboot. Open Us
again to resume a previously opted-in, unexpired session, subject to unchanged
permissions and a matching live server row. Automatic restart after reboot is
not guaranteed by [Expo's Android background-location implementation](https://docs.expo.dev/versions/latest/sdk/location/#background-location).
Recovery never creates a missing server point.

## Data and map configuration

- `locations` holds exactly one latest point per user, including accuracy,
  speed/heading, battery and expiry. It has no history table or coordinate log.
- Partner reads require the same couple **and** `sharing_until > now()` in SQL.
  The app also removes expired markers without waiting for Realtime events and
  hides markers offline or when backgrounded.
- Cron deletes expired points within its next minute and removes related journeys.
  RLS blocks partner reads at expiry even before cron runs.
- Journey destinations are temporary; Stop deletes them with the latest point,
  and cron removes arrived/cancelled/orphan journeys. Saved places are separately
  chosen persistent destinations, private to their owner and individually deletable.
- Place alerts default OFF and are limited to 20 enabled regions in both the app
  and SQL. They only run during sharing. Alert text discloses the chosen place name.
- Battery alerts occur below 15% and at 5%, once per drop, with recovery hysteresis
  of three percentage points. They are suppressed while charging.
- No coordinates are persisted on the phone by this feature. Consent and pending
  revocation metadata are persisted; current points remain only in memory.
- PostgreSQL WAL/backups follow the hosting provider's retention. Application-row
  deletion does not claim immediate erasure from provider-managed backups.

MapLibre reads `EXPO_PUBLIC_MAP_STYLE_URL` at bundle time. An absent/invalid URL
shows a setup message; no fallback URL or provider key is embedded in source.
An optional `{theme}` placeholder becomes `dark` or `light`. Use a provider style
compatible with that substitution, or supply a complete themed style URL.
OpenStreetMap and MapTiler attribution remain visible with working links.

Geocoding uses Open-Meteo town/city search, not street-address routing. Only the
typed search term is sent; the current GPS point is never attached. Distances and
ETAs are straight-line estimates, not traffic or road directions. Arrival detection
requires a fix with accuracy at most 100 m within 150 m of the destination.

Developer builds expose **Simulate movement**. It uses synthetic coordinates in
component memory, stops when backgrounded, and never calls the sharing, geofence,
journey, storage, or notification pipelines. Real sharing is disabled during preview.

## Regression / privacy checklist

- [x] Fresh state has no location row and no permissions requested at mount.
- [x] Real sharing fails closed until cold-headless entry registration is integrated.
- [x] A partner can read a live row, cannot edit/delete it, and cannot reassign ownership.
- [x] A partner cannot read a point or journey after sharing expiry, before cleanup.
- [x] An outsider cannot read points; anonymous REST requests are denied.
- [x] Online Stop deletes the point and temporary journey; stale callbacks cannot upsert.
- [x] Offline Stop leaves durable pending deletion, with a clear warning and retry.
- [x] The 21st enabled saved-place alert is rejected by SQL.
- [x] Cron is registered and has completed successfully on the hosted database.
- [x] The tests roll back fixtures; no real location sharing or partner push was enabled.
- [ ] On two Android phones: verify precise → all-the-time permission flow and denial.
- [ ] Verify notification Stop while app foreground/backgrounded, including a cold JS task.
- [ ] Verify expiry and service teardown while stationary, locked, offline, and after reboot.
- [ ] Verify native map style, avatars, accuracy, attribution, camera controls and Reduced/Off motion.
- [ ] Verify departure/arrival/geofence/battery push delivery on the partner phone.
- [ ] Verify vendor battery behavior and large text/Android accessibility.

The unchecked items require Android hardware. `adb devices` returned no attached
device during this implementation; no native build or dependency installation ran.
