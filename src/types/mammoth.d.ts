declare module "mammoth" {
  export type ExtractRawTextResult = {
    value: string;
  };

  export function extractRawText(input: {
    buffer: Buffer;
  }): Promise<ExtractRawTextResult>;

  const mammoth: {
    extractRawText: typeof extractRawText;
  };

  export default mammoth;
}
