# Shipu portfolio with admin dashboard

The public site lives in `public/`. The API (`netlify/functions/api.mjs`) stores projects and uploaded logos in Netlify Blobs. Admin page: `/admin/`.

## Deploy
Plain drag-and-drop does not reliably install the function's dependency, so use one of these:

**Git (recommended)**
1. Put this whole folder in a GitHub repository.
2. In Netlify: Add new site > Import an existing project, pick the repo. Leave the build command empty. Settings are read from `netlify.toml`.

**Netlify CLI**
1. `npm install -g netlify-cli`, then `netlify login`.
2. In this folder run `npm install`, then `netlify deploy --prod`.

## Set your admin login (required)
In Netlify: Site configuration > Environment variables. Add:
- `ADMIN_PASSWORD`: a long, unique password
- `SESSION_SECRET`: 16+ random characters, for example the output of `openssl rand -hex 32`
- `ADMIN_USERNAME`: optional, defaults to `admin`

Redeploy after saving the variables. Then open `https://your-site/admin/` and sign in.

## Using the dashboard
- Add a project: name, location, role, optional description and website, and a logo. It appears on the homepage right away.
- Edit, reorder (Move up / Move down) or delete any project, including the seven built-in ones.
- Logos are resized to 1000 px in the browser; the upload limit is 2 MB.

## Good to know
- If the API is unreachable, the homepage still shows the original seven projects from its static HTML.
- One admin account. Sign-in has a short delay after wrong attempts but no lockout, so use a strong password.
- Contact forms still use Netlify Forms (see Forms in the dashboard after the first deploy).
- Test locally with `netlify dev` (needs `npm install` first).
