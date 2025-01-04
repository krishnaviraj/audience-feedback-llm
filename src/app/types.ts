import { Metadata } from 'next';

export interface GenerateMetadataProps {
  params: { questionId: string };
  searchParams: { [key: string]: string | string[] | undefined };
}

export interface PageParams {
  questionId: string;
}

export type GenerateMetadata = (props: GenerateMetadataProps) => Promise<Metadata>;