import { readFile } from "node:fs/promises";
import path from "node:path";
import { chunkDocumentText } from "@/lib/files/chunk";
import {
  detectFileFormat,
  extractTextFromBuffer,
  isDocumentParseError,
} from "@/lib/files/extract-text";
import { db } from "@/lib/db";
import { resolveLlmProvider } from "@/lib/llm/provider-resolver";
import { toFactType } from "@/lib/llm/fallback-facts";
import { llmProviderSchema } from "@/types/domain";

type BatchFileRecord = {
  id: string;
  importBatchId: string;
  campaignId: string;
  originalName: string;
  storedPath: string | null;
  mimeType: string | null;
  checksum: string | null;
  sizeBytes: number | null;
  sourceType: string;
  status: string;
  errorCode: string | null;
  errorMessage: string | null;
};

type BatchRecord = {
  id: string;
  campaignId: string;
  status: string;
  defaultSourceType: string;
  files: BatchFileRecord[];
};

type CampaignRecord = {
  id: string;
  llmProvider: string;
  llmApiKey: string | null;
  llmModel: string | null;
  llmBaseUrl: string | null;
};

type ProcessBatchDb = {
  campaign: {
    findUnique: typeof db.campaign.findUnique;
  };
  importBatch: {
    findFirst: typeof db.importBatch.findFirst;
    updateMany: typeof db.importBatch.updateMany;
    update: typeof db.importBatch.update;
  };
  importBatchFile: {
    update: typeof db.importBatchFile.update;
  };
  sourceDocument: {
    create: typeof db.sourceDocument.create;
    update: typeof db.sourceDocument.update;
  };
  documentChunk: {
    create: typeof db.documentChunk.create;
  };
  canonFact: {
    create: typeof db.canonFact.create;
  };
};

type ProcessBatchDependencies = {
  db: ProcessBatchDb;
  readFile: typeof readFile;
  extractTextFromBuffer: typeof extractTextFromBuffer;
  resolveLlmProvider: typeof resolveLlmProvider;
};

type ProcessBatchOptions = {
  campaignId: string;
  batchId: string;
  dependencies?: Partial<ProcessBatchDependencies>;
};

export type ImportBatchProcessingSummary = {
  successCount: number;
  failureCount: number;
  candidateFactCount: number;
  conflictCount: number;
  conflictSubjects: string[];
};

export type ImportBatchProcessingResult = {
  batchId: string;
  campaignId: string;
  batchStatus: "completed" | "failed";
  summary: ImportBatchProcessingSummary;
};

export class ImportBatchProcessingError extends Error {
  readonly status: number;
  readonly errorCode: string;

  constructor(errorCode: string, message: string, status = 400) {
    super(message);
    this.name = "ImportBatchProcessingError";
    this.errorCode = errorCode;
    this.status = status;
  }
}

function withDependencies(
  overrides?: Partial<ProcessBatchDependencies>,
): ProcessBatchDependencies {
  return {
    db,
    readFile,
    extractTextFromBuffer,
    resolveLlmProvider,
    ...overrides,
  };
}

function summarizeCreatedFacts(
  createdFacts: Array<{ subject: string; factType: string }>,
): Pick<
  ImportBatchProcessingSummary,
  "candidateFactCount" | "conflictCount" | "conflictSubjects"
> {
  const grouped = new Map<string, { subject: string; count: number }>();

  for (const fact of createdFacts) {
    const key = `${fact.subject}::${fact.factType}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.count += 1;
      continue;
    }

    grouped.set(key, {
      subject: fact.subject,
      count: 1,
    });
  }

  const conflictSubjects = Array.from(grouped.values())
    .filter((entry) => entry.count > 1)
    .map((entry) => entry.subject);

  return {
    candidateFactCount: createdFacts.length,
    conflictCount: conflictSubjects.length,
    conflictSubjects,
  };
}

async function updateBatchFileFailure(
  dbClient: ProcessBatchDependencies["db"],
  fileId: string,
  errorCode: string,
  errorMessage: string,
) {
  await dbClient.importBatchFile.update({
    where: { id: fileId },
    data: {
      status: "failed",
      errorCode,
      errorMessage,
    },
  });
}

async function loadCampaignContext(
  dbClient: ProcessBatchDependencies["db"],
  campaignId: string,
): Promise<CampaignRecord> {
  const campaign = await dbClient.campaign.findUnique({
    where: { id: campaignId },
    select: {
      id: true,
      llmProvider: true,
      llmApiKey: true,
      llmModel: true,
      llmBaseUrl: true,
    },
  });

  if (!campaign) {
    throw new ImportBatchProcessingError(
      "campaignNotFound",
      "Campaign not found.",
      404,
    );
  }

  return campaign;
}

async function loadBatchContext(
  dbClient: ProcessBatchDependencies["db"],
  campaignId: string,
  batchId: string,
): Promise<BatchRecord> {
  const batch = await dbClient.importBatch.findFirst({
    where: {
      id: batchId,
      campaignId,
    },
    include: {
      files: {
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      },
    },
  });

  if (!batch) {
    throw new ImportBatchProcessingError(
      "importBatchNotFound",
      "Import batch not found.",
      404,
    );
  }

  return batch;
}

export async function processImportBatch({
  campaignId,
  batchId,
  dependencies,
}: ProcessBatchOptions): Promise<ImportBatchProcessingResult> {
  const services = withDependencies(dependencies);
  const campaign = await loadCampaignContext(services.db, campaignId);

  const { config, adapter } = services.resolveLlmProvider({
    llmProvider: llmProviderSchema.parse(campaign.llmProvider),
    llmApiKey: campaign.llmApiKey,
    llmModel: campaign.llmModel,
    llmBaseUrl: campaign.llmBaseUrl,
  });

  if (!config.llmApiKey) {
    throw new ImportBatchProcessingError(
      "llmSettingsRequired",
      "Configure an LLM provider and API key before extraction.",
    );
  }

  const lockResult = await services.db.importBatch.updateMany({
    where: {
      id: batchId,
      campaignId,
      status: "ready",
    },
    data: {
      status: "processing",
      startedAt: new Date(),
    },
  });

  if (lockResult.count !== 1) {
    await loadBatchContext(services.db, campaignId, batchId);

    throw new ImportBatchProcessingError(
      "importBatchLocked",
      "This import batch is already processing or no longer ready.",
      409,
    );
  }

  const batch = await loadBatchContext(services.db, campaignId, batchId);

  const createdFacts: Array<{ subject: string; factType: string }> = [];
  let successCount = 0;
  let failureCount = 0;

  for (const file of batch.files) {
    if (file.status === "failed" || !file.storedPath || !file.checksum) {
      failureCount += 1;
      continue;
    }

    await services.db.importBatchFile.update({
      where: { id: file.id },
      data: {
        status: "processing",
        errorCode: null,
        errorMessage: null,
      },
    });

    let buffer: Buffer;
    try {
      buffer = await services.readFile(path.resolve(process.cwd(), file.storedPath));
    } catch {
      failureCount += 1;
      await updateBatchFileFailure(
        services.db,
        file.id,
        "uploadedFileUnreadable",
        "Uploaded file could not be read.",
      );
      continue;
    }

    const format = detectFileFormat(file.originalName, file.mimeType);
    if (!format) {
      failureCount += 1;
      await updateBatchFileFailure(
        services.db,
        file.id,
        "unsupported_format",
        "The uploaded file format is not supported.",
      );
      continue;
    }

    const sourceDocument = await services.db.sourceDocument.create({
      data: {
        campaignId,
        importBatchId: batchId,
        originalName: file.originalName,
        storedPath: file.storedPath,
        mimeType: file.mimeType ?? "application/octet-stream",
        checksum: file.checksum,
        sourceType: file.sourceType,
        processingStatus: "processing",
        extractionError: null,
      },
    });

    let extractedText: string;
    let pageCount: number | null;
    try {
      const extracted = await services.extractTextFromBuffer(format, buffer);
      extractedText = extracted.text;
      pageCount = extracted.pageCount;
    } catch (error) {
      failureCount += 1;
      const message = isDocumentParseError(error)
        ? error.message
        : "Document parsing failed.";
      await services.db.sourceDocument.update({
        where: { id: sourceDocument.id },
        data: {
          processingStatus: "failed",
          extractionError: message,
        },
      });
      await updateBatchFileFailure(
        services.db,
        file.id,
        "documentParseFailed",
        message,
      );
      continue;
    }

    await services.db.sourceDocument.update({
      where: { id: sourceDocument.id },
      data: {
        extractedText,
        pageCount,
      },
    });

    const chunkInputs = chunkDocumentText({
      text: extractedText,
      sourceDocumentId: sourceDocument.id,
      pageStart: 1,
    });

    const createdChunks = await Promise.all(
      chunkInputs.map((chunk) =>
        services.db.documentChunk.create({
          data: {
            campaignId,
            sourceDocumentId: sourceDocument.id,
            chunkIndex: chunk.chunkIndex,
            pageStart: chunk.pageStart,
            pageEnd: chunk.pageEnd,
            content: chunk.text,
            tokenCount: null,
            checksum: null,
          },
        }),
      ),
    );

    const factChunks = chunkInputs.map((chunk) => ({
      ...chunk,
      documentChunkId:
        createdChunks.find((createdChunk) => createdChunk.chunkIndex === chunk.chunkIndex)?.id ??
        `${sourceDocument.id}-chunk-${chunk.chunkIndex}`,
    }));

    let extractedFacts;
    try {
      extractedFacts = await adapter.extractFactsFromChunks({
        config,
        campaignId,
        chunks: factChunks,
      });
    } catch (error) {
      failureCount += 1;
      const message =
        error instanceof Error ? error.message : "LLM fact extraction failed.";
      await services.db.sourceDocument.update({
        where: { id: sourceDocument.id },
        data: {
          processingStatus: "failed",
          extractionError: message,
        },
      });
      await updateBatchFileFailure(
        services.db,
        file.id,
        "llmExtractionFailed",
        message,
      );
      continue;
    }

    for (const fact of extractedFacts) {
      createdFacts.push({
        subject: fact.subject,
        factType: toFactType(fact.category),
      });

      await services.db.canonFact.create({
        data: {
          campaignId,
          sourceDocumentId: fact.sourceDocumentId,
          documentChunkId: fact.documentChunkId,
          subject: fact.subject,
          factType: toFactType(fact.category),
          value: fact.summary,
          status: "uncertain",
          priority: 0,
          confidence: fact.confidence ?? null,
          evidence: fact.provenance.sourceQuote,
        },
      });
    }

    await services.db.sourceDocument.update({
      where: { id: sourceDocument.id },
      data: {
        processingStatus: "processed",
        extractionError: null,
      },
    });
    await services.db.importBatchFile.update({
      where: { id: file.id },
      data: {
        status: "completed",
        errorCode: null,
        errorMessage: null,
      },
    });
    successCount += 1;
  }

  const factSummary = summarizeCreatedFacts(createdFacts);
  const batchStatus: "completed" | "failed" = successCount > 0 ? "completed" : "failed";

  await services.db.importBatch.update({
    where: { id: batchId },
    data: {
      status: batchStatus,
      completedAt: new Date(),
    },
  });

  return {
    batchId,
    campaignId,
    batchStatus,
    summary: {
      successCount,
      failureCount,
      ...factSummary,
    },
  };
}
