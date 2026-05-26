export const AGENTS_MD_INJECTION = `This repository keeps auto-maintained domain knowledge nodes under docs/knowledge/.
Before starting a task, look up the relevant nodes:

  codespoon spoon "<one-line task summary>"

The command returns matching node bodies and their source paths. Nodes are kept
in sync with the code by codespoon's auto-maintenance loop — you can trust them
as a starting point for understanding the affected domain.`;
