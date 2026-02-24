/**
 * Plugin integration layer for foreman-os AI intelligence.
 *
 * The foreman-os plugin (ai-intelligence/ submodule) provides:
 * - 42 skills defining AI behavior for construction management
 * - 10 agents for autonomous monitoring and analysis
 * - 37 commands mapping user actions to skill chains
 * - 21 reference documents with thresholds, patterns, and validation rules
 *
 * This module loads plugin definitions and integrates them into the app's
 * chat processor, RAG pipeline, and Trigger.dev task system.
 */

export {
  loadAllSkillMeta,
  loadSkillBody,
  loadAgentDefinition,
  loadReference,
  invalidateCache,
  isPluginAvailable,
  type SkillMeta,
  type LoadedSkill,
} from './skill-loader';

export {
  selectSkillsForQuery,
  type SelectedSkill,
  type SkillSelectionResult,
} from './skill-selector';

export {
  isExtractionPluginAvailable,
  getPluginExtractionEnhancement,
  loadAlertThresholds,
  loadValidationChecklist,
  loadCrossReferencePatterns,
  invalidateExtractionCache,
  type AlertThresholds,
  type ThresholdTier,
} from './extraction-prompt-loader';

export {
  detectCommand,
  buildCommandContext,
  loadAllCommands,
  invalidateCommandCache,
  type PluginCommand,
  type CommandDetectionResult,
} from './command-router';

export {
  loadAllPluginReferences,
  searchPluginReferences,
  invalidateReferenceCache,
  type PluginReferenceChunk,
  type PluginReferenceSearchResult,
} from './reference-loader';

export {
  executeAgentCheck,
  getProjectDataForAgent,
  type AgentExecutionResult,
  type AgentAlert,
} from './agent-executor';
