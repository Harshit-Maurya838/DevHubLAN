# ADR 004: Hybrid RSA/AES Security Model

## Context
We need secure identity and E2EE without external PKI or Certificate Authorities.

## Decision
We decided to implement a custom, offline-first solution tailored for LAN constraints.

## Consequences
- Increased initial development complexity
- Eliminated cloud dependency
- Maximum privacy for local development teams


---
*Last updated: 2026-06-11*