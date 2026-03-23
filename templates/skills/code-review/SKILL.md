---
name: code-review
description: Perform comprehensive code reviews including style, security, performance, and best practices. Use when asked to review code, check for bugs, or evaluate pull requests.
---

# Code Review Skill

## Review Checklist

### Style & Conventions
- Follow TypeScript best practices
- Use meaningful variable and function names
- Add comments for complex logic
- Keep functions focused and concise

### Security
- Check for SQL injection, XSS, CSRF vulnerabilities
- Validate user input
- Use parameterized queries
- Sanitize output

### Performance
- Identify unnecessary loops or expensive operations
- Suggest caching where appropriate
- Check for memory leaks (unclosed connections, event listeners)
- Review database query efficiency

### Best Practices
- Error handling and edge cases
- Type safety (avoid `any`)
- DRY principle (don't repeat yourself)
- SOLID principles

## Usage

When reviewing code, provide:

1. **Summary**: Brief overview of the code
2. **Issues**: List problems found (critical, major, minor)
3. **Suggestions**: Improvement recommendations
4. **Positive notes**: What was done well

## Output Format

```markdown
## Code Review: [file/name]

### Summary
[Brief description]

### Critical Issues
- [Issue 1]

### Major Issues
- [Issue 2]

### Minor Issues
- [Issue 3]

### Suggestions
- [Suggestion 1]

### Positive Notes
- [Good thing 1]
```
