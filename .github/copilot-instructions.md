# CafeMarcheDB - GitHub Copilot Instructions

CafeMarcheDB is a web application for managing a music community, built with Blitz.js (React/Next.js + Prisma ORM), TypeScript, and Material-UI. It handles events, users, songs, setlists, and calendar integration for a musical group.

Always reference these instructions first and fallback to search or bash commands only when you encounter unexpected information that does not match the info here.

## Working Effectively

### Initial Setup and Dependencies
- Install dependencies: `yarn install` -- takes 102 seconds. NEVER CANCEL. Set timeout to 180+ seconds.
- Husky git hooks are automatically installed during `yarn install`

### Database Setup
The application uses MySQL in production and supports SQLite for development:

**Production/Standard Setup (MySQL):**
- Ensure MySQL server is running: `sudo service mysql start`
- Create databases: `CREATE DATABASE cmdb; CREATE DATABASE cmdb_test;`
- Configure `.env.local`:
  ```
  DATABASE_URL="mysql://username:password@localhost:3306/cmdb"
  SESSION_SECRET_KEY="your-secret-key-32-chars-minimum"
  ```
- Configure `.env.test.local`:
  ```
  DATABASE_URL="mysql://username:password@localhost:3306/cmdb_test"
  ```

**Development Fallback (SQLite):**
If MySQL is unavailable, temporarily switch to SQLite:
- Change `db/schema.prisma` provider from `"mysql"` to `"sqlite"`
- Configure `.env.local`: `DATABASE_URL="file:./dev.db"`
- Note: Switch back to MySQL before committing changes

**Database Operations:**
- Generate Prisma client: `yarn blitz prisma generate` -- requires network access to binaries.prisma.sh
- **NETWORK LIMITATION**: If network access to binaries.prisma.sh is blocked, Prisma operations will fail
- Apply migrations: `yarn blitz prisma migrate dev` -- NEVER use in production
- Deploy migrations: `yarn blitz prisma migrate deploy` -- safe for production
- Reset database (dev only): `yarn blitz prisma migrate reset` -- DESTRUCTIVE
- Database seeding: `yarn blitz prisma db seed`

### Build and Development
- Lint code: `yarn lint` -- takes 183 seconds. NEVER CANCEL. Set timeout to 300+ seconds.
- Development server: `yarn dev` -- runs on http://localhost:10455 (custom port)
- Production build: `yarn build` -- typically takes 2-5 minutes. NEVER CANCEL. Set timeout to 600+ seconds.
- Start production server: `yarn start --port 10455`
- Prisma Studio (database GUI): `yarn studio`
- List all routes: `yarn blitz routes` -- helpful for navigation understanding

### Testing
- **TEST SETUP ISSUE**: `yarn test` currently fails due to missing Vite dependency for Vitest
- The project has `vitest` in devDependencies but no test files or proper Vitest configuration
- Test pages exist at `/src/pages/test/` and `/src/pages/backstage/test/` (these are UI test pages, not unit tests)
- If tests are needed, create `vitest.config.ts` and ensure Vite is installed as a devDependency
- Watch mode: `yarn test:watch` (same issue as above)

## Validation

### CRITICAL: Network Dependency Issues
**ALWAYS check network connectivity to binaries.prisma.sh before attempting database operations.**
If blocked, you CANNOT:
- Generate Prisma client (`yarn blitz prisma generate`)
- Run migrations (`yarn blitz prisma migrate dev`)
- Build the application (`yarn build`)
- Start the development server (`yarn dev`)

In this case, document the limitation and focus on:
- Code analysis and navigation
- Linting and code quality checks
- Static file examination
- Documentation updates

### Manual Validation Steps
When network access is available, ALWAYS test these scenarios:
1. **Database Setup**: Verify migrations run cleanly and seeding works
2. **Development Server**: Start server and verify it loads without errors
3. **Login Flow**: Test both local authentication and Google OAuth (if configured)
4. **Navigation**: Access backstage admin area (requires admin permissions)
5. **Core Features**: Test event creation, user management, and calendar views
6. **Build Process**: Verify production build completes successfully

### Pre-commit Validation
Always run these commands before committing:
- `yarn lint` -- NEVER CANCEL, wait for completion (3+ minutes)
- Verify no TypeScript errors in your changes
- **NOTE**: `yarn test` currently has configuration issues, focus on linting and manual testing

## Common Tasks

### Repository Structure
```
cmdb/
├── src/                     # Main application code
│   ├── auth/               # Authentication (login, signup, Google OAuth)
│   ├── core/               # Core components and layouts
│   ├── pages/              # Next.js pages (API routes and UI)
│   └── ...
├── db/                     # Database configuration
│   ├── schema.prisma       # Database schema (MySQL/SQLite compatible)
│   ├── migrations/         # Migration files (29 existing migrations)
│   ├── seeding/           # Database seeding scripts
│   └── seeds.ts           # Main seeding entry point
├── shared/                 # Shared utilities and types
├── public/                 # Static assets
├── README.tenfour.md       # Detailed developer documentation
├── package.json            # Dependencies and scripts
└── .env*                   # Environment configuration
```

### Key Configuration Files
- `package.json` -- scripts: dev, build, start, lint, test; uses Yarn workspaces setup
- `next.config.js` -- Blitz.js and Next.js configuration with i18n support (EN/NL/FR)
- `.eslintrc.js` -- ESLint rules (includes unused imports detection, circular import detection)
- `tsconfig.json` -- TypeScript strict configuration
- `db/schema.prisma` -- Database schema with 29+ tables including User, Event, Song, Role, Permission
- `.env` -- Base environment config (PORT=10455, database examples)
- `.gitignore` -- Includes Blitz-specific ignores (*.sqlite, .blitz/, cmdb_*.tar.gz)

### Environment Variables
Required in `.env.local`:
- `DATABASE_URL` -- Database connection string
- `SESSION_SECRET_KEY` -- Authentication secret (32+ characters)

Optional (for full functionality):
- `GOOGLE_CLIENT_ID` -- Google OAuth
- `GOOGLE_CLIENT_SECRET` -- Google OAuth
- `ADMIN_EMAIL` -- Auto-admin user
- `FILE_UPLOAD_PATH` -- File upload directory

### Special URLs and Features
- Admin controls: Alt+9 hotkey shows/hides admin controls on any page
- Test page: `/backstage/test/test` -- internal testing utilities (UI-based tests)
- Public test page: `/test/test` -- public testing interface  
- Auth endpoints: `/auth/logout`, `/auth/stopImpersonating`
- Prisma Studio: `yarn studio` -- database GUI on different port
- Custom port: Always use 10455 for consistency with project configuration
- API routes: Located in `src/pages/api/` following Next.js conventions

### Common Patterns
- Material-UI components throughout
- TypeScript strict mode enabled
- Prisma for all database operations
- Blitz.js RPC for API calls
- Role-based permissions system
- Activity logging and audit trails

### Known Issues and Workarounds
- TypeScript 5.8.2 generates warnings with ESLint (expected, not critical)
- Some peer dependency warnings during `yarn install` (non-blocking)  
- Network access required for Prisma binary downloads
- Build process requires generated Prisma client to succeed
- Test setup incomplete: Vitest configured but missing Vite dependency and test files
- Husky git hooks automatically installed during `yarn install`

### File Upload and Static Assets
- Upload directory: `uploads/` (relative to project root)
- Static assets: `public/` directory
- File uploads handled via custom middleware

### Internationalization
- Supports EN, NL, FR locales
- Default locale: EN
- i18n configured in `next.config.js`

## Deployment

Production deployment process:
- **Build first**: `yarn build` -- NEVER CANCEL, takes 5+ minutes when working
- **Start production**: `yarn start --port 10455`
- **Deploy script**: `./deploy.sh username@server:/path` creates `cmdb_deploy.tar.gz`
- **Deploy contents**: Uses `files_to_deploy.txt` (currently only `.next/` directory)
- **Database migrations**: `yarn blitz prisma migrate deploy` -- SAFE for production, never clobbers data
- **Database seeding**: `yarn blitz prisma db seed` -- only if database is empty

**CRITICAL**: Never use `yarn blitz prisma migrate dev` in production - it can clobber data.

Fixes #596.