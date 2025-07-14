BEHIND-THE-SCENES and bugfixes
    #526 use <Link> and proper nextjs routing throughout app
    #523 fix links in a nextjs way
    #562 certain filenames cause downloads to fail
    #547 audit limited user perms
    #536 when creating events/items with a dialog which adds new tags, a crash occurs
    #535 rework db3 slightly so column special functions are better organized and standardized
    #569 add user mass analytic tab
    #481 merge usersmust-have
    #563 file serving produces unseekable media
    #549 relevant event card has nested links ... that's not allowed.
    #376 strip data from user payloadmust-have
    #512 site with www. prefix does not work
    #517 transient exceptions sometimes when clicking links
    #544 fixing bugs: some visibility permissions problems/inconsistencies

setlist planner
    #513 ungrouped setlist plans should just not be grouped together; bring them to the top level so there's now a heirarchical optionquick-fix
    #516 markdown editing in setlist planner needs fixingsetlist planner
    #543 make setlist grouping more structured, or make setlists accessible outside of eventssetlist planner
    #548 allow setlist plans to be ordered within groupsetlist planner
    #560 setlist planner should warn duplicates and show song indicators like normal setlistssetlist planner
    #527 setlist planner should support copying as a setlist-compatible jsonsetlist planner
    #498 setlist planner should warn about dupe songssetlist planner

MEDIA PLAYER
    #524 media player bar persistence across pagesmedia bar
    #521 replace current audio file preview with a global soundcloud-like audio playermedia bar
    #522 playlist support for media barmedia bar
    #507 Need a way to quick-play songs from setlists. helps during setlist creationmedia bar

MARKDOWN / WIKI
    #520 ABC music notation to image server-side rendering
    #496 site map for wiki pages / ability to see a list of wiki pages
    #542 wiki page tags support
    #539 add tagged wiki pages to files model
    #491 images in wiki pages should by default automatically scale to the width if larger than widthmarkdown
    #497 show wiki page visibility indicatorquick-fix
    #494 add more highlight colorsmarkdown
    #495 add a hashcolor markdown directivemarkdown
    #500 when pasting images / files / attachments into markdown editor, add the relevant event tagsmarkdown

USER LANDING PAGE / PROFILE
    #532 wiki contributions tab on user page
    #510 refine user page
    #550 add user search for finding brand new users
    #541 make user search & page visible to everyoneuser page
    #540 bring all functionality of user admin grid to the user profile pageuser page
    #518 indicate that profile info is only visible to site admins

FILES
    #528 file page & search
    #254 file list doesn't have a sort by NAME option (duh?)

DASHBOARD / SITE CHROME
    #545 collapsible side bar menu item groups
    #570 qr code generation endpoint
    #525 dashboard left menu items sometimes not highlighted
    #564 migrate dashboard to a grid layout to prevent overlapping areas

METRONOME
    #557 metronome: remember last bpm
    #559 metronome should support keyboard shortcuts
    #554 metronome + and - should be smarter.
    #558 metronome knob should support click-to-select bpm on the knob
    #553 metronome add markings to aide practice, so down to 60 for ex

SETLISTS
    #561 setlist share column for song length & delta time
    #504 song tag indicator: use tag coloringsetlists
    #505 dividers cause setlist delta time to show a +. and better divider support in general in the editorsetlists
    #503 song tag indicator: select explicit lanesetlists
    #508 by default don't "break" setlist timingsetlists

SONGS
    #499 Song search: Sort by BPM
    #502 tempo line doesn't show in song page metadata table when start tempo is empty
    #529 ability to pin recordings on songs

ANALYTICS
    #485 pie chart data is not sorted by usageactivity log
    #487 detail expansion is not filtering enoughactivity log
    #567 activity features for recent featuresactivity log
    #486 filter controls not available in detail viewactivity log
    #489 make sure to capture unknown browsersactivity log
    #490 add an anonymized ledger reportactivity log
    #488 show all summaries on totals tabactivity log
    #484 crash if viewing details about a feature report "feature" that's not in the hardcoded enumactivity log
    #492 normalize activity log / control activity log sizeactivity log
    #493 find a way to pivot table activity logactivity log
    #572 custom link visit feature activity recording

ATTENDANCE
    #531 expose when attendance last updated per response
    #514 people feel that they cannot change their attendance response
    #410 allow editing attendance responses even when fully answered

RELEVANT EVENTS
    #506 front page quick events display needs to show status
    #556 relevant events: try to show at least 1
    #555 event pinning override

MISC / GENERAL
    #509 make user chip links in attendance tabs (and elsewhere?)
    #565 Show events on date picker

------------------

not done:
#501 make it more intuitive to attach files to markdown
