# Frontend & UI Guidelines

This document outlines the UX and UI requirements for the private personal music listener web app.

## Design Philosophy & Constraints
- **Mobile-first:** The application is designed primarily for mobile browsers, but remains fundamentally usable at desktop widths (e.g., constrained content columns, reasonable touch targets, avoiding edge-to-edge stretching for large lists).
- **Aesthetic:** Polished consumer music app feel (similar to NetEase Cloud Music / QQ Music), featuring strong hierarchy, album-art focus, rounded cards, clean typography, and clear touch targets. 
- **Localization:** Bilingual UI supporting English and 中文 (Chinese Simplified).
- **Multi-tenant:** Users may belong to multiple workspaces. "Active workspace" is chosen post-login. Users only interact with music within their active workspace.
- **Roles:** Tenant roles are Owner, Member, and Viewer. Viewer roles can listen but cannot edit; editor controls should remain visible but disabled with a tooltip or short reason (e.g., "Viewer role can listen only").
- **Exclusions:** No public browsing, social feeds, sharing, or public signup. Deletions are non-reversible from the user's perspective (no trash/restore UI). In-flight uploads do not appear in the library until complete.

## Overall App Structure
A persistent bottom navigation bar is used for primary consumer routing:
- **Home**
- **Library**
- **Playlists**
- **Settings**

*Note:* Upload is accessed via shortcuts on Home or Library, not as a bottom tab. Platform admins access the admin area via `Settings → Admin`.

A persistent mini-player appears above the bottom navigation during playback, featuring a thumbnail, track title, artist, play/pause, and an expand affordance.

## Pages and States


1. Sign In Page
Purpose: user logs into their private music library.
UI elements:
- App logo or wordmark
- Short tagline such as "Your private music library"
- Email field
- Password field
- Sign In button
- Optional Forgot Password link (for contacting an admin)
- Small EN / 中文 language toggle in a corner
Do NOT include a "Create Account" link or a Sign Up page. Accounts are admin-provisioned only.

2. Tenant Picker Page (post-login)
Purpose: user chooses which workspace to enter for this session.
Shown only when a user belongs to more than one workspace, or when a user re-enters the picker from Settings → Switch Workspace.
For platform admins, also show this page when they have no direct workspace
memberships; admins can browse all workspaces and enter any workspace.
UI elements:
- Header "Choose a workspace"
- List of workspace cards, each with:
  - Workspace name
  - User's role in that workspace (Owner / Member / Viewer), or an Admin
    access label when the platform admin is not a member
  - "Last used" chip on whichever workspace matches the user's most-recent active tenant (single workspace only)
- Tap a card to enter that workspace and go to Home
Single-workspace non-admin users skip this screen and land on Home directly
after Sign In.

3. Home Page
Purpose: main landing page after workspace selection.
UI elements:
- Greeting/header (includes active workspace name)
- Search entry point that navigates to a dedicated Search page backed by the
  server-side tracks/playlists search endpoint
- Shortcut row with concise labels: Library, Playlists, Player, Upload
- Continue Listening card (populated from server-side playback history)
- Recently Played horizontal list (server-side history)
- Recently Uploaded horizontal list
- Recently Updated Playlists section
- Bottom navigation
- Mini-player if something is playing
Do not include public recommendations or trending music.

4. Library / All Music Page
Purpose: browse all uploaded tracks in the active workspace.
UI elements:
- Page title "Library"
- Search bar (server-side search)
- Filter/sort chips:
  - Recently Added
  - Title
  - Artist
  - Album
- Music list rows with:
  - Cover thumbnail or fallback icon
  - Track title
  - Artist or "Unknown Artist"
  - Duration
  - More menu button
- Select mode button for bulk actions
- Empty state variant if no music exists
Possible row menu actions:
- Play
- Play Next
- Add to Queue
- Add to Playlist
- View Lyrics
- Edit Metadata
- Delete
Do not render in-flight uploads here.

5. Music Detail Page
Purpose: inspect one track.
UI elements:
- Large cover image or placeholder
- Track title
- Artist
- Album
- Duration
- File format badge, such as MP3, M4A/MP4, AAC, WAV, FLAC, OGG/Opus, WebM audio
- Lyrics status badge:
  - Synced Lyrics
  - Plain Lyrics
  - No Lyrics
  - Invalid Lyrics
- Primary Play button
- Secondary actions:
  - Add to Queue
  - Edit Metadata
  - Upload/Replace Lyrics
  - Add to Playlist
  - Delete
This page should account for incomplete downloaded-file metadata.

6. Edit Music Metadata Page
Purpose: edit track information.
UI elements:
- Header with Cancel and Save
- Cover image selector
- Text fields:
  - Title
  - Artist
  - Album
  - Track Number
  - Genre
  - Year
- Lyrics file section:
  - Current lyrics file
  - Replace lyrics file
  - Remove lyrics file
- Destructive Delete Music action at the bottom
Design as a mobile page, not a desktop modal.

7. Upload Page
Purpose: upload audio and lyrics files.
UI elements:
- Page title "Upload"
- Large tap-to-select upload area
- Secondary hint: "Upload audio files and .lrc lyrics files"
- Supported audio format hint:
  - MP3, M4A/MP4, AAC, WAV, FLAC, OGG/Opus, WebM audio
- Bulk upload supported hint
- Buttons:
  - Select Files
  - Upload All
- Explain filename matching visually:
  - song-name.mp3
  - song-name.lrc
  - matched automatically
Do not show desktop drag-and-drop as the main pattern.

8. Upload Review Page
Purpose: review selected files before upload.
UI elements:
- List of detected audio files
- For each item:
  - File name
  - Detected title
  - Detected artist, if available
  - Matched lyrics file, if available
  - Status badge
- Status badge examples:
  - Ready
  - Lyrics Matched
  - Lyrics Missing
  - Unsupported Format
- Per-track actions:
  - Choose Lyrics File
  - Remove
- Bottom fixed action button:
  - Upload All

9. Upload Progress Page
Purpose: show uploading and processing. This is the ONLY place in-flight tracks appear before they become part of the Library.
UI elements:
- Overall progress bar
- Per-file progress rows
- States:
  - Uploading
  - Processing Metadata
  - Processing Lyrics
  - Completed
  - Failed
- Failed item actions:
  - Retry
  - Remove
- Completion state:
  - "Upload complete"
  - Buttons: View Library, Upload More

10. Playlists Page
Purpose: manage custom playlists in the active workspace.
UI elements:
- Page title "Playlists"
- Search playlists (server-side)
- Create Playlist button
- Playlist cards/list rows showing:
  - Generated cover (based on playlist name, e.g. monogram/color tile)
  - Playlist name
  - Number of tracks
  - Updated date
  - Play button
  - More menu
- Empty state if no playlists exist:
  - "No playlists yet"
  - Create Playlist button
Do not include public playlists or social playlists.

11. Create Playlist Page
Purpose: create a custom playlist.
UI elements:
- Header with Cancel and Save
- Generated playlist cover preview (based on playlist name; not manually selectable)
- Playlist Name field
- Description field, optional
- Create button
Keep it simple.

12. Edit Playlist Page
Purpose: rename or modify playlist details.
UI elements:
- Header with Cancel and Save
- Generated playlist cover preview (based on playlist name; not manually selectable)
- Playlist Name field
- Description field
- Delete Playlist action
- Confirmation state for delete

13. Playlist Detail Page
Purpose: listen to and manage tracks inside a playlist.
UI elements:
- Playlist cover
- Playlist name
- Track count
- Total duration
- Play button
- Add Music button
- Track list with:
  - Track title
  - Artist
  - Duration
  - More menu
- Edit/reorder mode entry
Track menu actions:
- Play Next
- Add to Queue
- Remove from Playlist
- View Details
- View Lyrics
- Delete from Library, shown as a more dangerous separate action

14. Add Music to Playlist Page
Purpose: choose tracks to add to a playlist.
UI elements:
- Search bar (server-side)
- Music list with checkboxes
- Selected count
- Add Selected button fixed at bottom
- Already added state
- Empty search result state

15. Reorder Playlist Page
Purpose: reorder tracks inside playlist.
UI elements:
- Playlist title
- Track rows with drag handles
- Save Order button
- Cancel button
Touch-friendly.

16. Full Player Page
Purpose: main listening experience.
Make this one of the most visually prominent screens.
UI elements:
- Large album art
- Track title
- Artist
- Playlist or queue context
- Progress slider
- Current time and duration
- Previous button
- Play/Pause button
- Next button
- Lyrics button
- Queue button
- More menu
- Optional repeat/shuffle controls if useful
More menu actions:
- Add to Playlist
- View Track Details
- Edit Metadata
- Delete
Show how the mini-player expands into this full player.

17. Lyrics Player Page
Purpose: synced lyrics reading and seeking. Signature feature.
UI elements:
- Track title and artist
- Small playback controls
- Progress indicator
- Scrollable lyrics view
- Active lyric line centered and highlighted
- Surrounding lyric lines above and below with softer visual weight
- Tap/click lyric line to seek
- Small hint: "Tap a line to jump"
- Optional visible timestamps in subtle style, such as [01:24.30]
Show this as a mobile web page, not an OS lock screen.
Include lyric states:
- Synced lyrics available
- Plain lyrics available but not seekable
- No lyrics uploaded
- Invalid lyrics file

18. Queue / Now Playing Page
Purpose: show the user's persisted current and upcoming tracks for the active workspace.
Design as a mobile bottom sheet or full mobile page.
UI elements:
- Current track section
- Upcoming tracks list
- Drag handles for reordering queue, if included
- Remove from queue action
- Clear queue button
- Play from selected track action
Do not include social listening, public queue features, or per-device-only queue
language; the queue follows the signed-in user within the active workspace.

19. Settings Page
Purpose: account and playback preferences.
UI elements:
- Account section:
  - Email
  - Active workspace name + "Switch Workspace" row (re-opens the Tenant Picker)
  - Change Password (opens page #20)
  - Sign Out
- Playback section:
  - Auto-play next track toggle
  - Show mini-player toggle, if useful
  - Prefer synced lyrics toggle, if useful
- Library management section:
  - Default sort order
  - Default playlist behavior, optional
- Appearance section:
  - Theme segmented control: System / Light / Dark
  - Changes autosave immediately and update the browser theme without a submit
- Language section:
  - English / 中文 (selectable)
  - Changes autosave immediately and update the app locale without a submit
- Admin section (visible only when the signed-in user is a platform admin):
  - "Admin" row opening the Admin area (pages #21–#24)
Do not include storage usage charts, billing, subscriptions, public profile, friends, or admin analytics.

20. Change Password Page
Purpose: user changes their own password.
UI elements:
- Header with Cancel and Save
- Current password field
- New password field
- Confirm new password field
- Inline strength hint
- Save button
- Success state: "Password updated" toast and return to Settings
- Error states: wrong current password, weak password

21. Admin — Users Page
Purpose: platform admin CRUD on users (cross-tenant).
UI elements:
- Page title "Admin · Users"
- Search bar with Search / Clear controls (username)
- User list rows:
  - Username
  - Admin badge, if applicable
  - Disabled badge, if applicable
  - Workspace count
  - Created date
- "Create User" form with username, temporary password, platform admin toggle, and optional initial workspace membership chosen from a searchable selector
- Row tap opens User Detail (username, admin flag, disabled flag, workspace memberships with roles, Reset Password, Disable/Enable, Delete)
- Destructive actions use confirmation sheets
Note: admins cannot demote or delete themselves; show these actions disabled with a tooltip/explanation.

22. Admin — Create User Page
Purpose: admin seeds a new account.
UI elements:
- Header with Cancel and Create
- Username field
- Password field
- Confirm password field
- "Mark as platform admin" toggle (off by default)
- Optional "Add to workspace" selector with role (Owner / Member / Viewer; searchable by workspace name and id; can be skipped; memberships can be added later)
- Create button
After creation: brief success toast and return to Users list. The admin is responsible for sharing the username+password out-of-band; the app does NOT display a copyable credential dialog.

23. Admin — Tenants Page
Purpose: platform admin CRUD on tenants (workspaces).
UI elements:
- Page title "Admin · Tenants"
- Search bar with Search / Clear controls (name)
- Tenant list rows:
  - Workspace name
  - Member count (all active Owner / Member / Viewer memberships)
  - Track count, optional
  - Created date
- "Create Tenant" form with name and required initial owner chosen from a searchable user selector
- Row tap opens Tenant Detail:
  - Edit name
  - Members list (tap opens page #24)
  - Enter Workspace button — admin switches active workspace to this one to view its content as admin
  - Delete Tenant (confirmation; notes that all tracks and playlists within are removed)

24. Admin — Tenant Members Page
Purpose: manage memberships for a given tenant.
UI elements:
- Tenant name header
- Member list rows:
  - Username
  - Role (Owner / Member / Viewer)
  - Joined date
  - Remove button
- "Add Member" form — search existing active users by username, pick a role
- Role change affordance per row (Owner / Member / Viewer) with confirmation
- Do not allow removing the last Owner; show the action disabled with an explanation

25. Admin — Audit Logs Page
Purpose: read-only audit log viewer.
UI elements:
- Page title "Admin · Audit Logs"
- Filter bar: actor username, target tenant, action type, date range
- Log row:
  - Timestamp
  - Actor (username + admin badge if applicable)
  - Action (e.g., user.create, user.update, user.reset_password, tenant.create, tenant.delete, tenant.admin_enter, membership.create, membership.update, membership.delete)
  - Target (username, tenant name, membership pair)
  - Tap for detail sheet with raw metadata
- Empty state if no logs match filters

26. Empty and Error State Cards
Create small reusable mobile state cards for:
- Empty Library:
  "You haven't uploaded any music yet."
  Button: Upload Music
- Empty Playlist:
  "This playlist is empty."
  Button: Add Music
- No Lyrics:
  "No lyrics file uploaded."
  Button: Upload Lyrics
- Invalid Lyrics:
  "This lyrics file could not be parsed."
  Button: Replace Lyrics
- Upload Failed:
  Shows failed file name, reason, Retry, Remove
- Unsupported Format:
  Shows unsupported file name and accepted formats
- Loading:
  Skeleton list rows for music library
- Account Disabled (at Sign In):
  "This account is disabled. Contact your admin."
- Search No Results:
  "No matches for '<query>'"

Information architecture and board layout:
Arrange the design board in sections from left to right or top to bottom:
- Auth & Workspace (Sign In, Tenant Picker)
- Home and Navigation
- Library and Music Management
- Upload Flow
- Playlist Flow
- Player and Lyrics
- Settings & Account
- Admin (Users, Create User, Tenants, Tenant Members, Audit Logs)
- Empty/Error States
- Localization sample (a few screens in 中文)

Use clear section labels and page labels. Use connector arrows to show important flows:
- Sign In → Tenant Picker → Home (single-workspace users skip the picker)
- Settings → Switch Workspace → Tenant Picker
- Home → Search
- Home → Full Player
- Mini-player → Full Player
- Library → Music Detail → Edit Metadata
- Library → Upload
- Upload → Upload Review → Upload Progress → Library
- Playlists → Playlist Detail → Add Music / Reorder
- Full Player → Lyrics Player
- Full Player → Queue
- Settings → Change Password
- Settings → Admin → (Users | Tenants | Audit Logs)
- Admin · Tenants → Tenant Detail → Tenant Members
- Admin · Tenants → Enter Workspace → Home (as admin)
- Platform admin with no memberships → Tenant Picker showing all workspaces

Interaction annotations:
Add small callout labels for important interactions:
- "Tap track to play"
- "Tap mini-player to expand"
- "Tap lyric line to seek"
- "Audio and .lrc files can be bulk uploaded"
- "Files with matching names are paired automatically"
- "All music is private to your workspace"
- "Admins can enter any workspace"
- "Admin-created users get credentials out-of-band"
- "Viewers can listen but cannot edit workspace content"

## Audio Control & Playback Guidelines

### 1. Persistent Audio Element
- Use a single, long-lived HTML5 `<audio>` element. Treat it as the single source of truth for the playback state.
- **Autoplay Policy:** Browsers (especially iOS Safari) require one explicit user gesture (e.g., a tap on a "Play" button) to start the first track. 
- Once playback is "armed" by this initial user gesture, it is safe to programmatically change the `src` attribute and call `audio.play()` on the `ended` event to smoothly play the next track in the queue.

### 2. Auto-Play & Queue Progression
- Arm the queue progression logic on the first actual playback event (e.g., listening to the native `play` or `playing` event), rather than solely attaching it to a custom UI button. This prevents auto-play failures if playback is initiated from native browser controls (e.g., from the lock screen).
- The upcoming track list should be loaded from the persisted backend queue (`GET /queue`). Queue mutations should route through the REST API.
- Advancement to the next track is driven by the `<audio>` element's `ended` event.

### 3. Background Play & Lock Screen Controls
- Background playback functions correctly using the standard `<audio>` element as long as the session was properly initialized by a user gesture.
- **Media Session API:** Register Media Session metadata (`navigator.mediaSession.metadata`) and action handlers (`play`, `pause`, `previoustrack`, `nexttrack`) whenever the active track changes. This ensures the native OS lock screen and notification controls reflect the current track and work correctly.
- Ensure bidirectional synchronization: native media actions (like pausing from the lock screen) must update the web page's UI state, and web UI actions must update the audio element.

### 4. Development & QA
- Keep detailed event logging for audio state transitions during development, as browser media behavior is highly sensitive to platform differences and timing.
- Final QA for audio progression and background play must be performed on physical iOS and Android devices, as emulators do not accurately reproduce background execution constraints.
