import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { chunkDocumentText } from "@/lib/files/chunk";
import {
  detectFileFormat,
  extractTextFromBuffer,
  isDocumentParseError,
} from "@/lib/files/extract-text";
import {
  removeCampaignUpload,
  saveCampaignUpload,
} from "@/lib/files/storage";
import { toFactType } from "@/lib/llm/fallback-facts";
import { resolveLlmProvider } from "@/lib/llm/provider-resolver";
import { llmProviderSchema } from "@/types/domain";
export const runtime = "nodejs";
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const MULTIPART_OVERHEAD_ALLOWANCE_BYTES = 1024 * 1024;

type RouteContext = {
  params: Promise<{
    campaignId: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  const { campaignId } = await context.params;

  const declaredSize = request.headers?.get?.("content-length");
  if (declaredSize) {
    const contentLength = Number(declaredSize);
    if (
      Number.isInteger(contentLength) &&
      contentLength > MAX_UPLOAD_BYTES + MULTIPART_OVERHEAD_ALLOWANCE_BYTES
    ) {
      return NextResponse.json(
        {
          errorCode: "uploadLimitExceeded",
          error: `Request exceeds the ${Math.round(
            MAX_UPLOAD_BYTES / (1024 * 1024),
          )} MB upload limit once multipart overhead is included`,
        },
        { status: 413 },
      );
    }
  }

  const campaign = await db.campaign.findUnique({
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
    return NextResponse.json(
      { errorCode: "campaignNotFound", error: "Campaign not found." },
      { status: 404 },
    );
  }

  const { config, adapter } = resolveLlmProvider({
    llmProvider: llmProviderSchema.parse(campaign.llmProvider),
    llmApiKey: campaign.llmApiKey,
    llmModel: campaign.llmModel,
    llmBaseUrl: campaign.llmBaseUrl,
  });

  if (!config.llmApiKey) {
    return NextResponse.json(
      {
        errorCode: "llmSettingsRequired",
        error: "Configure an LLM provider and API key in campaign settings before extracting facts.",
      },
      { status: 400 },
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { errorCode: "invalidMultipartUpload", error: "Invalid multipart upload." },
      { status: 400 },
    );
  }
  const upload = formData.get("file");

  if (
    typeof upload !== "object" ||
    upload === null ||
    !("name" in upload) ||
    !("type" in upload)
  ) {
    return NextResponse.json(
      { errorCode: "missingFileUpload", error: "Missing file upload." },
      { status: 400 },
    );
  }

  const format = detectFileFormat(upload.name, upload.type);
  if (!format) {
    return NextResponse.json(
      { errorCode: "unsupportedFileType", error: "Unsupported file type." },
      { status: 415 },
    );
  }

  const uploadedFile = upload as File & {
    size?: number;
    text?: () => Promise<string>;
    arrayBuffer?: () => Promise<ArrayBuffer>;
  };

  if (
    typeof uploadedFile.size === "number" &&
    uploadedFile.size > MAX_UPLOAD_BYTES
  ) {
    return NextResponse.json(
      {
        errorCode: "uploadLimitExceeded",
        error: `File exceeds the ${Math.round(
          MAX_UPLOAD_BYTES / (1024 * 1024),
        )} MB upload limit`,
      },
      { status: 413 },
    );
  }

  const buffer =
    typeof uploadedFile.arrayBuffer === "function"
      ? Buffer.from(await uploadedFile.arrayBuffer())
      : typeof uploadedFile.text === "function"
        ? Buffer.from(await uploadedFile.text(), "utf8")
        : null;

  if (!buffer) {
    return NextResponse.json(
      { errorCode: "uploadedFileUnreadable", error: "Uploaded file could not be read." },
      { status: 400 },
    );
  }

  const savedFile = await saveCampaignUpload({
    campaignId,
    fileName: uploadedFile.name,
    mimeType: uploadedFile.type || "application/octet-stream",
    buffer,
  });

  try {
    const extracted = await extractTextFromBuffer(format, buffer);

    const sourceDocument = await db.sourceDocument.create({
      data: {
        campaignId,
        originalName: upload.name,
        storedPath: savedFile.storedPath,
        mimeType: savedFile.mimeType,
        checksum: savedFile.checksum,
        extractedText: extracted.text,
        pageCount: extracted.pageCount,
      },
    });

    const chunkInputs = chunkDocumentText({
      text: extracted.text,
      sourceDocumentId: sourceDocument.id,
      pageStart: 1,
    });

    const createdChunks = await Promise.all(
      chunkInputs.map((chunk) =>
        db.documentChunk.create({
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
        createdChunks.find(
          (createdChunk) => createdChunk.chunkIndex === chunk.chunkIndex,
        )?.id ?? `${sourceDocument.id}-chunk-${chunk.chunkIndex}`,
    }));

    let extractedFacts;
    try {
      extractedFacts = await adapter.extractFactsFromChunks({
        config,
        campaignId,
        chunks: factChunks,
      });
    } catch (error) {
      return NextResponse.json(
        {
          errorCode: "llmExtractionFailed",
          error: error instanceof Error ? error.message : "LLM fact extraction failed.",
        },
        { status: 502 },
      );
    }

    const canonFacts = await Promise.all(
      extractedFacts.map((fact) =>
        db.canonFact.create({
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
          select: {
            id: true,
          },
        }),
      ),
    );

    return NextResponse.json(
      {
        sourceDocument: {
          id: sourceDocument.id,
          campaignId: sourceDocument.campaignId,
          originalName: sourceDocument.originalName,
          storedPath: sourceDocument.storedPath,
          mimeType: sourceDocument.mimeType,
          checksum: sourceDocument.checksum,
          extractedText: sourceDocument.extractedText,
          pageCount: sourceDocument.pageCount,
          createdAt: sourceDocument.createdAt,
        },
        canonFacts,
      },
      { status: 201 },
    );
  } catch (error) {
    try {
      await removeCampaignUpload(savedFile.absolutePath);
    } catch {
      // Best-effort cleanup. Preserve the original extraction or DB failure.
    }

    if (isDocumentParseError(error)) {
      return NextResponse.json(
        {
          error: error.message,
        },
        { status: 400 },
      );
    }

    throw error;
  }
}
