export type DocumentSource = "paste" | "upload";

export interface UploadedFile {
  name: string;
  size: number;
  type: string;
}
