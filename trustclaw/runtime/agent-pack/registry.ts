import { loadAgentPacksFromDir, resolveDefaultAgentsDir } from "./load.js";
import { DEFAULT_AGENT_PACK_ID, type AgentPackDocument, type ResolvedAgentPack } from "./schema.js";

export type AgentPackRegistryOptions = {
  agentsDir?: string;
  defaultPackId?: string;
};

export class AgentPackRegistry {
  private readonly packsById = new Map<string, ResolvedAgentPack>();
  private readonly packsByOpenClawAgentId = new Map<string, ResolvedAgentPack>();
  private readonly defaultPackId: string;

  constructor(packs: ResolvedAgentPack[], options?: { defaultPackId?: string }) {
    this.defaultPackId = options?.defaultPackId?.trim() || DEFAULT_AGENT_PACK_ID;
    for (const pack of packs) {
      this.packsById.set(pack.id, pack);
      const openclawAgentId = pack.openclaw?.agentId?.trim();
      if (openclawAgentId) {
        this.packsByOpenClawAgentId.set(openclawAgentId, pack);
      }
    }
    if (!this.packsById.has(this.defaultPackId)) {
      throw new Error(
        `Default agent pack "${this.defaultPackId}" is missing. Registered: ${[...this.packsById.keys()].join(", ") || "(none)"}`,
      );
    }
  }

  static load(options?: AgentPackRegistryOptions): AgentPackRegistry {
    const agentsDir = options?.agentsDir?.trim() || resolveDefaultAgentsDir();
    const packs = loadAgentPacksFromDir(agentsDir);
    if (packs.length === 0) {
      throw new Error(`No agent packs found under ${agentsDir}`);
    }
    return new AgentPackRegistry(packs, { defaultPackId: options?.defaultPackId });
  }

  list(): ResolvedAgentPack[] {
    return [...this.packsById.values()].sort((a, b) => a.id.localeCompare(b.id));
  }

  get(packId: string): ResolvedAgentPack | undefined {
    return this.packsById.get(packId);
  }

  getDefault(): ResolvedAgentPack {
    return this.packsById.get(this.defaultPackId)!;
  }

  resolve(params?: { packId?: string; openclawAgentId?: string }): ResolvedAgentPack {
    const explicitId = params?.packId?.trim();
    if (explicitId) {
      const pack = this.packsById.get(explicitId);
      if (!pack) {
        throw new Error(`Unknown agent pack id: ${explicitId}`);
      }
      return pack;
    }
    const agentId = params?.openclawAgentId?.trim();
    if (agentId) {
      const byAgent = this.packsByOpenClawAgentId.get(agentId);
      if (byAgent) {
        return byAgent;
      }
    }
    return this.getDefault();
  }
}

export function summarizeAgentPack(pack: AgentPackDocument): {
  id: string;
  version: string;
  displayName: AgentPackDocument["displayName"];
  domain?: string[];
  starterQuestions?: AgentPackDocument["starterQuestions"];
  openclaw?: AgentPackDocument["openclaw"];
  tools: AgentPackDocument["tools"];
  pipeline: Pick<AgentPackDocument["pipeline"], "stages">;
} {
  return {
    id: pack.id,
    version: pack.version,
    displayName: pack.displayName,
    domain: pack.domain,
    starterQuestions: pack.starterQuestions,
    openclaw: pack.openclaw,
    tools: pack.tools,
    pipeline: { stages: pack.pipeline.stages },
  };
}

let cachedRegistry: AgentPackRegistry | undefined;

export function getAgentPackRegistry(options?: AgentPackRegistryOptions): AgentPackRegistry {
  if (!cachedRegistry || options?.agentsDir || options?.defaultPackId) {
    cachedRegistry = AgentPackRegistry.load(options);
  }
  return cachedRegistry;
}

export function resetAgentPackRegistryCache(): void {
  cachedRegistry = undefined;
}
