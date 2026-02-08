-- Rename ProcessorType from 'gpt-4o-vision' to 'vision-ai'
UPDATE "Document" SET "processorType" = 'vision-ai' WHERE "processorType" = 'gpt-4o-vision';
UPDATE "ProcessingCost" SET "processorType" = 'vision-ai' WHERE "processorType" = 'gpt-4o-vision';
UPDATE "RegulatoryDocument" SET "processorType" = 'vision-ai' WHERE "processorType" = 'gpt-4o-vision';
