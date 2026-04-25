Create a very detailed UX/Figma-style design board for a mobile-first web app. Primary mockups are mobile; the same pages must also be at-least-basically usable at desktop widths (no dedicated desktop mockups needed, just make sure the responsive intent is obvious — e.g. constrain content column, don't stretch list rows edge-to-edge, keep touch targets sane).

The product is a private personal music listener web app for a small multi-tenant deployment (an operator seeds tenants and users; there is no public signup). Signed-in users upload their own music files and synced lyrics files, organize music into custom playlists, and listen to their private library on mobile browsers. Platform admins additionally manage users, tenants, memberships, and audit logs.

Do not design the consumer pages as an admin dashboard. The consumer pages should feel like a polished consumer music app similar in structure to NetEase Cloud Music / QQ Music, but with original visual styling. Do not force a red brand color. Choose a tasteful modern music-app visual system with strong hierarchy, album-art focus, rounded cards, clean typography, and clear touch targets. Admin pages may look more utilitarian (tables, forms) but should reuse the same type system and color palette.

Important constraints:
- Mobile-first design, basically usable on desktop (no separate desktop mockups required)
- Bilingual UI: English and 中文 (Chinese Simplified). Mock key screens in English; a few representative screens should be shown in 中文 to prove typography/layout works
- Private library only; no public browsing, no social feed, no sharing
- No public signup. Accounts are created by platform admins
- Multi-tenant: a user may belong to multiple workspaces (tenants). An "active workspace" is chosen post-login; platform admins may additionally enter any workspace
- Users only listen to music they uploaded into their active workspace
- Users can upload audio files and lyrics files
- Bulk upload is supported
- Custom playlists are supported
- Lyrics are mainly synced lyrics, such as .lrc files
- Tapping a synced lyric line should seek playback to that line
- The design should focus on pages, flows, and UI states, not backend, database, S3, or deployment
- Do not include unrelated pages such as storage analytics, social profiles, public discovery, friends, comments, subscriptions, payments, charts, radio, podcasts, or recommendation feeds
- Do not show trash / restore UI. Deletions are non-reversible from the user's perspective (soft-delete is a backend concern, invisible in the app)
- Do not show "pending upload" tracks in the Library — in-flight uploads only appear on the Upload Progress page. A track joins the Library only after it finishes uploading

Design a single large, high-resolution landscape Figma-style overview board containing many mobile page mockups. Each mobile screen should be clearly labeled. Arrange the pages in a logical flow with section headers and light connector arrows where useful.

Overall mobile app structure:
Use a bottom navigation bar with:
- Home
- Library
- Upload
- Playlists
- Settings

(There is no "Admin" tab. Platform admins reach the admin area via Settings → Admin.)

Show a persistent mini-player above the bottom navigation whenever appropriate. The mini-player should include tiny album art, track title, artist, play/pause button, and an expand affordance.

Include the following mobile web pages and states:

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
UI elements:
- Header "Choose a workspace"
- List of workspace cards, each with:
  - Workspace name
  - User's role in that workspace (Owner / Member)
  - "Last used" chip on whichever workspace matches the user's most-recent active tenant (single workspace only)
- Tap a card to enter that workspace and go to Home
Single-workspace users skip this screen and land on Home directly after Sign In.

3. Home Page
Purpose: main landing page after workspace selection.
UI elements:
- Greeting/header (includes active workspace name)
- Search entry point (backed by a server-side search endpoint across tracks/playlists)
- Continue Listening card (populated from server-side playback history)
- Recently Played horizontal list (server-side history)
- Recently Uploaded horizontal list
- Recently Updated Playlists section
- Upload shortcut card
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
- Language section:
  - English / 中文 (selectable)
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
- Search bar (email)
- Filter chips: All / Admins / Disabled
- User list rows:
  - Email
  - Admin badge, if applicable
  - Disabled badge, if applicable
  - Workspace count
  - Created date
- "Create User" button (opens page #22)
- Row tap opens User Detail (email, admin flag, disabled flag, workspace memberships with roles, Reset Password, Disable/Enable, Delete)
- Destructive actions use confirmation sheets
Note: admins cannot demote or delete themselves; show these actions disabled with a tooltip/explanation.

22. Admin — Create User Page
Purpose: admin seeds a new account.
UI elements:
- Header with Cancel and Create
- Email field
- Password field
- Confirm password field
- "Mark as platform admin" toggle (off by default)
- Optional "Add to workspace" selector with role (can be skipped; memberships can be added later)
- Create button
After creation: brief success toast and return to Users list. The admin is responsible for sharing the email+password out-of-band; the app does NOT display a copyable credential dialog.

23. Admin — Tenants Page
Purpose: platform admin CRUD on tenants (workspaces).
UI elements:
- Page title "Admin · Tenants"
- Search bar (name)
- Tenant list rows:
  - Workspace name
  - Member count
  - Track count, optional
  - Created date
- "Create Tenant" button with form (name, required initial owner)
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
  - Email
  - Role (Owner / Member)
  - Joined date
  - Remove button
- "Add Member" action — search existing users by email, pick a role
- Role change affordance per row (Owner ↔ Member) with confirmation
- Do not allow removing the last Owner; show the action disabled with an explanation

25. Admin — Audit Logs Page
Purpose: read-only audit log viewer.
UI elements:
- Page title "Admin · Audit Logs"
- Filter bar: actor email, target tenant, action type, date range
- Log row:
  - Timestamp
  - Actor (email + admin badge if applicable)
  - Action (e.g., user.create, user.update, user.reset_password, tenant.create, tenant.delete, tenant.admin_enter, membership.create, membership.update, membership.delete)
  - Target (user email, tenant name, membership pair)
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

Visual quality:
- High-fidelity mobile web app mockups
- Dense but readable
- Realistic spacing for mobile screens
- Modern music-app aesthetic on consumer pages; utilitarian but consistent on admin pages
- Consistent components across consumer and admin surfaces
- Clear hierarchy
- Touch-friendly controls
- Avoid cluttered admin-table appearance on consumer pages
- Use realistic placeholder album art or abstract music artwork
- Use readable English labels (with a 中文 sample set on key screens)
- Landscape design board, high resolution, suitable for understanding the whole product at a glance
- Confirm the responsive intent: content columns should not stretch edge-to-edge on wide screens; the app must remain usable (not necessarily polished) at desktop widths
