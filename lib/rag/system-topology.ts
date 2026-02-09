/**
 * System Topology Reconstruction Module (Phase 3C)
 *
 * Reconstructs MEP system topologies from document chunks,
 * including node extraction, connection mapping, and flow sequencing.
 *
 * Extracted from lib/rag-enhancements.ts
 */

import { prisma } from '@/lib/db';
import type { EnhancedChunk, SystemNode, SystemConnection, SystemTopology } from './types';

/**
 * Reconstruct system topology from MEP documents
 */
export async function reconstructSystemTopology(
  projectSlug: string,
  systemType: 'hvac' | 'plumbing' | 'electrical' | 'fire_alarm'
): Promise<SystemTopology> {
  const project = await prisma.project.findUnique({
    where: { slug: projectSlug },
    include: {
      Document: {
        include: {
          DocumentChunk: true,
        },
      },
    },
  });

  if (!project) {
    return {
      systemName: 'Unknown',
      systemType,
      nodes: [],
      connections: [],
      flow: [],
      warnings: ['Project not found'],
    };
  }

  const nodes: SystemNode[] = [];
  const connections: SystemConnection[] = [];
  const warnings: string[] = [];

  // Extract nodes (equipment/devices) from chunks
  for (const doc of project.Document) {
    for (const chunk of doc.DocumentChunk) {
      const content = chunk.content.toLowerCase();
      const metadata = chunk.metadata || {};

      // Detect equipment based on system type
      let equipmentPatterns: RegExp[] = [];
      let devicePatterns: RegExp[] = [];

      switch (systemType) {
        case 'hvac':
          equipmentPatterns = [
            /ahu[-\s]?(\d+)/gi,
            /rtu[-\s]?(\d+)/gi,
            /vav[-\s]?(\d+)/gi,
            /fcu[-\s]?(\d+)/gi,
          ];
          devicePatterns = [
            /ef[-\s]?(\d+)/gi,
            /sf[-\s]?(\d+)/gi,
            /td[-\s]?(\d+)/gi,
          ];
          break;
        case 'plumbing':
          equipmentPatterns = [
            /wh[-\s]?(\d+)/gi,
            /hwh[-\s]?(\d+)/gi,
            /pump[-\s]?(\d+)/gi,
          ];
          devicePatterns = [
            /fd[-\s]?(\d+)/gi,
            /co[-\s]?(\d+)/gi,
          ];
          break;
        case 'electrical':
          equipmentPatterns = [
            /panel\s+([a-z\d-]+)/gi,
            /mcc[-\s]?(\d+)/gi,
            /xfmr[-\s]?(\d+)/gi,
          ];
          devicePatterns = [
            /circuit\s+(\d+)/gi,
          ];
          break;
        case 'fire_alarm':
          equipmentPatterns = [
            /facp[-\s]?(\d+)/gi,
            /panel\s+([a-z\d-]+)/gi,
          ];
          devicePatterns = [
            /smoke\s*det.*?(\d+)/gi,
            /horn.*?(\d+)/gi,
            /pull\s*station.*?(\d+)/gi,
          ];
          break;
      }

      // Extract equipment nodes
      for (const pattern of equipmentPatterns) {
        pattern.lastIndex = 0;
        let match;
        while ((match = pattern.exec(content)) !== null) {
          const id = match[0];
          if (!nodes.find(n => n.id === id)) {
            const meta = metadata && typeof metadata === 'object' && !Array.isArray(metadata) ? metadata as any : {};
            const gridRefs = Array.isArray(meta.grid_references) ? meta.grid_references : [];
            const roomNum = typeof meta.room_number === 'string' ? meta.room_number : undefined;
            nodes.push({
              id,
              type: 'equipment',
              name: id,
              properties: {},
              location: {
                gridRef: gridRefs[0],
                room: roomNum,
              },
            });
          }
        }
      }

      // Extract device nodes
      for (const pattern of devicePatterns) {
        pattern.lastIndex = 0;
        let match;
        while ((match = pattern.exec(content)) !== null) {
          const id = match[0];
          if (!nodes.find(n => n.id === id)) {
            const meta = metadata && typeof metadata === 'object' && !Array.isArray(metadata) ? metadata as any : {};
            const gridRefs = Array.isArray(meta.grid_references) ? meta.grid_references : [];
            const roomNum = typeof meta.room_number === 'string' ? meta.room_number : undefined;
            nodes.push({
              id,
              type: 'device',
              name: id,
              properties: {},
              location: {
                gridRef: gridRefs[0],
                room: roomNum,
              },
            });
          }
        }
      }
      // Extract connections from text patterns
      const connectionPatterns = [
        /(\S+)\s+(?:serves|supplies|feeds|connects to)\s+(\S+)/gi,
        /(\S+)\s+→\s+(\S+)/gi,
        /from\s+(\S+)\s+to\s+(\S+)/gi,
      ];

      for (const pattern of connectionPatterns) {
        pattern.lastIndex = 0;
        let match;
        while ((match = pattern.exec(content)) !== null) {
          const from = match[1];
          const to = match[2];

          // Only add if both nodes exist
          if (nodes.find(n => n.id.toLowerCase() === from.toLowerCase()) &&
              nodes.find(n => n.id.toLowerCase() === to.toLowerCase())) {
            connections.push({
              from,
              to,
              connectionType: 'supply', // Default, can be refined
              confidence: 'medium',
            });
          }
        }
      }
    }
  }

  // Build flow sequence using topological sort
  const flow = buildFlowSequence(nodes, connections);

  // Validate topology
  if (nodes.length === 0) {
    warnings.push('No equipment or devices found for this system type');
  }
  if (connections.length === 0 && nodes.length > 1) {
    warnings.push('No connections found between equipment');
  }

  return {
    systemName: `${systemType.toUpperCase()} System`,
    systemType,
    nodes,
    connections,
    flow,
    warnings,
  };
}

/**
 * Build flow sequence from connections using topological sort
 */
function buildFlowSequence(nodes: SystemNode[], connections: SystemConnection[]): string[] {
  const flow: string[] = [];
  const visited = new Set<string>();
  const inDegree = new Map<string, number>();

  // Calculate in-degrees
  nodes.forEach(node => inDegree.set(node.id, 0));
  connections.forEach(conn => {
    inDegree.set(conn.to, (inDegree.get(conn.to) || 0) + 1);
  });

  // Find starting nodes (in-degree = 0)
  const queue: string[] = [];
  nodes.forEach(node => {
    if (inDegree.get(node.id) === 0) {
      queue.push(node.id);
    }
  });

  // Topological sort
  while (queue.length > 0) {
    const current = queue.shift()!;
    flow.push(current);
    visited.add(current);

    // Find all nodes connected from current
    connections
      .filter(conn => conn.from === current)
      .forEach(conn => {
        const newDegree = (inDegree.get(conn.to) || 0) - 1;
        inDegree.set(conn.to, newDegree);
        if (newDegree === 0 && !visited.has(conn.to)) {
          queue.push(conn.to);
        }
      });
  }

  return flow;
}
