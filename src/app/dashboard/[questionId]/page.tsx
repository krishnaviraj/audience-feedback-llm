import { createClient } from '@supabase/supabase-js';
import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import QuestionDashboard from '@/components/QuestionDashboard/QuestionDashboard';
import { GenerateMetadataProps, PageParams } from '@/app/types';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function generateMetadata(
  { params }: GenerateMetadataProps
): Promise<Metadata> {
  return {
    title: `Question ${params.questionId}`
  };
}

export default async function Page({ 
  params 
}: { 
  params: PageParams 
}) {
  // Fetch the question data
  const { data: question, error } = await supabase
    .from('questions')
    .select('*')
    .eq('id', params.questionId)
    .single();

  if (error || !question) {
    return notFound();
  }

  return (
    <QuestionDashboard 
      questionId={question.id}
      question={question.question}
    />
  );
}