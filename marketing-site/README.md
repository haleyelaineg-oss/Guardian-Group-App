# Guardian Group Marketing Site

This folder is the deployment root for the public Guardian Group website.
It is intentionally separate from the existing Vercel project that serves
`app.guardiangroupsls.com`.

## Vercel project setup

1. Import the `Guardian-Group-App` GitHub repository as a new Vercel project.
2. Set **Root Directory** to `marketing-site`.
3. Keep the framework preset as **Other** and leave build/output settings at
   their defaults.
4. Add the environment variables from `.env.example` for Preview and
   Production.
5. Deploy and test the generated preview URL before assigning live domains.

The Member Login links intentionally point to
`https://app.guardiangroupsls.com/portal/`.

## Domains

After the preview is approved, add these domains in Vercel Project Settings:

- `guardiangroupsafety.com`
- `www.guardiangroupsafety.com`
- `guardiangroupsls.com`
- `www.guardiangroupsls.com`

Keep `guardiangroupsafety.com` as the primary destination and redirect the
other hostnames to it. Do not modify the DNS record for
`app.guardiangroupsls.com`.
