/**
 * TRI-51: Linear API client
 * Uses the Linear GraphQL API directly via API key from environment.
 * Key read order: HARNESS_LINEAR_API_KEY → LINEAR_API_KEY
 */

export interface LinearTicket {
  id: string;
  identifier: string;
  title: string;
  description: string | null;
  url: string;
  state: { name: string; type: string };
  team: { id: string; key: string };
}

export interface LinearState {
  id: string;
  name: string;
  type: string;
}

export class LinearClientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LinearClientError";
  }
}

function getApiKey(): string | null {
  return process.env.HARNESS_LINEAR_API_KEY ?? process.env.LINEAR_API_KEY ?? null;
}

async function graphql<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new LinearClientError(
      "Linear API key not found. Set HARNESS_LINEAR_API_KEY or LINEAR_API_KEY environment variable.",
    );
  }

  const response = await fetch("https://api.linear.app/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: apiKey,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new LinearClientError(`Linear API error: ${response.status} ${response.statusText}`);
  }

  const json = (await response.json()) as { data?: T; errors?: Array<{ message: string }> };

  if (json.errors?.length) {
    throw new LinearClientError(`Linear API errors: ${json.errors.map((e) => e.message).join(", ")}`);
  }

  if (!json.data) {
    throw new LinearClientError("Linear API returned no data");
  }

  return json.data;
}

/** Fetch a ticket by identifier (e.g. TRI-42) */
export async function fetchTicket(identifier: string): Promise<LinearTicket> {
  const data = await graphql<{ issue: LinearTicket }>(
    `query GetIssue($id: String!) {
      issue(id: $id) {
        id
        identifier
        title
        description
        url
        state { name type }
        team { id key }
      }
    }`,
    { id: identifier },
  );
  return data.issue;
}

/** List available states for a team */
export async function fetchTeamStates(teamId: string): Promise<LinearState[]> {
  const data = await graphql<{ team: { states: { nodes: LinearState[] } } }>(
    `query GetTeamStates($teamId: String!) {
      team(id: $teamId) {
        states { nodes { id name type } }
      }
    }`,
    { teamId },
  );
  return data.team.states.nodes;
}

/** Update ticket status by state name (e.g. "In Progress", "In Review", "Done") */
export async function updateTicketStatus(
  issueId: string,
  teamId: string,
  stateName: string,
): Promise<void> {
  const states = await fetchTeamStates(teamId);
  const target = states.find(
    (s) => s.name.toLowerCase() === stateName.toLowerCase(),
  );
  if (!target) {
    throw new LinearClientError(
      `State "${stateName}" not found in team. Available: ${states.map((s) => s.name).join(", ")}`,
    );
  }

  await graphql(
    `mutation UpdateIssue($id: String!, $stateId: String!) {
      issueUpdate(id: $id, input: { stateId: $stateId }) {
        success
      }
    }`,
    { id: issueId, stateId: target.id },
  );
}

/** Create a sub-issue under a parent */
export async function createSubIssue(opts: {
  parentId: string;
  teamId: string;
  title: string;
  description: string;
}): Promise<LinearTicket> {
  const data = await graphql<{ issueCreate: { issue: LinearTicket } }>(
    `mutation CreateIssue($input: IssueCreateInput!) {
      issueCreate(input: $input) {
        issue { id identifier title url state { name type } team { id key } }
      }
    }`,
    {
      input: {
        parentId: opts.parentId,
        teamId: opts.teamId,
        title: opts.title,
        description: opts.description,
      },
    },
  );
  return data.issueCreate.issue;
}

/** Extract ticket ID from a branch name (e.g. "tri-42-add-auth" → "TRI-42") */
export function extractTicketIdFromBranch(branchName: string): string | null {
  const match = branchName.match(/^([a-z]+)-(\d+)-/i);
  if (!match) return null;
  return `${match[1].toUpperCase()}-${match[2]}`;
}

/** Format ticket context for injection into agent session prompt */
export function formatTicketContext(ticket: LinearTicket): string {
  return `## Active Ticket: ${ticket.identifier}

**Title:** ${ticket.title}
**URL:** ${ticket.url}
**Status:** ${ticket.state.name}

### Description
${ticket.description ?? "_No description provided_"}

---
Use the acceptance criteria above as your definition of done.
Update ticket status as you progress: In Progress → In Review → Done.
`;
}

export function isLinearAvailable(): boolean {
  return Boolean(getApiKey());
}
