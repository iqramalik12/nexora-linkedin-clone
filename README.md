# Nexora

**Connect. Grow. Succeed.**

Nexora is a professional network: sign up, build a profile with photos, share posts with
images, like, comment, repost and save, connect with people, message your connections,
get notifications, and find, post and apply to jobs.

Stack: React 18 + Vite (client), Node.js + Express (API), MongoDB via Mongoose.

Built by reverse engineering LinkedIn as a product: its screens, flows and features were
studied from the outside and rebuilt from scratch. No LinkedIn code, assets or data are used,
and Nexora is not affiliated with LinkedIn.

## Run it locally

You need Node.js 20 or newer and a MongoDB server (local `mongod`, Docker, or a free
MongoDB Atlas cluster).

```bash
npm install                      # installs server and client
cp server/.env.example server/.env   # then set MONGODB_URI and JWT_SECRET
npm run seed                     # optional: sample people, posts and messages
npm run dev                      # API on :4000, app on http://localhost:5173
```

Sample sign-in after seeding: **iqra@nexora.dev** / **nexora123**
(every seeded person uses the same password, e.g. ayesha@nexora.dev).

Quick MongoDB with Docker: `docker run -d -p 27017:27017 --name nexora-db mongo:7`

### Production

```bash
npm run build                    # builds the React app into client/dist
NODE_ENV=production JWT_SECRET=... MONGODB_URI=... npm start
```

Express serves the built app and the API from one port (default 4000).

## Tests

```bash
npm test             # API tests. Uses mongodb-memory-server, or TEST_MONGODB_URI if set
npm run test:e2e     # 22 browser checks of the core flows against a running app (npm run build && npm start, after npm run seed)
```

`node e2e/smoke-new.mjs` runs 11 more browser checks for photos, reposts, saved posts,
notifications and jobs (set `BASE_URL`, default http://localhost:5173).

The browser checks need Chromium once: `npx playwright install chromium`. To use the
installed Edge instead, set `CHANNEL=msedge` for smoke-new, or `CHROMIUM_PATH` for run.mjs.

## Features

| Area | What works |
| --- | --- |
| Accounts | Sign up, sign in, sign out, sign out of every device, change password, delete account (removes all your data) |
| Profiles | Name, headline, location, about, experience, skills, profile photo and cover photo; edit your own; view anyone's with their posts |
| Feed | Create and delete posts with an optional photo, hashtags, "See more", like/unlike, comment, delete comments, repost or repost with your thoughts, save posts, copy a link to a post, load more |
| Notifications | Likes, comments, reposts, invitations, accepted invitations and job applications; live badge, filters, mark as read |
| Jobs | Search by title, skill, company and location; filter by workplace and job type; post, edit, close and delete jobs; save; Easy Apply with a note; posters see applicants |
| Network | Send, accept, ignore and withdraw invitations; remove connections; people you may know; search people |
| Messaging | Conversations with connections, unread badges, read state, live updates |
| Layout | Desktop three-column, tablet two-column, phone layout with a bottom tab bar; light and dark themes |

Photos are resized in the browser and stored in MongoDB (2 MB limit each), which suits a
single server. For a larger deployment, move them to object storage such as S3 or R2.

## API

All routes are under `/api` and use an HTTP-only session cookie.

| Method | Route | Purpose |
| --- | --- | --- |
| POST | /auth/signup, /auth/login, /auth/logout, /auth/logout-all | Sessions |
| GET | /auth/me | Current user |
| PUT | /auth/password | Change password (signs out other devices) |
| GET | /users?q= , /users/suggestions , /users/me/stats , /users/:id | Search, suggestions, stats, profile |
| PUT, DELETE | /users/me | Edit profile, delete account |
| GET, POST | /posts | Feed (`?before=`, `?author=`), create |
| GET, DELETE | /posts/:id | One post, delete own post |
| GET | /posts/saved | Your saved posts |
| POST | /posts/:id/save | Toggle saved |
| POST, DELETE | /posts/:id/repost | Repost (optional `text`), undo a plain repost |
| POST | /posts/:id/like , /posts/:id/comments | Toggle like, comment |
| DELETE | /posts/:id/comments/:commentId | Delete own comment, or any comment on your post |
| GET | /connections , /connections/invitations | Connections, pending invites |
| POST | /connections/request/:userId , /connections/:id/accept | Invite, accept |
| DELETE | /connections/:id | Ignore, withdraw or remove |
| GET | /messages , /messages/unread , /messages/:userId | Conversations, unread count, thread |
| POST | /messages/:userId | Send (connections only) |
| POST, GET | /images , /images/:id | Upload a photo (`dataUrl`), fetch it |
| GET | /notifications , /notifications/unread | List, unread count |
| POST | /notifications/read-all , /notifications/:id/read | Mark as read |
| DELETE | /notifications/:id | Delete one |
| GET, POST | /jobs | Search (`q`, `location`, `workplace`, `type`), post a job |
| GET | /jobs/mine , /jobs/:id | Saved, applied and posted; one job |
| PUT, DELETE | /jobs/:id | Edit or close (`closed`), delete (poster only) |
| POST | /jobs/:id/apply , /jobs/:id/save | Apply with an optional `note`, toggle saved |

See [docs/backend.md](docs/backend.md) for the security checklist and what is next.
