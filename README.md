# Aeroscraper Monorepo

Monorepo containing:

- `aeroscraper-frontend`: Next.js 13 app (App Router) for Aeroscraper UI
- `aeroscraper-contracts`: Solana programs (Anchor framework) and TypeScript scripts/tests

Node version: managed via `.nvmrc`

```
22
```

## Repository layout

```
/
├─ aeroscraper-frontend/      # Next.js 13 app (UI)
├─ aeroscraper-contracts/     # Anchor programs, tests, and scripts
├─ README.md                  # This file
└─ .nvmrc                     # Node.js version (22)
```

Both subprojects are tracked via git subtrees:

- frontend remote: `git@github.com:aeroscraper/aeroscraper-frontend.git`
- contracts remote: `git@github.com:aeroscraper/aeroscraper-contracts.git`

## Frontend (Next.js)

Path: `aeroscraper-frontend`

Key scripts (from `package.json`):

```
npm run dev       # next dev
npm run build     # next build
npm start         # next start (after build)
npm run lint      # next lint
npm run analyze   # build with bundle analyzer
```

Notes:

- Next.js 13.4.x with SWC, TailwindCSS, and wallet integrations (Solana/Cosmos).
- Bundle analyzer available via `ANALYZE=true npm run analyze`.
- Vercel deployment supported.

### Vercel deployment

If deploying this monorepo to Vercel, set the project Root Directory to `aeroscraper-frontend`.

- Framework: Next.js
- Install command: `npm ci`
- Build command: `npm run build`
- Output directory: `.next`
- Production branch: typically `master` (or as configured)

Preview URL example: `https://aeroscraper-frontend-dev.vercel.app`

## Contracts (Solana, Anchor)

Path: `aeroscraper-contracts`

Tooling versions and programs are configured in `Anchor.toml`.

Provider defaults (excerpt):

```
[toolchain]
anchor_version = "0.31.1"

[provider]
cluster = "https://devnet.helius-rpc.com/?api-key=..."
wallet = "~/.config/solana/id.json"

[programs.devnet]
aerospacer_protocol = "9sk8X11GWtZjzXWfkcLMRD6tmuhmiBKgMXsmx9bEh5YQ"
aerospacer_oracle   = "8zG12srZdYaJPjWzCAJhwyxF7wWTz5spbmehxWpV5Q9M"
aerospacer_fees     = "AHmGKukQky3mDHLmFyJYcEaFub69vp2QqeSW7EbVpJjZ"
```

Common scripts (from `package.json` and `Anchor.toml`):

```
# Typescript test runner
npm run test-oracle-devnet    # tests/**/oracle-*.ts (devnet)
npm run test-fee-devnet       # tests/**/fee-*.ts (devnet)

# Initialization & helpers (require a funded wallet at ~/.config/solana/id.json)
npm run init-oracle-devnet
npm run init-protocol-devnet
npm run add-assets-devnet
npm run add-sol-price
npm run update-protocol-addresses

# Anchor deploys (from Anchor.toml [scripts])
anchor deploy --provider.cluster devnet
```

Requirements:

- Solana CLI installed and configured (`solana-keygen`, `solana config get`).
- A funded devnet keypair at `~/.config/solana/id.json` for scripts that write on-chain.
- Node.js `v22` per `.nvmrc`.

## Git subtree workflow

This monorepo pulls code from two upstream repositories using git subtrees. Ensure the remotes exist:

```
git remote -v
# frontend  git@github.com:aeroscraper/aeroscraper-frontend.git
# solana    git@github.com:aeroscraper/aeroscraper-contracts.git
```

One-time add (if not yet added at these prefixes):

```
git subtree add --prefix=aeroscraper-frontend   frontend develop --squash
git subtree add --prefix=aeroscraper-contracts  solana   master  --squash
```

Pull updates from upstreams:

```
git fetch frontend
git subtree pull --prefix=aeroscraper-frontend  frontend develop --squash

git fetch solana
git subtree pull --prefix=aeroscraper-contracts solana   master  --squash
```

Push subtree changes back to upstreams:

```
# Direct push (if fast-forward possible)
git subtree push --prefix=aeroscraper-frontend  frontend develop
git subtree push --prefix=aeroscraper-contracts solana   master

# If there is divergence, split then push
git subtree split --prefix=aeroscraper-frontend  -b frontend-split
git push frontend frontend-split:develop
git branch -D frontend-split

git subtree split --prefix=aeroscraper-contracts -b contracts-split
git push solana contracts-split:master
git branch -D contracts-split
```

Notes:

- Pushing to the monorepo (`origin`) does not update upstream subtrees. Use the push/split flow above to sync upstreams.
- `--squash` keeps a clean monorepo history while mirroring content; pushing will generate synthetic commits on the upstream.

## Local development quickstart

```
# Use Node 22
nvm use

# Frontend
cd aeroscraper-frontend
npm ci
npm run dev

# Contracts (requires solana + anchor setup)
cd ../aeroscraper-contracts
npm ci
npm run init-protocol-devnet        # optional init helper
npm run test-oracle-devnet          # run oracle tests against devnet
```

## Environment variables

- Frontend: create `aeroscraper-frontend/.env` as needed for API keys and environment configuration.
- Contracts: scripts rely on `ANCHOR_PROVIDER_URL` and `ANCHOR_WALLET` (already baked into many npm scripts).

## Deployment

- Frontend is deployed on Vercel with Root Directory `aeroscraper-frontend`.
- Contracts are deployed via Anchor; see `Anchor.toml` and the scripts in `aeroscraper-contracts/scripts`.
