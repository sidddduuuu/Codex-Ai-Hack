# Agent Breach Trace Schema

Shared TypeScript types for Agent Breach Replay metadata.

The schema models replay-safe agent security events:

- source reads with trust and data class labels
- model steps and influence chains
- tool calls with boundaries, targets, destinations, and authority
- policy decisions
- deterministic security findings

This package is used by the TypeScript SDK, detector package, and Replay Studio.
