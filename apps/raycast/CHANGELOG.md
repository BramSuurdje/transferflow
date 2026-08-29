# Toss Changelog

## [Split API origin] - {PR_MERGE_DATE}

- Derive the API URL as `https://api.<web-host>` (e.g. `https://api.toss.bramsuurd.nl`) instead of `/api` on the web origin
- Local `http://localhost:5173` still maps to `http://localhost:3001`

## [Production URLs and simpler setup] - {PR_MERGE_DATE}

- Default web app URL is `https://toss.bramsuurd.nl`
- Remove separate API URL preference; API base is derived from the web URL

## [Rename to Toss] - 2026-05-28

- Rename extension from TransferFlow to Toss

## [Initial Release] - {PR_MERGE_DATE}

- Upload a Finder file and copy the share link
