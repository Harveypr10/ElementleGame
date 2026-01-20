# Contributing to Elementle Mobile

Thank you for your interest in contributing! This document provides guidelines for contributing to the project.

## Code of Conduct

- Be respectful and inclusive
- Provide constructive feedback
- Focus on what is best for the community
- Show empathy towards other community members

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/ElementleGame.git`
3. Create a branch: `git checkout -b feature/your-feature-name`
4. Make your changes
5. Test thoroughly
6. Submit a pull request

## Development Process

### Before Starting

- Check existing issues and PRs to avoid duplicates
- Discuss major changes in an issue first
- Follow the project's coding style
- Write tests for new features

### Coding Standards

**TypeScript:**
- Use strict mode
- Provide type annotations for functions
- Avoid `any` types when possible
- Use interfaces over types for object shapes

**React/React Native:**
- Use functional components with hooks
- Follow React best practices
- Use NativeWind for styling
- Keep components focused and reusable

**Naming Conventions:**
- Components: PascalCase (e.g., `HomeCard.tsx`)
- Hooks: camelCase with "use" prefix (e.g., `useGameEngine.ts`)
- Utils: camelCase (e.g., `queryOptimization.ts`)
- Constants: UPPER_SNAKE_CASE (e.g., `MAX_GUESSES`)

### File Structure

```
components/
  ├── ComponentName.tsx       # Component file
  └── ComponentName.test.tsx  # Test file (if applicable)

lib/
  ├── utilityName.ts          # Utility functions
  └── utilityName.test.ts     # Tests

hooks/
  └── useHookName.ts          # Custom hooks

contexts/
  └── ContextName.tsx         # React contexts
```

### Commit Messages

Follow conventional commits format:

```
type(scope): subject

body (optional)

footer (optional)
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code styling (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding/updating tests
- `chore`: Maintenance tasks

**Examples:**
```
feat(game): add shake animation for invalid guess
fix(auth): prevent duplicate signup attempts
docs(readme): update installation instructions
```

### Pull Request Process

1. **Update Documentation:**
   - Update README.md if adding features
   - Add API docs for new functions
   - Update TASKS.md task status

2. **Testing:**
   - Add test IDs for new components
   - Test on both iOS and Android (if applicable)
   - Verify dark mode compatibility
   - Test with screen reader if UI changes

3. **Code Quality:**
   - Run `npm run lint` and fix all errors
   - Run `npm run typecheck` and fix type errors
   - Ensure no console.log in production code
   - Follow existing code patterns

4. **PR Description:**
   - Describe what changed and why
   - Reference related issues
   - Include screenshots/videos for UI changes
   - List breaking changes (if any)

5. **Review Process:**
   - Address review comments promptly
   - Keep PR focused on single concern
   - Update PR if main branch has changes

## Issue Guidelines

### Bug Reports

Include:
- Device/OS version
- App version
- Steps to reproduce
- Expected vs actual behavior
- Screenshots/logs if applicable

Example:
```
**Device:** iPhone 14, iOS 17.0
**App Version:** 1.0.0

**Steps:**
1. Open app as guest
2. Play a game
3. Try to access archive

**Expected:** Show conversion prompt
**Actual:** App crashes

**Error Log:**
[paste error here]
```

### Feature Requests

Include:
- Clear description of feature
- Use case/motivation
- Proposed implementation (optional)
- Alternative solutions considered

## Testing

### Manual Testing Checklist

Before submitting PR:
- [ ] Test on iOS simulator
- [ ] Test on Android emulator (if applicable)
- [ ] Test in dark mode
- [ ] Test as guest user
- [ ] Test as authenticated user
- [ ] Verify no console errors
- [ ] Check performance (no lag)

### E2E Testing

Add Maestro tests for new flows:

```yaml
# maestro/your-feature-flow.yaml
appId: com.elementle.app
---
- launchApp
- tapOn:
    id: your-test-id
- assertVisible: "Expected Text"
```

## Architecture Guidelines

### State Management

- Use React Query for server state
- Use Context API for global app state
- Use local state for component-specific state
- Avoid prop drilling (use context instead)

### Performance

- Lazy load heavy components
- Memoize expensive calculations
- Use React.memo for pure components
- Optimize images (<200KB each)
- Batch API requests when possible

### Error Handling

- Always handle API errors
- Show user-friendly error messages
- Log errors for debugging
- Implement error boundaries for crashes

### Accessibility

- Add accessibility labels
- Provide accessibility hints
- Test with screen readers
- Ensure sufficient color contrast
- Support text scaling

## Questions?

- Open an issue for questions
- Join our Discord (if available)
- Email: dev@elementle.com

## License

By contributing, you agree that your contributions will be licensed under the same license as the project.
