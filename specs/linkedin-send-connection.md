## LinkedIn Send Connection Plan

1. Open target profile URL and wait for page settle.
2. Dismiss transient popups or overlays.
3. Detect terminal states:
- already connected (1st degree / Message button)
- request already pending (Pending button)
4. Locate Connect button using ordered selectors.
5. If not found, open More actions menu and retry Connect selectors.
6. Click Connect and wait for modal.
7. If note text provided:
- click Add a note
- type note with human typing
8. Click Send / Send without a note.
9. Re-validate pending/connected state and return structured result.

Fallbacks:
- primary profile button row
- overflow More menu
- aria-label variants
