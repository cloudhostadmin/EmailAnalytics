# Google Workspace setup

The full steps are in [GETTING_STARTED.md](GETTING_STARTED.md):

* **Step 3** covers the Google Cloud project, the Gmail API, the Internal consent screen and the OAuth client, used for Sign in with Google and each person's own inbox.
* **Step 4** covers the service account and domain-wide delegation for shared mailboxes such as orders@, kalyan@ and info@.

Scopes used:

| Scope | Why |
| --- | --- |
| `openid`, `email`, `profile` | Sign in with Google |
| `https://www.googleapis.com/auth/gmail.readonly` | Read mail for analysis and drafts |
| `https://www.googleapis.com/auth/gmail.send` | Send a reply, only when a person presses Send |

Gita Mail never modifies, labels, moves or deletes mail. Set `GMAIL_SEND_ENABLED=false` to remove sending entirely: drafts can then only be copied.
