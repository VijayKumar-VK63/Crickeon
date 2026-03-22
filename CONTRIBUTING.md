# Contributing to Crickeon

Thank you for your interest in contributing to Crickeon! This document provides guidelines and instructions for contributing code, documentation, bug reports, and feature ideas.

## 📋 Code of Conduct

This project and everyone participating in it is governed by our [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

## 🚀 Getting Started

### Prerequisites

- **Node.js** 20+ and **npm** 10+
- **Docker** and **Docker Compose** (for local infrastructure)
- **Git**

### Development Setup (5 minutes)

```bash
# 1. Clone the repository
git clone https://github.com/VijayKumar-VK63/Crickeon.git
cd Crickeon

# 2. Install dependencies
npm install

# 3. Start local infrastructure (Postgres, Redis)
npm run docker:up

# 4. Set up database
npm run prisma:migrate
npm run prisma:seed

# 5. Build all services
npm run build

# 6. In one terminal: Start backend
npm run start:mvp

# 7. In another terminal: Start frontend
npm run dev:frontend
```

Visit `http://localhost:5173` to see the app.

---

## 🔄 Development Workflow

### 1. Create a Branch

Use conventional branch naming:

```bash
git checkout -b feature/auction-improvements
git checkout -b fix/bid-race-condition
git checkout -b docs/architecture-guide
```

**Branch prefixes:**
- `feature/` — New feature
- `fix/` — Bug fix
- `docs/` — Documentation changes
- `refactor/` — Code restructuring
- `chore/` — Build/tooling updates

### 2. Make Changes

**File organization:**
- Backend logic goes in `crickeon-backend/apps/*/src/`
- Frontend components go in `crickeon-frontend/src/`
- Shared types go in `crickeon-backend/packages/shared-contracts/src/`

**Code quality:**
```bash
# Format code
npm run format

# Lint code
npm run lint

# Type check
npm run typecheck

# Run tests
npm test

# Run tests in watch mode
npm run test:watch
```

### 3. Write Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```bash
git commit -m "feat(auction-service): add anti-sniping lock mechanism"
git commit -m "fix(match-engine): resolve RNG seed collision edge case"
git commit -m "docs(README): update deployment instructions"
git commit -m "test(auction): add concurrent bid simulation"
git commit -m "refactor(api-gateway): simplify middleware stack"
git commit -m "chore: upgrade NestJS to v11.1.0"
```

**Format:** `type(scope): message`

**Types:**
- `feat` — New feature
- `fix` — Bug fix
- `docs` — Documentation
- `style` — Code style (whitespace, formatting)
- `refactor` — Code restructuring
- `perf` — Performance improvement
- `test` — Adding or updating tests
- `chore` — Build/tooling, dependencies

### 4. Test Your Changes

Before pushing, verify:

```bash
# Run full test suite
npm test

# Check for type errors
npm run typecheck

# Verify code style
npm run lint

# Run integration tests
npm run test:integration

# Performance test (if applicable)
k6 run crickeon-infra/load/k6-auction-stress.js
```

### 5. Submit a Pull Request

**PR Title Format:** Use the same format as commit messages
- `feat: add anti-sniping mechanism`
- `fix: resolve bid race condition`

**PR Description Template:**

```markdown
## 📝 Description
Brief overview of what changed and why.

## 🎯 Related Issue
Closes #123 (if applicable)

## ✅ Testing
- [ ] Unit tests added/updated
- [ ] Integration tests pass
- [ ] Manual testing completed
- [ ] No breaking changes

## 📋 Checklist
- [ ] Code follows style guidelines
- [ ] Documentation updated
- [ ] No new warnings generated
- [ ] Backwards compatible
```

**What we look for:**
- Clean code with clear intent
- Tests for new features and bug fixes
- Updated documentation if needed
- No console errors or warnings
- Atomic, focused commits

**Code Review:**
- Changes reviewed by maintainers within 48 hours
- Constructive feedback provided
- Discussion encouraged
- Approval required before merge

---

## 🗂️ Project Structure

```
crickeon-backend/
├── apps/
│   ├── api-gateway/              # Entry point, routing, middleware
│   ├── auth-service/             # JWT, user management
│   ├── auction-service/          # Bidding logic, distributed locks
│   ├── match-engine-service/     # Ball-by-ball simulation
│   ├── notification-service/     # WebSocket realtime
│   ├── stats-service/            # Scoring, analytics
│   └── tournament-service/       # Standings, scheduling
├── packages/
│   └── shared-contracts/         # DTOs, domain events
├── prisma/                       # Database schema
└── scripts/                      # Utilities, migrations

crickeon-frontend/
├── src/
│   ├── components/   # Reusable UI components
│   ├── pages/        # Page-level components
│   ├── store/        # Zustand store
│   ├── services/     # API client, WebSocket
│   └── styles/       # Global styles
└── index.html

crickeon-infra/
├── docker-compose.yml   # Local dev stack
├── render.yaml          # Render deployment
├── vercel.json          # Vercel frontend config
├── docker/              # Dockerfile templates
├── k8s/                 # Kubernetes manifests
└── load/                # k6 stress tests
```

---

## 🧪 Testing Standards

### Unit Tests
```bash
npm test -- --watch  # Watch mode during development
npm test -- --coverage  # Coverage report
```

Located alongside source files as `*.spec.ts`.

### Integration Tests
```bash
npm run test:integration
```

Located in `crickeon-backend/test/` directory.

### Types of Tests

**1. Unit Tests** (fastest)
```typescript
// Test individual functions/methods
describe('BidService', () => {
  it('should calculate exact bid amount', () => {
    const bid = bidService.calculateBid(100, 0.1);
    expect(bid).toBe(110);
  });
});
```

**2. Integration Tests** (medium speed)
```typescript
// Test service + database + cache together
describe('Auction Service with Redis', () => {
  it('should prevent double-spend bids via lock', async () => {
    const result1 = await auctionService.placeBid(...);
    const result2 = await auctionService.placeBid(...);
    expect(result1.success || result2.success).toBe(true);
    expect(result1.success && result2.success).toBe(false);
  });
});
```

**3. Concurrency Simulations** (slowest)
```typescript
// Test real concurrent scenarios
it('should handle 50 simultaneous bids safely', async () => {
  const results = await Promise.all(
    Array(50).fill(0).map((_, i) => 
      auctionService.placeBid({...})
    )
  );
  const winners = results.filter(r => r.success);
  expect(winners.length).toBe(1);
});
```

---

## 📚 Documentation

When adding features or changing behavior, update:

1. **README.md** — High-level changes
2. **docs/system-architecture.md** — Architecture decisions
3. **Inline comments** — Complex logic explanations
4. **TypeScript types** — Self-documenting code

Example:
```typescript
/**
 * Places a bid on a player, preventing double-spend via distributed lock.
 * 
 * @param auctionId - Auction to bid on
 * @param playerId - Player being bid on
 * @param amount - Bid amount in currency units
 * @returns Success status and new top bid (if any)
 * @throws ConflictException if auction is already settled
 * @throws ValidationException if amount is below minimum
 */
async placeBid(
  auctionId: string,
  playerId: string,
  amount: number,
): Promise<PlaceBidResponse> {
  // Implementation...
}
```

---

## 🔍 Code Style Guide

### TypeScript/NestJS

```typescript
// ✅ Good
export class BidService {
  constructor(private readonly auctionRepo: AuctionRepository) {}

  async placeBid(dto: PlaceBidDto): Promise<PlaceBidResponse> {
    const auction = await this.auctionRepo.findById(dto.auctionId);
    if (!auction) throw new NotFoundException();
    // ...
  }
}

// ❌ Bad
export class BidService {
  constructor(auctionRepo) {}
  
  placeBid(dto) {
    let auction = this.auctionRepo.findById(dto.auctionId);
    if (auction == null) return null;
    // ...
  }
}
```

**Rules:**
- Use `interface` over `type` for object contracts
- Use `readonly` for immutable properties
- Add JSDoc comments to public methods
- Keep functions <30 lines
- Use dependency injection
- One responsibility per class

### React/Frontend

```typescript
// ✅ Good
export const AuctionItem: React.FC<Props> = ({ player, onBid }) => {
  const [amount, setAmount] = useState(0);
  
  const handleBid = useCallback(() => {
    onBid(amount);
  }, [amount, onBid]);

  return (
    <div>
      {/* JSX */}
    </div>
  );
};

// ❌ Bad
export function auctionItem(props) {
  let amount = 0;
  
  return (
    <div onClick={() => props.onBid(amount)}>
      {/* JSX */}
    </div>
  );
}
```

**Rules:**
- Use functional components with hooks
- Keep components focused and reusable
- Use `React.FC<Props>` type signature
- Extract logic to custom hooks
- Avoid prop drilling (use context/store)

---

## 🚦 Performance Checklist

Before submitting a PR that touches:

**Backend services:**
- [ ] No new N+1 queries (`audit with Prisma.findMany` first)
- [ ] Database indexes exist for filters/joins
- [ ] Redis cache used for frequently accessed data
- [ ] No blocking operations in request handlers
- [ ] Performance acceptable in load test (k6 script)

**Frontend:**
- [ ] No unnecessary re-renders (use `React.memo`, `useMemo`)
- [ ] Large lists use virtualization (if >100 items)
- [ ] Lazy load code-split bundles
- [ ] Images optimized and lazy-loaded
- [ ] Bundle size increase checked

**Example:**
```bash
# Load test before/after
k6 run crickeon-infra/load/k6-auction-stress.js

# Check bundle sizes
npm run build
# Note the output size before and after
```

---

## 🐛 Reporting Bugs

Use [GitHub Issues](https://github.com/VijayKumar-VK63/Crickeon/issues) with this template:

```markdown
## 🐛 Bug Description
Clear, concise summary of the issue.

## 📍 Steps to Reproduce
1. Do X
2. Then Y
3. Observe Z

## ✅ Expected Behavior
What should happen.

## ❌ Actual Behavior
What actually happens.

## 🖥️ Environment
- OS: [e.g., macOS 14.1]
- Node version: [e.g., 20.10.0]
- Branch/Commit: [e.g., main @ abc1234]

## 📎 Additional Context
Screenshots, logs, or related issues.
```

---

## 💡 Suggesting Features

Use [Discussions](https://github.com/VijayKumar-VK63/Crickeon/discussions) to propose ideas:

```markdown
## Feature Idea: [Title]

### Problem
What problem does this solve?

### Proposed Solution
High-level approach.

### Benefits
Why should we build this?

### Example
How would users interact with it?
```

---

## 📞 Getting Help

- **Questions?** Post in [Discussions](https://github.com/VijayKumar-VK63/Crickeon/discussions)
- **Stuck?** Check [docs/](docs/) folder
- **Architecture questions?** Read [docs/system-architecture.md](docs/system-architecture.md)
- **Need to chat?** DM maintainers on Twitter [@CrickeonApp](https://twitter.com/placeholder)

---

## 🎯 What We're Looking For

Contributors of any skill level welcome! Priority areas:

### 🔴 High Priority
- Bug fixes for open issues
- Performance improvements
- Security fixes

### 🟡 Medium Priority
- Feature implementations from roadmap
- Documentation improvements
- Test coverage increases

### 🟢 Good First Issues
Look for issues labeled [good-first-issue](https://github.com/VijayKumar-VK63/Crickeon/labels/good-first-issue) — perfect for first-time contributors.

---

## ©️ License

By contributing, you agree your code will be licensed under the MIT License (see [LICENSE](LICENSE)).

---

Thank you for contributing to Crickeon! 🙏

[⬆ back to top](#contributing-to-crickeon)
