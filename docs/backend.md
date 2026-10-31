# Nexora backend

## Data model (MongoDB, Mongoose)

- **User**: name, email (unique), passwordHash (bcrypt, never returned), headline, location,
  about, skills, experience[], avatarColor, avatar, cover, savedPosts[], savedJobs[],
  profileViews, tokenVersion.
- **Post**: author, text, image, repostOf, likes[userId], comments[{author, text}], timestamps.
  Index on createdAt. Text is optional when there is an image or it is a repost.
- **Image**: owner, type, data (bytes). Type is checked against the file's first bytes; 2 MB max.
- **Notification**: user, actor, type (like, comment, repost, invite, accept, apply), post, job, readAt.
- **Job**: poster, title, company, location, workplace, type, salary, description, skills,
  applications[{user, note}], closed.
- **Connection**: requester, recipient, status pending|accepted. Unique on the pair.
- **Message**: from, to, text, readAt, timestamps.

Indexes are declared on the schemas and built by Mongoose on start. `npm run seed` loads
made-up sample data (no real people).

## Auth

- Passwords hashed with bcrypt (10 rounds), 8 to 128 characters.
- Session is a signed JWT in an HTTP-only, SameSite=Lax cookie (Secure in production), 7 days.
- Sign out everywhere and password changes bump `tokenVersion`, which invalidates every older token.
- Account deletion removes the user's posts, comments, likes, reposts, connections, messages,
  photos, jobs, job applications and notifications.

## Security checklist

- [x] Secrets only in env vars; `.env*` in `.gitignore`; nothing secret in the client bundle
- [x] JWT_SECRET required when NODE_ENV=production
- [x] Input validated on the server on every route (types, trimming, length limits); operator
      objects like `{ "$ne": null }` are rejected, not passed to queries
- [x] Authorisation on every read and write, tested with a second and third user
      (deleting others' posts/comments, accepting someone else's invite, reading others' messages,
      using someone else's photo, editing others' jobs, seeing applicants of others' jobs)
- [x] Messaging limited to accepted connections
- [x] Rate limit on sign up and sign in (30 per 15 minutes per IP)
- [x] Helmet security headers with a Content Security Policy; JSON body limit 100 KB
- [x] No user data in URLs beyond ids; no passwords or tokens logged
- [x] `npm audit`: 0 vulnerabilities
- [ ] Email verification and password reset by email (needs an email provider such as Resend or
      Postmark with your own domain and API key)
- [x] Image uploads (profile photos, cover photos, post images) with size and type limits
- [ ] Move images to a separate bucket (S3, R2) before running more than one server
- [x] Live messages and notifications over Server-Sent Events
- [ ] Privacy policy listing processors (host, database, email provider)
- [ ] Database backups enabled on the host (MongoDB Atlas does this on paid tiers)

## Testing notes

The test environment here could not download MongoDB, so tests ran against FerretDB (a
MongoDB-compatible server). Two queries were rewritten to avoid conditional `$pull`, which
FerretDB does not support; the rewritten versions behave the same on real MongoDB. On your
machine `npm test` uses mongodb-memory-server, which runs a real MongoDB.
