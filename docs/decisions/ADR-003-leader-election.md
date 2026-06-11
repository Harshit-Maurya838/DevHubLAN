# ADR 003: Leader Election Algorithm

## Context
Room owners may disconnect, requiring a fallback mechanism to maintain room state.

## Decision
We decided to implement a custom, offline-first solution tailored for LAN constraints.

## Consequences
- Increased initial development complexity
- Eliminated cloud dependency
- Maximum privacy for local development teams


---
*Last updated: 2026-06-11*